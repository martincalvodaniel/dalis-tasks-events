import { createRoot } from "react-dom/client"
import { SyncIncidentDetails } from "@/features/sync/components/sync-incident-details"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
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
        deletedAt: null,
        completedAt: null,
      },
    },
  })
}
const entries = JSON.stringify(await outbox.listEntries())
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
  link.href = `/?run=${runId}&phase=reload`
  link.className = "block min-h-11 py-3 text-sm underline"
  actions.append(link)
}
const button = document.createElement("button")
button.textContent = "Validar y limpiar prueba"
button.className = "mt-2 min-h-11 rounded-lg border px-3 text-sm"
actions.append(button)
button.onclick = async () => {
  if (JSON.stringify(await outbox.listEntries()) !== entries)
    throw new Error("Comparison changed the durable queue")
  if (query.get("phase") === "reload" && original !== entries)
    throw new Error("Reload changed the durable queue")
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
    "Comparación sin mutaciones y limpieza verificadas."
  button.disabled = true
}
