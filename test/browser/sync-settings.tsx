import { createRoot } from "react-dom/client"
import { DeviceSyncSettings } from "@/features/sync/components/device-sync-settings"
import { WorkspaceSyncProvider } from "@/features/sync/components/workspace-sync-provider"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import {
  notifyLocalOutboxChange,
  subscribeLocalOutboxChanges,
} from "@/lib/local-db/sync-notifications"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
const { userId } = fixture
const outbox = await LocalOutbox.open(userId)
const store = await LocalSyncStore.open(userId)
const current = await readAccountControl()
const control = await activatePreparedAccount(
  userId,
  new Date().toISOString(),
  current.epoch
)
const itemId = crypto.randomUUID()
await outbox.commitItemCommand({
  type: "item.create",
  itemId,
  input: {
    kind: "task",
    title: "Prueba de ajustes",
    description: "",
    scheduledDate: "2026-10-08",
    status: "not_started",
    checklist: [],
    recurrence: null,
  },
})
await outbox.commitPreferenceCommand({
  type: "tag.save",
  tagId: crypto.randomUUID(),
  input: { name: "Categoría local", color: "#059669", position: 0 },
})
const rootElement = document.getElementById("root")
const actions = document.getElementById("actions")
const status = document.getElementById("status")
if (!rootElement || !actions || !status)
  throw new Error("Settings fixture markup is missing")
const statusElement = status
const root = createRoot(rootElement)
let notifications = 0
const unsubscribe = subscribeLocalOutboxChanges(userId, () => {
  notifications++
})
notifyLocalOutboxChange("other-fixture-account")
window.dispatchEvent(
  new CustomEvent("dalis:outbox-changed", {
    detail: { type: "OUTBOX_CHANGED", userId, unexpected: true },
  })
)
if (notifications !== 0)
  throw new Error("Foreign or malformed wake messages reached the subscriber")
let expectedItems = 1
const add = document.createElement("button")
add.textContent = "Crear otro cambio local"
add.className = "mt-4 min-h-11 rounded-lg border px-3 text-sm"
actions.append(add)
add.onclick = async () => {
  add.disabled = true
  await outbox.commitItemCommand({
    type: "item.create",
    itemId: crypto.randomUUID(),
    input: {
      kind: "task",
      title: "Cambio local siguiente",
      description: "",
      scheduledDate: "2026-10-08",
      status: "not_started",
      checklist: [],
      recurrence: null,
    },
  })
  expectedItems++
  if (notifications !== 1)
    throw new Error("Committed intent notification was not delivered")
  statusElement.textContent =
    "Segundo cambio guardado; espera su subida automática y valida."
}
root.render(
  <WorkspaceSyncProvider
    account={{ userId, epoch: control.epoch, itemCount: 1, offlineReady: true }}
  >
    <DeviceSyncSettings
      account={{
        userId,
        epoch: control.epoch,
        itemCount: 1,
        offlineReady: true,
      }}
    />
  </WorkspaceSyncProvider>
)
statusElement.textContent =
  "Espera la revisión automática, prueba Sincronizar ahora y valida el resultado."
const button = document.createElement("button")
button.textContent = "Validar y cerrar prueba"
button.className = "mt-4 min-h-11 rounded-lg border px-3 text-sm"
actions.append(button)
button.onclick = async () => {
  button.disabled = true
  const headers = { "x-sync-test-run": fixture.runId }
  let passed = false
  try {
    const summary = await store.readQueueSummary()
    const entries = await outbox.listEntries()
    const response = await fetch("/fixture-items", { headers })
    const items = calendarItemSchema.array().parse(await response.json())
    if (
      summary.pending !== 1 ||
      summary.unsupported !== 1 ||
      summary.conflicts !== 0 ||
      entries.filter((entry) => entry.state === "acknowledged").length !==
        expectedItems ||
      items.length !== expectedItems ||
      !items.some((item) => item.id === itemId) ||
      items.some((item) => item.revision !== 1)
    )
      throw new Error(
        "Settings fixture did not confirm the expected durable state"
      )
    passed = true
    statusElement.textContent =
      "Correcto: tarea confirmada, categoría pendiente y estado real mostrado."
  } catch {
    statusElement.textContent = "Prueba fallida: el estado durable no coincide."
  } finally {
    root.unmount()
    unsubscribe()
    outbox.close()
    store.close()
    await completeRemoteLogout((await hideLocalAccount()).epoch)
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(userId))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Fixture cleanup is blocked"))
    })
    await fetch(passed ? "/fixture-pass" : "/fixture-fail", {
      method: "POST",
      headers,
    })
  }
}
