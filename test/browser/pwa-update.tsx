import { createRoot } from "react-dom/client"
import { SyncStatusPanel } from "@/features/sync/components/sync-status-panel"
import { UpdateNotice } from "@/features/workspace/components/update-notice"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { isOfflineShellReady, prepareOfflineShell } from "@/lib/pwa/client"
import { entityIdSchema } from "@/schemas/primitives"
import { offlineWorkerStatusSchema } from "@/schemas/workspace"

if (location.origin !== "http://127.0.0.1:4186")
  throw new Error("Update fixture requires its dedicated origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const configuration = await (await fetch("/fixture-config")).json()
if (configuration.runId !== runId) throw new Error("Update fixture run changed")
const userId = `browser-test-${runId}-update`
let control = await readAccountControl()
if (control.userId !== null && control.userId !== userId)
  throw new Error("Fixture cannot replace an account")
if (control.logoutPending) control = await completeRemoteLogout(control.epoch)
await activatePreparedAccount(userId, new Date().toISOString(), control.epoch)
const outbox = await LocalOutbox.open(userId)
const repository = await LocalRepository.open(userId)
if (!(await outbox.listEntries()).length)
  await outbox.commitItemCommand({
    type: "item.create",
    itemId: crypto.randomUUID(),
    input: {
      kind: "task",
      title: "Conservar durante actualización",
      description: "",
      scheduledDate: "2026-10-08",
      status: "in_progress",
      checklist: [],
      recurrence: null,
    },
  })
const baseline = JSON.stringify(await outbox.listEntries())
const baselineKey = `browser-test:${runId}:update-baseline`
if (query.get("phase") === "reload") {
  if (localStorage.getItem(baselineKey) !== baseline)
    throw new Error("Reload changed the exact pending queue")
} else localStorage.setItem(baselineKey, baseline)

const rootElement = document.getElementById("root")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!rootElement || !status || !actions)
  throw new Error("Update fixture markup missing")
await prepareOfflineShell()
const root = createRoot(rootElement)
root.render(
  <>
    <SyncStatusPanel
      summary={{
        pending: 1,
        ready: 1,
        waiting: 0,
        blocked: 0,
        unsupported: 0,
        sending: 0,
        conflicts: 0,
        rejected: 0,
      }}
      error={false}
      busy={false}
      result={{ status: "update_required", uploaded: 0, downloaded: 0 }}
      onSync={() => undefined}
    />
    <UpdateNotice />
  </>
)
status.textContent = "Versión inicial preparada; cola pendiente conservada."
const deploy = document.createElement("button")
deploy.className = "block min-h-11 px-3"
deploy.textContent = "Preparar nueva versión ficticia"
deploy.onclick = async () => {
  const response = await fetch("/fixture-deploy", {
    method: "POST",
    headers: { "x-update-test-run": runId },
  })
  if (!response.ok) throw new Error("Fixture deployment failed")
  status.textContent = "Nueva versión servida; comprueba la actualización."
  deploy.disabled = true
}
if (query.get("phase") !== "reload") actions.append(deploy)
async function workerVersion(worker: ServiceWorker) {
  const channel = new MessageChannel()
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      channel.port1.close()
      reject(new Error("Worker status timed out"))
    }, 10000)
    channel.port1.onmessage = (event) => {
      clearTimeout(timer)
      channel.port1.close()
      const result = offlineWorkerStatusSchema.parse(event.data)
      if (!result.ready) reject(new Error("Worker assets incomplete"))
      else resolve(result.version)
    }
    worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2])
  })
}
const verify = document.createElement("button")
verify.className = "block min-h-11 px-3"
verify.textContent =
  query.get("phase") === "reload"
    ? "Validar versión activa y limpiar"
    : "Validar versión en espera"
verify.onclick = async () => {
  const registration =
    await navigator.serviceWorker.getRegistration("/workspace")
  if (!registration?.active) throw new Error("Active worker missing")
  if (JSON.stringify(await outbox.listEntries()) !== baseline)
    throw new Error("Worker update changed queue")
  const items = await repository.list("items")
  if (
    items.length !== 1 ||
    items[0].kind !== "task" ||
    items[0].status !== "in_progress"
  )
    throw new Error("Update changed product data")
  if (query.get("phase") !== "reload") {
    if (
      !registration.waiting ||
      (await workerVersion(registration.active)) !== `fixture:${runId}:v1` ||
      (await workerVersion(registration.waiting)) !== `fixture:${runId}:v2`
    )
      throw new Error("Update did not preserve active worker while waiting")
    status.textContent =
      "Versión nueva en espera; datos y cola exactos. Cierra esta pestaña y verifica tras reabrir."
    return
  }
  if (
    registration.waiting ||
    (await workerVersion(registration.active)) !== `fixture:${runId}:v2` ||
    !(await isOfflineShellReady())
  )
    throw new Error("New version is not ready")
  root.unmount()
  outbox.close()
  repository.close()
  await registration.unregister()
  localStorage.removeItem(baselineKey)
  for (const name of await caches.keys())
    if (name.startsWith(`dalis-shell:fixture:${runId}:`))
      await caches.delete(name)
  const active = await readAccountControl()
  if (active.userId !== userId) throw new Error("Cleanup account changed")
  await completeRemoteLogout((await hideLocalAccount()).epoch)
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(localDatabaseName(userId))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
  })
  status.textContent =
    "Actualización activada tras reabrir; tarea y cola intactas; recursos propios limpios."
  verify.disabled = true
}
actions.append(verify)
