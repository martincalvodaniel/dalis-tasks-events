import { createHttpSyncTransport } from "@/features/sync/http-transport"
import { resolveSyncIncident } from "@/features/sync/local-incidents"
import { openLocalSyncRuntime } from "@/features/sync/local-runtime"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { remoteShadowSchema } from "@/schemas/local-sync"
import {
  syncBrowserCommandSchema,
  syncBrowserFixtureSchema,
} from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
const { userId } = fixture
let online = true
let dropResponse = false
const outbox = await LocalOutbox.open(userId)
const repository = await LocalRepository.open(userId)
const sync = await LocalSyncStore.open(userId)
let control = await readAccountControl()
if (control.userId === null && !control.logoutPending)
  control = await activatePreparedAccount(
    userId,
    new Date().toISOString(),
    control.epoch
  )
if (control.userId !== userId || control.logoutPending)
  throw new Error("Browser fixture account is not active")
const testFetch = (async (input: RequestInfo | URL, options?: RequestInit) => {
  if (!online) throw new Error("Fixture network is offline")
  const headers = new Headers(options?.headers)
  headers.set("x-sync-test-run", fixture.runId)
  return fetch(input, { ...options, headers })
}) as typeof fetch
async function readShadows() {
  const database = await openLocalDatabase(userId)
  try {
    return await runLocalTransaction(
      database,
      ["remoteShadows"],
      "readonly",
      (context) => {
        const request = context.transaction
          .objectStore("remoteShadows")
          .getAll()
        request.onsuccess = () => {
          try {
            context.setResult(remoteShadowSchema.array().parse(request.result))
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  } finally {
    database.close()
  }
}
const transport = createHttpSyncTransport(
  userId,
  async (input) => {
    const response = await testFetch("/fixture-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!response.ok) throw new Error("Fixture push request failed")
    const result: unknown = await response.json()
    if (dropResponse) {
      dropResponse = false
      throw new Error("Fixture response lost after remote commit")
    }
    return result
  },
  testFetch
)
const runtime = await openLocalSyncRuntime(
  { userId, epoch: control.epoch },
  transport
)
const status = document.getElementById("status")
if (status) status.textContent = "Dispositivo de prueba preparado"
let previous: Promise<unknown> = Promise.resolve()
window.addEventListener("message", (event) => {
  if (
    event.source !== parent ||
    event.origin !== fixture.origins[0] ||
    event.data?.runId !== fixture.runId ||
    event.ports.length !== 1
  )
    return
  const port = event.ports[0]
  const work = previous.then(async () => {
    const input = syncBrowserCommandSchema.parse(event.data.command)
    switch (input.type) {
      case "network":
        online = input.online
        return true
      case "drop-response":
        dropResponse = true
        return true
      case "commit": {
        if (
          input.command.type !== "item.create" &&
          input.command.type !== "item.update" &&
          input.command.type !== "item.delete" &&
          input.command.type !== "task.set-status" &&
          input.command.type !== "task.set-checklist-entry"
        )
          throw new Error("Fixture requires an item command")
        return outbox.commitItemCommand(input.command)
      }
      case "run":
        return runtime.run()
      case "resolve":
        return resolveSyncIncident(
          { userId, epoch: control.epoch },
          input.request
        )
      case "snapshot":
        return {
          summary: await sync.readQueueSummary(),
          items: await repository.list("items", { includeDeleted: true }),
          entries: await outbox.listEntries(),
          shadows: await readShadows(),
          cursor: await sync.readPullCursor(),
          incidents: await sync.readIncidents(),
        }
      case "cleanup": {
        const current = await readAccountControl()
        if (current.userId !== userId)
          throw new Error("Fixture cleanup account changed")
        await runtime.close()
        outbox.close()
        repository.close()
        sync.close()
        await completeRemoteLogout((await hideLocalAccount()).epoch)
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(localDatabaseName(userId))
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
          request.onblocked = () =>
            reject(new Error("Fixture cleanup is blocked"))
        })
        return true
      }
    }
  })
  previous = work.catch(() => undefined)
  void work
    .then(
      (value) => port.postMessage({ ok: true, value }),
      () => port.postMessage({ ok: false })
    )
    .finally(() => port.close())
})
parent.postMessage({ runId: fixture.runId, ready: true }, fixture.origins[0])
