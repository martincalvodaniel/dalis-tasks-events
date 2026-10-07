import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { isOfflineShellReady, prepareOfflineShell } from "@/lib/pwa/client"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
if (
  location.hostname !== "127.0.0.1" ||
  !["4183", "4184"].includes(location.port)
)
  throw new Error("PWA fixtures require an isolated loopback test origin")
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-pwa`
const otherUserId = `${userId}-other`
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
  if (query.get("mode") === "tags-ui") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      await check(
        "Categoría borrada conserva tarea, vista personal y cola tras recarga",
        async () => {
          const tags = await repository.list("tags", { includeDeleted: true })
          const items = await repository.list("items")
          assert(
            tags.length === 1 &&
              tags[0].name === "Personal" &&
              tags[0].deletedAt
          )
          assert((await repository.list("tags")).length === 0)
          assert(
            items.length === 1 &&
              items[0].kind === "task" &&
              items[0].status === "not_started"
          )
          assert(
            (await repository.get("itemViews", items[0].id))?.primaryTagId ===
              tags[0].id
          )
          const entries = await outbox.listEntries()
          assert(entries.length === 9)
          assert(entries[1].operation.command.type === "tag.save")
          assert(entries[2].operation.command.type === "tag.save")
          for (const index of [3, 4, 5])
            assert(entries[index].operation.command.type === "item-view.set")
          assert(
            entries[6].operation.command.type === "tag.delete" &&
              entries[6].dependencies.includes(entries[5].operation.operationId)
          )
          assert(
            entries[7].operation.command.type === "task.set-status" &&
              entries[8].operation.command.type === "task.set-status"
          )
        }
      )
    } finally {
      repository.close()
      outbox.close()
    }
    statusElement.textContent = "Categorías, asignación y progreso comprobados."
    return
  }
  if (query.get("mode") === "task-progress") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      await check(
        "Estado y checklist conservados tras recarga offline",
        async () => {
          const task = (await repository.list("items")).find(
            (item) => item.title === "Progreso sin red"
          )
          assert(task?.kind === "task")
          assert(task.status === "in_progress" && task.completedAt === null)
          assert(task.checklist.length === 1 && !task.checklist[0].completed)
          const entries = (await outbox.listEntries()).filter(
            (entry) => entry.entityKey === `item:${task.id}`
          )
          assert(entries.length === 7)
          assert(entries[0].operation.command.type === "item.create")
          assert(entries[1].operation.command.type === "task.set-status")
          assert(
            entries[2].operation.command.type === "task.set-checklist-entry"
          )
          assert(entries[3].operation.command.type === "task.set-status")
          assert(entries[4].operation.command.type === "task.set-status")
          assert(
            entries[5].operation.command.type === "task.set-checklist-entry"
          )
          assert(entries[6].operation.command.type === "task.set-status")
          for (let index = 1; index < entries.length; index++)
            assert(
              entries[index].dependencies[0] ===
                entries[index - 1].operation.operationId
            )
          const timestamp = task.updatedAt
          let rejected = false
          try {
            await outbox.commitItemCommand({
              type: "task.set-checklist-entry",
              itemId: task.id,
              occurrenceId: null,
              entryId: crypto.randomUUID(),
              completed: true,
            })
          } catch {
            rejected = true
          }
          assert(
            rejected &&
              (await repository.get("items", task.id))?.updatedAt === timestamp
          )
          assert((await outbox.listEntries()).length === 8)
        }
      )
    } finally {
      repository.close()
      outbox.close()
    }
    statusElement.textContent = "Progreso offline y cola comprobados."
    return
  }
  if (query.get("mode") === "task-edit") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      await check(
        "Edición conserva identidad y estado; borrado conserva tombstone y dependencias",
        async () => {
          const items = await repository.list("items", { includeDeleted: true })
          const edited = items.find((item) => item.title === "Plan de mañana")
          const deleted = items.find(
            (item) => item.title === "Eliminar de prueba"
          )
          assert(edited?.kind === "task" && !edited.deletedAt)
          assert(
            edited.status === "in_progress" &&
              edited.scheduledDate === "2026-10-08" &&
              edited.description === "Sin conexión"
          )
          assert(
            edited.checklist.length === 1 &&
              edited.checklist[0].text === "Revisar notas"
          )
          assert(
            deleted?.deletedAt &&
              !(await repository.list("items")).some(
                (item) => item.id === deleted.id
              )
          )
          const entries = await outbox.listEntries()
          assert(entries.length === 4)
          assert(
            entries[0].operation.command.type === "item.create" &&
              entries[0].operation.command.itemId === edited.id
          )
          assert(
            entries[1].operation.command.type === "item.update" &&
              entries[1].dependencies[0] === entries[0].operation.operationId
          )
          assert(
            entries[3].operation.command.type === "item.delete" &&
              entries[3].operation.command.itemId === deleted.id &&
              entries[3].dependencies[0] === entries[2].operation.operationId
          )
        }
      )
      await check(
        "Editor obsoleto no sobrescribe cambios ni crea una intención",
        async () => {
          const current = (await repository.list("items")).find(
            (item) => item.title === "Plan de mañana"
          )
          assert(current?.kind === "task")
          const draft = taskDraftSchema.parse({
            kind: "task",
            title: "Versión de otra pestaña",
            description: current.description,
            scheduledDate: current.scheduledDate,
            status: current.status,
            checklist: current.checklist,
            recurrence: current.recurrence,
          })
          await outbox.commitItemCommand(
            { type: "item.update", itemId: current.id, input: draft },
            { expectedItem: current }
          )
          let rejected = false
          try {
            await outbox.commitItemCommand(
              {
                type: "item.update",
                itemId: current.id,
                input: { ...draft, title: "Edición obsoleta" },
              },
              { expectedItem: current }
            )
          } catch {
            rejected = true
          }
          assert(rejected && (await outbox.listEntries()).length === 5)
          assert(
            (await repository.get("items", current.id))?.title === draft.title
          )
        }
      )
    } finally {
      repository.close()
      outbox.close()
    }
    statusElement.textContent =
      "Edición, borrado y protección entre pestañas comprobados."
    return
  }
  if (query.get("mode") === "task-create") {
    await check(
      "Tarea del formulario y su intención conservadas tras recarga",
      async () => {
        const repository = await LocalRepository.open(userId)
        const outbox = await LocalOutbox.open(userId)
        try {
          const task = (await repository.list("items")).find(
            (item) => item.title === "Comprar fruta"
          )
          assert(task?.kind === "task")
          assert(
            task.scheduledDate === "2026-10-09" &&
              task.description === "Para la semana"
          )
          assert(
            task.checklist.length === 2 &&
              task.checklist[0].text === "Manzanas" &&
              task.checklist[1].text === "Peras"
          )
          assert(task.checklist.every((entry) => !entry.completed))
          const entries = await outbox.listEntries()
          assert(entries.length === 2)
          assert(
            entries.some(
              (entry) =>
                entry.operation.command.type === "item.create" &&
                entry.operation.command.itemId === task.id &&
                entry.state === "pending"
            )
          )
        } finally {
          repository.close()
          outbox.close()
        }
      }
    )
    statusElement.textContent = "Creación offline comprobada."
    return
  }
  if (query.get("mode") === "magnify") {
    const frame = document.createElement("iframe")
    frame.title = "Vista con texto ampliado"
    frame.src =
      query.get("view") === "calendar"
        ? "/workspace?view=calendar&date=2026-10-10"
        : query.get("view") === "tags"
          ? "/workspace?view=tags"
          : "/workspace?view=settings"
    frame.style.width = "100%"
    frame.style.height = "800px"
    frame.style.border = "0"
    frame.addEventListener("load", () => {
      if (!frame.contentDocument) throw new Error("Test frame missing")
      frame.contentDocument.documentElement.style.fontSize = "32px"
      statusElement.textContent =
        "Texto al 200%; comprobar navegación y controles."
    })
    actionContainer.append(frame)
    return
  }
  if (query.get("mode") === "cleanup") {
    const current = await readAccountControl()
    assert(
      current.userId === userId ||
        current.userId === otherUserId ||
        current.userId === null
    )
    localStorage.removeItem(OFFLINE_ACCOUNT_KEY)
    for (const name of [
      localDatabaseName(userId),
      localDatabaseName(otherUserId),
      ACCOUNT_CONTROL_DATABASE,
    ])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
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
  if (query.get("mode") === "inspect") {
    await check("Cola anterior conservada tras cierre de sesión", async () => {
      const outbox = await LocalOutbox.open(userId)
      try {
        assert((await outbox.listEntries()).length === 1)
      } finally {
        outbox.close()
      }
      const control = await readAccountControl()
      assert(control.userId === null && control.logoutPending)
    })
    statusElement.textContent = "Cierre local y trabajo pendiente comprobados."
    return
  }
  if (query.get("mode") === "switch") {
    await check(
      "Otra cuenta usa otra partición y conserva la cola anterior",
      async () => {
        let control = await readAccountControl()
        assert(control.userId === null)
        control = await completeRemoteLogout(control.epoch)
        const repository = await LocalRepository.open(otherUserId)
        const outbox = await LocalOutbox.open(otherUserId)
        try {
          const timestamp = new Date().toISOString()
          await repository.put("settings", {
            userId: otherUserId,
            timeZone: "Europe/Madrid",
            weekStartsOn: 1,
            locale: "es-ES",
            revision: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: null,
          })
          for (let index = 0; index < 2; index++)
            await outbox.commitItemCommand({
              type: "item.create",
              itemId: crypto.randomUUID(),
              input: taskDraftSchema.parse({
                kind: "task",
                title: `Other account task ${index}`,
                description: "",
                scheduledDate: "2026-10-06",
                status: "not_started",
                checklist: [],
                recurrence: null,
              }),
            })
          await activatePreparedAccount(otherUserId, timestamp, control.epoch)
        } finally {
          repository.close()
          outbox.close()
        }
        const previous = await LocalOutbox.open(userId)
        try {
          assert((await previous.listEntries()).length === 1)
        } finally {
          previous.close()
        }
      }
    )
    statusElement.textContent =
      "Cambio de partición local comprobado con identidad ficticia."
    return
  }
  if (query.get("mode") === "version") {
    await check("Versión nueva activa con datos y cola intactos", async () => {
      const registration =
        await navigator.serviceWorker.getRegistration("/workspace")
      assert(registration?.active && !registration.waiting)
      assert(await isOfflineShellReady())
      assert(
        (await caches.keys()).filter((name) => name.startsWith("dalis-shell:"))
          .length === 1
      )
      const outbox = await LocalOutbox.open(otherUserId)
      try {
        assert((await outbox.listEntries()).length === 2)
      } finally {
        outbox.close()
      }
    })
    statusElement.textContent = "Actualización y persistencia comprobadas."
    return
  }
  assert(!localStorage.getItem(OFFLINE_ACCOUNT_KEY))
  assert((await readAccountControl()).userId === null)
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
        const original = await readAccountControl()
        const hidden = await hideLocalAccount()
        let staleRejected = false
        try {
          await activatePreparedAccount(userId, timestamp, original.epoch)
        } catch {
          staleRejected = true
        }
        assert(staleRejected)
        const current = await completeRemoteLogout(hidden.epoch)
        await activatePreparedAccount(userId, timestamp, current.epoch)
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
