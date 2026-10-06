import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { isOfflineShellReady, prepareOfflineShell } from "@/lib/pwa/client"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"
import { preparedAccountSchema } from "@/schemas/workspace"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-pwa`
const resultList = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!resultList || !status || !actions) throw new Error("Test markup missing")
const results = resultList
const statusElement = status
const actionContainer = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("PWA browser assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  results.append(row)
  try {
    await work()
    row.textContent = `Correcto: ${label}`
  } catch (error) {
    row.textContent = `Falló: ${label}`
    throw error
  }
}
async function run() {
  if (query.get("mode") === "cleanup") {
    const current = localStorage.getItem(OFFLINE_ACCOUNT_KEY)
    assert(
      current &&
        preparedAccountSchema.parse(JSON.parse(current)).userId === userId
    )
    localStorage.removeItem(OFFLINE_ACCOUNT_KEY)
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(userId))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Test cleanup blocked"))
    })
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const registration of registrations) {
      if (registration.active?.scriptURL === `${location.origin}/dalis-sw.js`)
        await registration.unregister()
    }
    for (const key of await caches.keys())
      if (key.startsWith("dalis-shell:")) await caches.delete(key)
    statusElement.textContent = "Cuenta, caché y worker ficticios limpiados."
    return
  }
  assert(!localStorage.getItem(OFFLINE_ACCOUNT_KEY))
  await check("Recursos del build y shell neutro preparados", async () => {
    await prepareOfflineShell()
    assert(await isOfflineShellReady())
    const names = (await caches.keys()).filter((key) =>
      key.startsWith("dalis-shell:")
    )
    assert(names.length === 1)
    const cache = await caches.open(names[0])
    const entries = await cache.keys()
    assert(
      entries.some((entry) => new URL(entry.url).pathname === "/workspace")
    )
    assert(
      entries.some((entry) =>
        new URL(entry.url).pathname.startsWith("/_next/static/")
      )
    )
    assert(
      entries.every((entry) => {
        const path = new URL(entry.url).pathname
        return (
          path === "/workspace" ||
          path.startsWith("/_next/static/") ||
          [
            "/manifest.webmanifest",
            "/icon-192.png",
            "/icon-512.png",
            "/apple-touch-icon.png",
          ].includes(path)
        )
      })
    )
  })
  await check("Identidad sin sesión responde 401 y no se cachea", async () => {
    const response = await fetch("/api/sync/identity", { cache: "no-store" })
    assert(
      response.status === 401 &&
        response.headers.get("cache-control")?.includes("no-store")
    )
    for (const key of await caches.keys())
      assert(!(await (await caches.open(key)).match("/api/sync/identity")))
  })
  await check(
    "Cuenta ficticia y operación pendiente preparadas en IndexedDB",
    async () => {
      const repository = await LocalRepository.open(userId)
      const outbox = await LocalOutbox.open(userId)
      try {
        const timestamp = new Date().toISOString()
        await repository.put("settings", {
          userId,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
          revision: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        })
        await outbox.commitItemCommand({
          type: "item.create",
          itemId: crypto.randomUUID(),
          input: taskDraftSchema.parse({
            kind: "task",
            title: "Offline test task",
            description: "",
            scheduledDate: "2026-10-06",
            status: "in_progress",
            checklist: [],
            recurrence: null,
          }),
        })
        localStorage.setItem(
          OFFLINE_ACCOUNT_KEY,
          JSON.stringify(
            preparedAccountSchema.parse({
              version: 1,
              userId,
              preparedAt: timestamp,
            })
          )
        )
        assert((await outbox.listEntries()).length === 1)
      } finally {
        repository.close()
        outbox.close()
      }
    }
  )
  statusElement.textContent =
    "Preparación verificada. Abrir el espacio, detener el servidor y recargar."
  const link = document.createElement("a")
  link.textContent = "Abrir espacio preparado"
  link.href = "/workspace"
  actionContainer.append(link)
  const cleanupLink = document.createElement("a")
  cleanupLink.textContent = "Limpiar después de comprobar"
  cleanupLink.href = `/pwa-check.html?mode=cleanup&run=${runId}`
  actionContainer.append(document.createElement("br"), cleanupLink)
}
run().catch(() => {
  statusElement.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
