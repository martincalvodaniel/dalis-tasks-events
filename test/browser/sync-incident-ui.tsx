import { createRoot } from "react-dom/client"
import { mutate } from "swr"
import { SyncIncidentDetails } from "@/features/sync/components/sync-incident-details"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userId = `browser-test-${runId}-incident-ui`
let current = await readAccountControl()
if (current.userId !== null && current.userId !== userId)
  throw new Error("Fixture cannot replace another account")
if (current.logoutPending) current = await completeRemoteLogout(current.epoch)
const control = await activatePreparedAccount(
  userId,
  new Date().toISOString(),
  current.epoch
)
const outbox = await LocalOutbox.open(userId)
const store = await LocalSyncStore.open(userId)
const original = JSON.stringify(await outbox.listEntries())
if (query.get("phase") !== "reload") {
  const draft = {
    kind: "task" as const,
    title: "Preparar viaje y revisar detalles pendientes",
    description:
      "Descripción larga para comprobar que la comparación se ajusta al ancho disponible sin ocultar los cambios guardados.",
    scheduledDate: "2026-10-08",
    status: "not_started" as const,
    checklist: [
      {
        id: crypto.randomUUID(),
        text: "Reservar alojamiento",
        completed: false,
      },
    ],
    recurrence: null,
  }
  const itemId = crypto.randomUUID()
  const created = await outbox.commitItemCommand({
    type: "item.create",
    itemId,
    input: draft,
  })
  const senderId = crypto.randomUUID()
  const sent = await outbox.claim(created.operation.operationId, senderId)
  if (!sent) throw new Error("Fixture claim failed")
  await outbox.commitItemCommand({
    type: "task.set-status",
    itemId,
    occurrenceId: null,
    status: "in_progress",
  })
  const now = new Date().toISOString()
  await store.applyOperationResult({
    operation: sent.operation,
    senderId,
    result: {
      status: "conflict",
      operationId: sent.operation.operationId,
      current: {
        ...draft,
        title: "Organizar viaje desde otro dispositivo",
        id: itemId,
        ownerId: userId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: query.get("choice") === "copy" ? now : null,
        completedAt: null,
      },
    },
  })
}
const entries = await outbox.listEntries()
const rootElement = document.getElementById("root")
const statusElement = document.getElementById("status")
const actions = document.getElementById("actions")
if (!rootElement || !statusElement || !actions)
  throw new Error("Fixture markup is missing")
const root = createRoot(rootElement)
root.render(<SyncIncidentDetails account={{ userId, epoch: control.epoch }} />)
if (query.get("phase") !== "reload") {
  const link = document.createElement("a")
  link.textContent = "Verificar tras recarga"
  link.href = `/?run=${runId}&phase=reload${query.get("choice") ? `&choice=${query.get("choice")}` : ""}`
  link.className = "block min-h-11 py-3 text-sm underline"
  actions.append(link)
  const edit = document.createElement("a")
  edit.textContent = "Cambio simulado en otra pestaña"
  edit.href = `/edit?run=${runId}`
  edit.className = "block min-h-11 py-3 text-sm underline"
  actions.append(edit)
}
const verifyCancel = document.createElement("button")
verifyCancel.textContent = "Validar cancelación"
verifyCancel.className = "block min-h-11 py-2 text-sm underline"
verifyCancel.onclick = async () => {
  if (JSON.stringify(await outbox.listEntries()) !== JSON.stringify(entries))
    throw new Error("Cancellation modified the queue")
  statusElement.textContent = "Cancelación sin cambios verificada."
}
actions.append(verifyCancel)
const refresh = document.createElement("button")
refresh.textContent = "Actualizar comparación"
refresh.className = "block min-h-11 py-2 text-sm underline"
refresh.onclick = async () => {
  await mutate(["dalis:sync-incidents", userId, control.epoch])
}
actions.append(refresh)
const button = document.createElement("button")
button.textContent = "Validar y limpiar prueba"
button.className = "mt-2 min-h-11 rounded-lg border px-3 text-sm"
actions.append(button)
button.onclick = async () => {
  const after = await outbox.listEntries()
  if (query.get("choice")) {
    const expectedPending = query.get("choice") === "adopt" ? 0 : 1
    if (
      after.filter((entry) => entry.state === "pending").length !==
        expectedPending ||
      after.filter((entry) => entry.state === "superseded").length < 2 ||
      after.some((entry) => entry.state === "acknowledged")
    )
      throw new Error("Resolution produced incorrect local states")
    if (query.get("choice") === "copy") {
      const repository = await LocalRepository.open(userId)
      try {
        const items = await repository.list("items", { includeDeleted: true })
        const copyEntry = after.find((entry) => entry.state === "pending")
        const command = copyEntry?.operation.command
        const originalId = after.find((entry) => entry.state === "superseded")
          ?.operation.command
        if (
          command?.type !== "item.create" ||
          !originalId ||
          !("itemId" in originalId)
        )
          throw new Error("Copy queue is incomplete")
        const copy = items.find((item) => item.id === command.itemId)
        const old = items.find((item) => item.id === originalId.itemId)
        if (
          items.length !== 2 ||
          !old?.deletedAt ||
          !copy ||
          copy.deletedAt ||
          copy.revision !== 0 ||
          copy.id === old.id ||
          copy.kind !== "task" ||
          copy.status !== "in_progress" ||
          copy.checklist.length !== 1 ||
          copyEntry?.entityKey !== `item:${copy.id}` ||
          copyEntry.operation.baseRevision !== 0
        )
          throw new Error("Copy or original projection is incorrect")
      } finally {
        repository.close()
      }
    }
    for (const original of entries.filter(
      (entry) => entry.state === "conflict"
    )) {
      const preserved = after.find(
        (entry) =>
          entry.operation.operationId === original.operation.operationId
      )
      if (
        JSON.stringify(preserved?.operation) !==
        JSON.stringify(original.operation)
      )
        throw new Error("Resolution changed the original operation")
    }
  } else if (
    JSON.stringify(after) !== JSON.stringify(entries) ||
    (query.get("phase") === "reload" && original !== JSON.stringify(entries))
  )
    throw new Error("Comparison modified the queue")
  root.unmount()
  outbox.close()
  store.close()
  const active = await readAccountControl()
  if (active.userId === userId && active.epoch === control.epoch) {
    const hidden = await hideLocalAccount()
    await completeRemoteLogout(hidden.epoch)
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(localDatabaseName(userId))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
  })
  statusElement.textContent =
    "Estados locales, historial y limpieza verificados."
  button.disabled = true
}
