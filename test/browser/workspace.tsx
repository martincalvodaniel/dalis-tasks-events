import { createRoot } from "react-dom/client"
import { canPrepareOfflineShell } from "@/config/pwa"
import { createLocalTask } from "@/features/tasks/local-tasks"
import { Workspace } from "@/features/workspace/components/workspace"
import {
  loadLocalAccount,
  prepareLocalAccount,
} from "@/features/workspace/local-account"
import {
  ACCOUNT_CONTROL_DATABASE,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"

if (
  location.hostname !== "127.0.0.1" ||
  !["4179", "4184"].includes(location.port)
)
  throw new Error("Workspace fixtures require an isolated loopback origin")

const host = document.getElementById("workspace")
if (host) createRoot(host).render(<Workspace />)
else
  void run().catch((error: unknown) => {
    console.error(error)
    const status = document.getElementById("status")
    if (status) status.textContent = "Ha fallado una comprobación."
  })

function assert(value: unknown): asserts value {
  if (!value) throw new Error("Workspace browser assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  document.getElementById("results")?.append(row)
  row.textContent = label
  await work()
  row.textContent = `Correcto: ${label}`
}
async function session(state: "authorized" | "unauthorized", delay = false) {
  const response = await fetch(`/test/session?state=${state}&delay=${delay}`)
  return (await response.json()) as { userId: string }
}
async function requestStatus() {
  return (await (await fetch("/test/status")).json()) as {
    identityRequests: number
    waiting: boolean
  }
}
async function run() {
  const { userId } = await session("unauthorized")
  if (new URLSearchParams(location.search).get("mode") === "cleanup") {
    const current = await readAccountControl()
    assert(current.userId === null || current.userId === userId)
    for (const name of [localDatabaseName(userId), ACCOUNT_CONTROL_DATABASE])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
      })
    const status = document.getElementById("status")
    for (const registration of await navigator.serviceWorker.getRegistrations())
      if (registration.active?.scriptURL === `${location.origin}/dalis-sw.js`)
        await registration.unregister()
    for (const key of await caches.keys())
      if (key.startsWith("dalis-shell:")) await caches.delete(key)
    if (status) status.textContent = "Datos ficticios limpiados."
    return
  }
  assert(!(await readAccountControl()).userId)
  await check(
    "Sin sesión: solicita Google y no activa ninguna cuenta",
    async () => {
      const state = await loadLocalAccount()
      assert(
        !state.account && state.authenticationRequired && !state.logoutPending
      )
    }
  )
  if (canPrepareOfflineShell) {
    await check("Producción no activa datos si falta el worker", async () => {
      await fetch("/test/session?state=authorized&worker=missing")
      let rejected = false
      try {
        await loadLocalAccount()
      } catch {
        rejected = true
      }
      assert(rejected && !(await readAccountControl()).userId)
    })
  }
  await session("authorized")
  await check(
    canPrepareOfflineShell
      ? "Sesión autorizada prepara automáticamente el shell de producción"
      : "Sesión autorizada prepara automáticamente sin worker en desarrollo",
    async () => {
      const state = await loadLocalAccount()
      assert(
        state.account?.userId === userId &&
          state.account.offlineReady === canPrepareOfflineShell
      )
      assert(
        Boolean(await navigator.serviceWorker.getRegistration("/workspace")) ===
          canPrepareOfflineShell
      )
      await createLocalTask(
        state.account,
        {
          kind: "task",
          title: "Probar mi espacio local",
          description: "",
          scheduledDate: "2026-10-07",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
        crypto.randomUUID(),
        crypto.randomUUID()
      )
    }
  )
  await session("unauthorized")
  await check(
    "Restaurar conserva tarea y no depende de la sesión remota",
    async () => {
      const before = await requestStatus()
      const state = await loadLocalAccount()
      assert(
        state.account?.itemCount === 1 &&
          state.account.offlineReady === canPrepareOfflineShell
      )
      assert(
        (await requestStatus()).identityRequests === before.identityRequests
      )
    }
  )
  await check(
    "Cierre pendiente no inicia preparación ni descarta la cola",
    async () => {
      const control = await hideLocalAccount()
      const before = await requestStatus()
      const state = await loadLocalAccount()
      assert(!state.account && state.logoutPending)
      assert(
        (await requestStatus()).identityRequests === before.identityRequests
      )
      const outbox = await LocalOutbox.open(userId)
      try {
        assert((await outbox.listEntries()).length === 1)
      } finally {
        outbox.close()
      }
      await completeRemoteLogout(control.epoch)
    }
  )
  await check(
    "Cerrar durante una respuesta de identidad impide reactivación",
    async () => {
      await session("authorized", true)
      const control = await readAccountControl()
      const preparation = prepareLocalAccount(control.epoch).then(
        () => false,
        () => true
      )
      for (
        let attempt = 0;
        attempt < 100 && !(await requestStatus()).waiting;
        attempt++
      )
        await new Promise((resolve) => setTimeout(resolve, 10))
      assert((await requestStatus()).waiting)
      const hidden = await hideLocalAccount()
      await fetch("/test/release")
      assert(await preparation)
      assert((await readAccountControl()).logoutPending)
      await completeRemoteLogout(hidden.epoch)
    }
  )
  await session("authorized")
  const status = document.getElementById("status")
  if (status)
    status.textContent = `${canPrepareOfflineShell ? "Seis" : "Cinco"} comprobaciones aprobadas. Abrir el espacio sin preparación manual.`
  const link = document.createElement("a")
  link.href = "/workspace"
  link.textContent = "Abrir espacio con sesión ficticia"
  document.getElementById("actions")?.append(link)
}
