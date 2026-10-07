import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { canPrepareOfflineShell } from "@/config/pwa"
import { assignLocalCategory, saveLocalTag } from "@/features/tags/local-tags"
import { createLocalTask } from "@/features/tasks/local-tasks"
import { Workspace } from "@/features/workspace/components/workspace"
import {
  loadLocalAccount,
  prepareLocalAccount,
} from "@/features/workspace/local-account"
import { addCivilDays, todayInTimeZone } from "@/lib/calendar/civil-date"
import {
  ACCOUNT_CONTROL_DATABASE,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { compareRank } from "@/lib/ordering/rank"

if (
  location.hostname !== "127.0.0.1" ||
  !["4179", "4184"].includes(location.port)
)
  throw new Error("Workspace fixtures require an isolated loopback origin")

const host = document.getElementById("workspace")
if (host)
  createRoot(host).render(
    <StrictMode>
      <Workspace />
    </StrictMode>
  )
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
  const mode = new URLSearchParams(location.search).get("mode")
  if (mode === "magnify") {
    const frame = document.createElement("iframe")
    frame.title = "Espacio con texto ampliado"
    frame.src =
      new URLSearchParams(location.search).get("view") === "tags"
        ? "/workspace?view=tags"
        : "/workspace"
    frame.style.width = "100%"
    frame.style.height = "1000px"
    frame.addEventListener("load", () => {
      const root = frame.contentDocument?.documentElement
      if (root) root.style.fontSize = "32px"
    })
    document.getElementById("actions")?.append(frame)
    return
  }
  if (mode === "clock") {
    const frame = document.createElement("iframe")
    frame.title = "Agenda con reloj de prueba"
    frame.src = "/workspace"
    frame.style.width = "100%"
    frame.style.height = "1000px"
    let advance: (() => void) | null = null
    frame.addEventListener("load", () => {
      const frameWindow = frame.contentWindow
      assert(frameWindow)
      let instant = Date.now()
      const simulatedDate = new Proxy(Date, {
        construct(target, argumentsList) {
          return Reflect.construct(
            target,
            argumentsList.length ? argumentsList : [instant]
          )
        },
        get(target, key) {
          return key === "now" ? () => instant : Reflect.get(target, key)
        },
      })
      Object.defineProperty(frameWindow, "Date", {
        value: simulatedDate,
        configurable: true,
      })
      advance = () => {
        instant += 86400000
        frameWindow.dispatchEvent(new Event("focus"))
      }
    })
    const button = document.createElement("button")
    button.textContent = "Avanzar un día de prueba"
    button.addEventListener("click", () => advance?.())
    document.getElementById("actions")?.append(button, frame)
    const status = document.getElementById("status")
    if (status)
      status.textContent = "Tiempo simulado únicamente en este iframe ficticio."
    return
  }
  const { userId } = await session(
    mode === "calendar" ||
      mode === "agenda" ||
      mode === "agenda-inspect" ||
      mode === "category-order-inspect"
      ? "authorized"
      : "unauthorized"
  )
  if (mode === "category-order-inspect") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const tags = (await repository.list("tags")).sort(compareRank)
      assert(
        JSON.stringify(tags.map((tag) => tag.name)) ===
          JSON.stringify(["Casa", "Trabajo", "Familia"])
      )
      const entries = await outbox.listEntries()
      assert(
        entries.length === 9 &&
          entries.every((entry, index) => entry.sequence === index + 1)
      )
      assert(
        entries.filter((entry) => entry.operation.command.type === "tag.move")
          .length === 4
      )
      const items = await repository.list("items")
      assert(
        items.length === 1 &&
          items[0].kind === "task" &&
          items[0].status === "not_started"
      )
      const status = document.getElementById("status")
      if (status)
        status.textContent =
          "Orden conservado: cuatro movimientos, una intención por movimiento y tarea intacta."
    } finally {
      repository.close()
      outbox.close()
    }
    return
  }
  if (mode === "agenda" || mode === "agenda-inspect") {
    const state = await loadLocalAccount()
    assert(state.account?.userId === userId)
    const account = state.account
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const settings = await repository.get("settings", userId)
      assert(settings)
      const today = todayInTimeZone(settings.timeZone)
      if (mode === "agenda") {
        assert((await repository.list("tags")).length === 0)
        const baseline = (await repository.list("items"))[0]
        assert(baseline?.kind === "task")
        const tagId = crypto.randomUUID()
        await saveLocalTag(
          account,
          tagId,
          { name: "Trabajo", color: "#059669", position: 0 },
          crypto.randomUUID()
        )
        await assignLocalCategory(
          account,
          baseline.id,
          tagId,
          crypto.randomUUID()
        )
        for (const [title, date, status] of [
          ["Pendiente de ayer", addCivilDays(today, -1), "in_progress"],
          ["Hecha ayer", addCivilDays(today, -1), "completed"],
          ["Comprar pan", today, "not_started"],
        ] as const) {
          const id = crypto.randomUUID()
          await createLocalTask(
            account,
            {
              kind: "task",
              title,
              description: "",
              scheduledDate: date,
              status,
              checklist: [],
              recurrence: null,
            },
            id,
            crypto.randomUUID()
          )
          if (title === "Pendiente de ayer")
            await assignLocalCategory(account, id, tagId, crypto.randomUUID())
        }
      } else
        await check(
          "Completar conserva fecha y el reloj no añade intenciones",
          async () => {
            const items = await repository.list("items")
            const late = items.find(
              (item) => item.title === "Pendiente de ayer"
            )
            assert(items.length === 4 && late?.kind === "task")
            assert(
              late.status === "completed" &&
                late.scheduledDate === addCivilDays(today, -1)
            )
            const entries = await outbox.listEntries()
            assert(
              entries.length === 8 &&
                entries.at(-1)?.operation.command.type === "task.set-status"
            )
          }
        )
    } finally {
      repository.close()
      outbox.close()
    }
    const status = document.getElementById("status")
    if (status)
      status.textContent =
        mode === "agenda"
          ? "Agenda ficticia preparada."
          : "Datos, fecha y cola comprobados."
    const link = document.createElement("a")
    link.href = "/workspace"
    link.textContent = "Abrir agenda"
    document.getElementById("actions")?.append(link)
    return
  }
  if (mode === "calendar") {
    const control = await readAccountControl()
    assert(control.userId === userId && !control.logoutPending)
    await check(
      "Crear desde el día conserva fecha, tarea y outbox tras recarga",
      async () => {
        const repository = await LocalRepository.open(userId)
        const outbox = await LocalOutbox.open(userId)
        try {
          const tasks = await repository.list("items")
          assert(tasks.length === 2)
          const created = tasks.find((item) => item.title === "Plan del sábado")
          assert(
            created?.kind === "task" && created.scheduledDate === "2026-10-10"
          )
          const entries = await outbox.listEntries()
          assert(
            entries.length === 2 &&
              entries.some(
                (entry) =>
                  entry.operation.command.type === "item.create" &&
                  entry.operation.command.itemId === created.id
              )
          )
        } finally {
          repository.close()
          outbox.close()
        }
      }
    )
    const status = document.getElementById("status")
    if (status) status.textContent = "Creación desde calendario comprobada."
    return
  }
  if (mode === "cleanup") {
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
          scheduledDate: todayInTimeZone(
            Intl.DateTimeFormat().resolvedOptions().timeZone
          ),
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
