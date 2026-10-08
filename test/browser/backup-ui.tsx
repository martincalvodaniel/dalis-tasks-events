import { createRoot } from "react-dom/client"
import { BackupSettings } from "@/features/workspace/components/backup-settings"
import { decodeLocalBackup } from "@/lib/backup/local-backup"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"

if (location.origin !== "http://127.0.0.1:4187")
  throw new Error("Backup UI requires its dedicated origin")
const runId = crypto.randomUUID()
const userId = `browser-test-${runId}-backup-ui`
const now = new Date().toISOString()
let control = await readAccountControl()
if (control.userId !== null && control.userId !== userId)
  throw new Error("Fixture cannot replace another account")
if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
const prepared = await activatePreparedAccount(userId, now, control.epoch)
const outbox = await LocalOutbox.open(userId)
await outbox.commitItemCommand({
  type: "item.create",
  itemId: crypto.randomUUID(),
  input: {
    kind: "task",
    title: "Copia sin conexión",
    description: "",
    scheduledDate: "2026-10-08",
    status: "in_progress",
    checklist: [],
    recurrence: null,
  },
})
const baseline = JSON.stringify(await outbox.listEntries())
const rootElement = document.getElementById("root")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!rootElement || !status || !actions)
  throw new Error("Fixture markup missing")
const originalFetch = window.fetch
window.fetch = (async () => {
  throw new Error("Fixture network is offline")
}) as unknown as typeof window.fetch
const createUrl = URL.createObjectURL
const click = HTMLAnchorElement.prototype.click
const blobs = new Map<string, Blob>()
let downloads = 0
URL.createObjectURL = (object) => {
  if (!(object instanceof Blob)) throw new Error("Fixture requires a Blob")
  const url = createUrl.call(URL, object)
  blobs.set(url, object)
  return url
}
HTMLAnchorElement.prototype.click = function () {
  if (this.href.startsWith("blob:")) {
    const blob = blobs.get(this.href)
    const filename = this.download
    if (
      !blob ||
      !filename.startsWith("dalis-backup-") ||
      filename.includes(userId)
    )
      throw new Error("Invalid backup download")
    void blob.text().then(async (json) => {
      const backup = decodeLocalBackup(json, userId)
      if (
        Object.keys(backup.stores).length !== 11 ||
        JSON.stringify(backup.stores.outbox) !== baseline ||
        JSON.stringify(await outbox.listEntries()) !== baseline
      )
        throw new Error("Download changed or omitted queue")
      downloads++
      status.textContent = `Descarga ${downloads}: JSON completo y cola exacta; sin conexión; nombre sin cuenta.`
    })
  }
  click.call(this)
}
const root = createRoot(rootElement)
root.render(<BackupSettings account={{ userId, epoch: prepared.epoch }} />)
const change = document.createElement("button")
change.textContent = "Cambiar época de prueba"
change.className = "block min-h-11 px-3"
change.onclick = async () => {
  const current = await readAccountControl()
  await activatePreparedAccount(userId, now, current.epoch)
  status.textContent =
    "Época cambiada; la descarga anterior debe rechazarse sin nuevo archivo."
}
actions.append(change)
const cleanup = document.createElement("button")
cleanup.textContent = "Validar y limpiar prueba"
cleanup.className = "block min-h-11 px-3"
cleanup.onclick = async () => {
  if (
    downloads !== 1 ||
    JSON.stringify(await outbox.listEntries()) !== baseline
  )
    throw new Error("Fixture did not preserve a single requested backup")
  root.unmount()
  outbox.close()
  window.fetch = originalFetch
  URL.createObjectURL = createUrl
  HTMLAnchorElement.prototype.click = click
  for (const url of blobs.keys()) URL.revokeObjectURL(url)
  if ((await readAccountControl()).userId !== userId)
    throw new Error("Cleanup account changed")
  await completeRemoteLogout((await hideLocalAccount()).epoch)
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(localDatabaseName(userId))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Cleanup blocked"))
  })
  status.textContent =
    "Archivo validado; cuenta obsoleta sin descarga; cola intacta y recursos propios limpios."
  cleanup.disabled = true
}
actions.append(cleanup)
