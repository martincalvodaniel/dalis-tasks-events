import { createHttpSyncTransportV2 } from "@/features/sync/http-transport-v2"
import {
  type LocalSyncRuntimeV2,
  openLocalSyncRuntimeV2,
} from "@/features/sync/local-runtime-v2"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { applyLocalPreferenceResult } from "@/lib/local-db/preference-sync-results"
import { applyLocalChangesPageV2 } from "@/lib/local-db/pull-changes-v2"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { decodeLocalOperationOutcome } from "@/lib/sync/local-operation-outcome-v2"
import { validateRemotePushResultV2 } from "@/lib/sync/remote-push-v2"
import { decodeRemoteShadow } from "@/lib/sync/remote-shadow-v2"
import { localPullCursorSchema } from "@/schemas/local-sync"
import {
  mixedSyncBrowserCommandSchema,
  mixedSyncBrowserSnapshotSchema,
} from "@/schemas/mixed-sync-browser-test"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
if (!fixture.origins.includes(location.origin))
  throw new Error("Mixed fixture must use its isolated loopback origin")
const { userId } = fixture
const database = await openLocalDatabase(userId)
const outbox = await LocalOutbox.open(userId)
const sync = await LocalSyncStore.open(userId)
let online = true
let dropResponse = false
const senderId = crypto.randomUUID()
let activeRuntime: LocalSyncRuntimeV2 | null = null
let usedControl = false
const controlMarker = `mixed-sync-control:${fixture.runId}`

async function snapshot() {
  return runLocalTransaction(
    database,
    ["items", "tags", "itemViews", "outbox", "remoteShadows", "syncMetadata"],
    "readonly",
    (context) => {
      const transaction = context.transaction
      const requests = {
        items: transaction.objectStore("items").getAll(),
        tags: transaction.objectStore("tags").getAll(),
        views: transaction.objectStore("itemViews").getAll(),
        entries: transaction.objectStore("outbox").getAll(),
        shadows: transaction.objectStore("remoteShadows").getAll(),
        metadata: transaction.objectStore("syncMetadata").getAll(),
      }
      let remaining = Object.keys(requests).length
      const finish = () => {
        if (--remaining) return
        try {
          const outcomes = requests.metadata.result.filter(
            (value) =>
              value.key?.startsWith("operation-outcome:") || "result" in value
          )
          for (const value of outcomes)
            decodeLocalOperationOutcome(value, userId)
          for (const value of requests.shadows.result)
            decodeRemoteShadow(value, userId)
          const value = mixedSyncBrowserSnapshotSchema.parse({
            items: requests.items.result,
            tags: requests.tags.result,
            views: requests.views.result,
            entries: requests.entries.result.sort(
              (left, right) => left.sequence - right.sequence
            ),
            shadows: requests.shadows.result,
            outcomes,
            cursor: requests.metadata.result.find(
              (record) => record.key === "pull-cursor"
            ) ?? { key: "pull-cursor", after: 0, through: null },
          })
          if (
            value.items.some((record) => record.ownerId !== userId) ||
            [...value.tags, ...value.views, ...value.entries].some(
              (record) => record.userId !== userId
            )
          )
            throw new Error("Mixed fixture snapshot has another account")
          context.setResult(value)
        } catch (error) {
          context.fail(error)
        }
      }
      for (const request of Object.values(requests)) request.onsuccess = finish
    }
  )
}

async function request(path: string, init: RequestInit = {}) {
  if (!online) throw new Error("Fixture network is offline")
  const headers = new Headers(init.headers)
  headers.set("x-sync-test-run", fixture.runId)
  const response = await fetch(path, { ...init, headers, cache: "no-store" })
  if (!response.ok) throw new Error("Mixed fixture request failed")
  return response.json()
}

async function send() {
  if (!online) return { status: "offline", acknowledged: 0, unsupported: 0 }
  await outbox.recoverExpiredSends()
  const entries = (await outbox.listEntries()).sort(
    (left, right) => left.sequence - right.sequence
  )
  let acknowledged = 0
  let unsupported = 0
  for (const entry of entries) {
    if (entry.state !== "pending") continue
    const claimed = await outbox.claim(entry.operation.operationId, senderId)
    if (!claimed) continue
    try {
      const input = remotePushInputV2Schema.parse({
        transportVersion: 2,
        expectedUserId: userId,
        operations: [claimed.operation],
      })
      const response = validateRemotePushResultV2(
        await request("/fixture-push-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
        userId,
        input
      )
      if (dropResponse) {
        dropResponse = false
        await outbox.release(claimed.operation.operationId, senderId)
        return { status: "response_lost", acknowledged, unsupported }
      }
      if (response.status !== "complete")
        throw new Error("Mixed fixture requires a complete single result")
      const result = response.results[0]
      if (claimed.operation.command.type === "task.move") {
        if (
          result.kind !== "preference" ||
          result.outcome.status !== "unsupported"
        )
          throw new Error("Historical movement unexpectedly became supported")
        await outbox.release(claimed.operation.operationId, senderId)
        unsupported++
        continue
      }
      const submission = {
        operation: claimed.operation,
        senderId,
        result,
      }
      const apply = () =>
        result.kind === "preference"
          ? applyLocalPreferenceResult(database, userId, submission)
          : sync.applyOperationResult({ ...submission, result: result.outcome })
      await apply()
      if (result.outcome.status === "applied") {
        const beforeReplay = JSON.stringify(await snapshot())
        if ((await apply()) !== "replayed")
          throw new Error("Mixed ACK did not replay durably")
        if (JSON.stringify(await snapshot()) !== beforeReplay)
          throw new Error("Mixed ACK replay changed local evidence")
        acknowledged++
      }
    } catch (error) {
      await outbox.release(claimed.operation.operationId, senderId)
      throw error
    }
  }
  return { status: "complete", acknowledged, unsupported }
}

async function pull() {
  if (!online) return { status: "offline", pages: 0 }
  let pages = 0
  for (; pages < 100; pages++) {
    const cursor = localPullCursorSchema.parse(await sync.readPullCursor())
    const query = { after: cursor.after, through: cursor.through, limit: 2 }
    const parameters = new URLSearchParams({
      after: String(query.after),
      limit: String(query.limit),
    })
    if (query.through !== null) parameters.set("through", String(query.through))
    const page = remoteChangesPageV2Schema.parse(
      await request(`/fixture-changes-v2?${parameters}`)
    )
    await applyLocalChangesPageV2(database, userId, { query, page })
    if (!page.hasMore) return { status: "complete", pages: pages + 1 }
  }
  throw new Error("Mixed fixture exceeded its page budget")
}

async function coordinate() {
  let control = await readAccountControl()
  if (control.userId === null && !control.logoutPending)
    control = await activatePreparedAccount(
      userId,
      new Date().toISOString(),
      control.epoch
    )
  if (control.userId !== userId || control.logoutPending)
    throw new Error("Mixed coordinator fixture account is not active")
  usedControl = true
  sessionStorage.setItem(controlMarker, "prepared")
  const fixtureFetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    if (!online) throw new Error("Fixture network is offline")
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.origin
    )
    if (url.origin !== location.origin)
      throw new Error("Mixed fixture transport requires its own origin")
    if (url.pathname === "/api/sync/identity")
      url.pathname = "/fixture-identity"
    else if (url.pathname === "/api/sync/changes")
      url.pathname = "/fixture-changes-v2"
    else throw new Error("Mixed fixture transport path is not supported")
    const headers = new Headers(init?.headers)
    headers.set("x-sync-test-run", fixture.runId)
    return fetch(url, { ...init, headers })
  }) as typeof fetch
  const transport = createHttpSyncTransportV2(
    userId,
    async (input) => {
      const result = await request("/fixture-push-v2", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (dropResponse) {
        dropResponse = false
        throw new Error("Fixture response lost after remote commit")
      }
      return result
    },
    fixtureFetch
  )
  const runtime = await openLocalSyncRuntimeV2(
    { userId, epoch: control.epoch },
    transport
  )
  activeRuntime = runtime
  try {
    return await runtime.run()
  } finally {
    await runtime.close()
    if (activeRuntime === runtime) activeRuntime = null
  }
}

function deleteFixtureDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Mixed cleanup is blocked"))
  })
}

async function cleanup() {
  await activeRuntime?.close()
  activeRuntime = null
  outbox.close()
  sync.close()
  database.close()
  await deleteFixtureDatabase(localDatabaseName(userId))
  if (usedControl || sessionStorage.getItem(controlMarker) === "prepared") {
    const control = await readAccountControl()
    if (control.userId !== null && control.userId !== userId)
      throw new Error("Mixed fixture cleanup account changed")
    if (control.userId === userId) await hideLocalAccount()
    if ((await readAccountControl()).userId !== null)
      throw new Error("Mixed fixture control changed before cleanup")
    await deleteFixtureDatabase(ACCOUNT_CONTROL_DATABASE)
    sessionStorage.removeItem(controlMarker)
    usedControl = false
  }
  return true
}

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
    const input = mixedSyncBrowserCommandSchema.parse(event.data.command)
    switch (input.type) {
      case "network":
        online = input.online
        return true
      case "drop-response":
        dropResponse = true
        return true
      case "snapshot":
        return snapshot()
      case "send":
        return send()
      case "pull":
        return pull()
      case "coordinate":
        return coordinate()
      case "cleanup":
        return cleanup()
      case "commit":
        switch (input.command.type) {
          case "tag.save":
          case "tag.delete":
          case "tag.move":
          case "item-view.set":
          case "task.move":
            return outbox.commitPreferenceCommand(input.command)
          case "item.create":
          case "item.update":
          case "item.delete":
          case "task.set-status":
          case "task.set-checklist-entry":
            return outbox.commitItemCommand(input.command)
          default:
            throw new Error("Mixed fixture does not support this command")
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
window.addEventListener("pagehide", () => {
  void activeRuntime?.close()
  outbox.close()
  sync.close()
  database.close()
})
parent.postMessage({ runId: fixture.runId, ready: true }, fixture.origins[0])
