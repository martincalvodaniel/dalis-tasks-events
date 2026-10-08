import { readAccountControl } from "@/lib/local-db/account-control"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1")
  throw new Error("Fixture requires loopback")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const userId = `browser-test-${runId}-incident-ui`
const control = await readAccountControl()
if (control.userId !== userId || control.logoutPending)
  throw new Error("Fixture account is not active")
const outbox = await LocalOutbox.open(userId)
const store = await LocalSyncStore.open(userId)
try {
  const incident = (await store.readIncidents())[0]
  if (!incident?.local) throw new Error("Fixture incident is missing")
  await outbox.commitItemCommand({
    type: "task.set-status",
    itemId: incident.local.id,
    occurrenceId: null,
    status: "completed",
  })
  const status = document.getElementById("status")
  if (status) status.textContent = "Cambio local desde otra pestaña guardado."
} finally {
  outbox.close()
  store.close()
}
