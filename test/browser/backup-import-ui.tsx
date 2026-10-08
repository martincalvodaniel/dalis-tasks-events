import { createRoot } from "react-dom/client"
import { BackupSettings } from "@/features/workspace/components/backup-settings"
import { encodeLocalBackup } from "@/lib/backup/local-backup"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"

if (location.origin !== "http://127.0.0.1:4189")
  throw new Error("Import UI requires its dedicated origin")
const userId = `browser-test-${crypto.randomUUID()}-import-ui`
const now = new Date().toISOString()
let control = await readAccountControl()
if (control.userId !== null)
  throw new Error("Fixture cannot replace another account")
if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
const account = {
  userId,
  epoch: (await activatePreparedAccount(userId, now, control.epoch)).epoch,
}
const outbox = await LocalOutbox.open(userId)
const originalId = crypto.randomUUID()
await outbox.commitItemCommand({
  type: "item.create",
  itemId: originalId,
  input: {
    kind: "task",
    title: "Tarea de prueba",
    description: "Descripción conservada",
    scheduledDate: "2026-10-08",
    status: "in_progress",
    checklist: [
      { id: crypto.randomUUID(), text: "Paso de prueba", completed: true },
    ],
    recurrence: null,
  },
})
const database = await openLocalDatabase(userId)
const snapshot = () =>
  readLocalBackup(database, userId, new Date().toISOString())
const source = await snapshot()
const baseline = JSON.stringify(source.stores)
const json = encodeLocalBackup(source, userId)
const rootElement = document.getElementById("root")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!rootElement || !status || !actions)
  throw new Error("Fixture markup missing")
const statusElement = status
const actionButtons = actions
const root = createRoot(rootElement)
root.render(<BackupSettings account={account} />)
const fetch = window.fetch
window.fetch = (async () => {
  throw new Error("Fixture network is offline")
}) as unknown as typeof window.fetch
function action(label: string, work: () => Promise<void>) {
  const button = document.createElement("button")
  button.textContent = label
  button.className = "block min-h-11 px-3"
  button.onclick = () =>
    void work().catch((error) => {
      statusElement.textContent = `ERROR: ${error instanceof Error ? error.message : "Unknown fixture error"}`
    })
  actionButtons.append(button)
}
function choose(content: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Fixture file input not mounted")
  const files = new DataTransfer()
  files.items.add(
    new File([content], "fixture.json", { type: "application/json" })
  )
  input.files = files.files
  input.dispatchEvent(new Event("change", { bubbles: true }))
}
action("Cargar archivo propio de prueba", async () => {
  choose(json)
})
action("Cargar archivo inválido de prueba", async () => {
  choose("{}")
})
action("Cargar archivo ajeno de prueba", async () => {
  choose(json.replaceAll(userId, `${userId}-other`))
})
action("Comprobar que todavía no se ha escrito", async () => {
  if (JSON.stringify((await snapshot()).stores) !== baseline)
    throw new Error("Preview or cancellation wrote data")
  statusElement.textContent =
    "Correcto: lectura, selección y cancelación sin escrituras ni red."
})
action("Modificar datos durante confirmación", async () => {
  await outbox.commitItemCommand({
    type: "item.update",
    itemId: originalId,
    input: {
      kind: "task",
      title: "Actualizada durante confirmación",
      description: "Descripción conservada",
      scheduledDate: "2026-10-08",
      status: "in_progress",
      checklist: [],
      recurrence: null,
    },
  })
})
action("Comprobar rechazo obsoleto", async () => {
  const current = await snapshot()
  if (
    current.stores.items.length !== 1 ||
    current.stores.outbox.length !== 2 ||
    current.stores.syncMetadata.some((record) =>
      record.key.startsWith("backup-import:")
    )
  )
    throw new Error("Stale confirmation wrote copies")
  statusElement.textContent =
    "Correcto: comparación obsoleta rechazada, original actualizado y sin copias."
})
action("Validar importación y limpiar", async () => {
  const current = await snapshot()
  const copy = current.stores.items.find((item) => item.id !== originalId)
  const receipt = current.stores.syncMetadata.find(
    (record) => "importId" in record
  )
  if (
    current.stores.items.length !== 2 ||
    current.stores.outbox.length !== 3 ||
    !copy ||
    copy.title !== "Tarea de prueba" ||
    copy.kind !== "task" ||
    copy.status !== "in_progress" ||
    !copy.checklist[0]?.completed ||
    !receipt ||
    !("sourceJson" in receipt) ||
    receipt.sourceJson !== json ||
    current.stores.items.find((item) => item.id === originalId)?.title !==
      "Actualizada durante confirmación"
  )
    throw new Error(
      "Confirmation did not preserve original, progress, queue or receipt"
    )
  controlsObserver.disconnect()
  root.unmount()
  outbox.close()
  database.close()
  window.fetch = fetch
  if ((await readAccountControl()).userId !== userId)
    throw new Error("Cleanup account changed")
  await completeRemoteLogout((await hideLocalAccount()).epoch)
  for (const name of [localDatabaseName(userId), ACCOUNT_CONTROL_DATABASE])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Cleanup blocked"))
    })
  statusElement.textContent =
    "Correcto: una sola copia, progreso y archivo exactos; original conservado, cola pending; sin red y recursos propios limpios."
})
const controlsObserver = new MutationObserver(() => {
  const dialog = document.querySelector("dialog[open]")
  if (dialog && actionButtons.parentElement !== dialog)
    dialog.append(actionButtons)
  else if (!dialog && actionButtons.parentElement !== document.body)
    document.body.append(actionButtons)
})
controlsObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["open"],
})
