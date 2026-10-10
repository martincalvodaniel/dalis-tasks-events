import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { saveLocalPlan } from "@/features/plans/local-plans"
import { createHttpSyncTransportV4 } from "@/features/sync/http-transport-v4"
import {
  type LocalSyncRuntimeV2,
  openLocalPlanSyncRuntime,
} from "@/features/sync/local-runtime-v2"
import type { LocalAccount } from "@/features/workspace/local-account"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { notifyLocalOutboxChange } from "@/lib/local-db/sync-notifications"
import { commitLocalTaskMoveCommand } from "@/lib/local-db/task-move-outbox"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  planSyncBrowserCommandSchema,
  planSyncBrowserSnapshotSchema,
} from "@/schemas/plan-sync-browser-test"
import { userSettingsSchema } from "@/schemas/preferences"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const runId = new URLSearchParams(location.search).get("run")
const fixture = syncBrowserFixtureSchema.parse(
  await (await fetch(`/fixture-config?run=${runId}`)).json()
)
if (!fixture.origins.includes(location.origin))
  throw new Error("Plan fixture requires its isolated loopback origin")
const { userId } = fixture
const ownedDatabase = localDatabaseName(userId)
const marker = `plan-sync-control:${fixture.runId}`
let database: IDBDatabase | null = null
let outbox: LocalOutbox | null = null
let account: LocalAccount | null = null
let runtime: LocalSyncRuntimeV2 | null = null
let online = true
let dropResponse = false

async function prepare() {
  const databases = await indexedDB.databases()
  if (databases.length > 0 && sessionStorage.getItem(marker) !== "owned")
    throw new Error("Plan fixture requires virgin storage before preparation")
  if (
    databases.some(
      (entry) =>
        entry.name !== ownedDatabase && entry.name !== ACCOUNT_CONTROL_DATABASE
    )
  )
    throw new Error("Plan fixture origin has foreign storage")
  if (localStorage.getItem(OFFLINE_ACCOUNT_KEY))
    throw new Error("Plan fixture origin has an existing offline pointer")
  if (
    databases.some((entry) => entry.name === ownedDatabase) &&
    sessionStorage.getItem(marker) !== "owned"
  )
    throw new Error("Plan fixture partition was not created by this run")
  let control = await readAccountControl()
  if (control.userId !== null && control.userId !== userId)
    throw new Error("Plan fixture control belongs to another account")
  if (control.logoutPending)
    throw new Error("Plan fixture control has a pending logout")
  database ??= await openLocalDatabase(userId)
  sessionStorage.setItem(marker, "owned")
  const now = new Date().toISOString()
  await runLocalTransaction(database, ["settings"], "readwrite", (context) => {
    const store = context.transaction.objectStore("settings")
    const request = store.get(userId)
    request.onsuccess = () => {
      try {
        if (request.result === undefined)
          store.put(
            userSettingsSchema.parse({
              userId,
              timeZone: "Europe/Madrid",
              weekStartsOn: 1,
              locale: "es-ES",
              revision: 0,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            })
          )
        else if (userSettingsSchema.parse(request.result).userId !== userId)
          throw new Error("Plan fixture settings belong to another account")
        context.setResult(true)
      } catch (error) {
        context.fail(error)
      }
    }
  })
  if (control.userId === null)
    control = await activatePreparedAccount(userId, now, control.epoch)
  account = { userId, epoch: control.epoch, itemCount: 0, offlineReady: false }
  outbox ??= await LocalOutbox.open(userId)
  return true
}

async function snapshot() {
  if (!database) throw new Error("Plan fixture is not prepared")
  return runLocalTransaction(
    database,
    ["items", "tags", "itemViews", "taskPlacements", "outbox", "syncMetadata"],
    "readonly",
    (context) => {
      const requests = {
        items: context.transaction.objectStore("items").getAll(),
        tags: context.transaction.objectStore("tags").getAll(),
        views: context.transaction.objectStore("itemViews").getAll(),
        placements: context.transaction.objectStore("taskPlacements").getAll(),
        entries: context.transaction.objectStore("outbox").getAll(),
        metadata: context.transaction.objectStore("syncMetadata").getAll(),
      }
      let remaining = Object.keys(requests).length
      const finish = () => {
        if (--remaining !== 0) return
        try {
          const value = planSyncBrowserSnapshotSchema.parse({
            items: requests.items.result,
            tags: requests.tags.result,
            views: requests.views.result,
            placements: requests.placements.result,
            entries: requests.entries.result.sort(
              (left, right) => left.sequence - right.sequence
            ),
            cursor: requests.metadata.result.find(
              (record) => record.key === "pull-cursor"
            ) ?? { key: "pull-cursor", after: 0, through: null },
          })
          if (
            value.items.some((item) => item.ownerId !== userId) ||
            [
              ...value.tags,
              ...value.views,
              ...value.placements,
              ...value.entries,
            ].some((record) => record.userId !== userId)
          )
            throw new Error("Plan fixture snapshot has another account")
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
  if (!online) throw new Error("Plan fixture network is offline")
  const headers = new Headers(init.headers)
  headers.set("x-sync-test-run", fixture.runId)
  const response = await fetch(path, { ...init, headers, cache: "no-store" })
  if (!response.ok) throw new Error("Plan fixture request failed")
  return response.json()
}
async function run() {
  if (!account) throw new Error("Plan fixture account is not prepared")
  const fixtureFetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    if (!online) throw new Error("Plan fixture network is offline")
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.origin
    )
    if (url.origin !== location.origin)
      throw new Error("Plan fixture transport requires its own origin")
    if (url.pathname === "/api/sync/identity")
      url.pathname = "/fixture-identity"
    else if (url.pathname === "/api/sync/changes")
      url.pathname = "/fixture-changes-v2"
    else throw new Error("Plan fixture transport path is unsupported")
    const headers = new Headers(init?.headers)
    headers.set("x-sync-test-run", fixture.runId)
    return fetch(url, { ...init, headers })
  }) as typeof fetch
  const transport = createHttpSyncTransportV4(
    userId,
    async (input) => {
      const response = await request("/fixture-push-v2", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (dropResponse) {
        dropResponse = false
        throw new Error("Plan fixture response lost after remote commit")
      }
      return response
    },
    fixtureFetch
  )
  runtime = await openLocalPlanSyncRuntime(account, transport)
  try {
    return await runtime.run()
  } finally {
    await runtime.close()
    runtime = null
  }
}
function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error("Plan fixture cleanup is blocked"))
  })
}
async function cleanup() {
  if (sessionStorage.getItem(marker) !== "owned")
    throw new Error("Plan fixture cleanup lacks storage ownership")
  const control = await readAccountControl()
  if (control.userId !== null && control.userId !== userId)
    throw new Error("Plan fixture account changed before cleanup")
  await runtime?.close()
  runtime = null
  outbox?.close()
  outbox = null
  database?.close()
  database = null
  await deleteDatabase(ownedDatabase)
  if (control.userId === userId) await hideLocalAccount()
  if ((await readAccountControl()).userId !== null)
    throw new Error("Plan fixture control changed during cleanup")
  await deleteDatabase(ACCOUNT_CONTROL_DATABASE)
  sessionStorage.removeItem(marker)
  localStorage.removeItem("dalis:account-change")
  account = null
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
    const input = planSyncBrowserCommandSchema.parse(event.data.command)
    switch (input.type) {
      case "prepare":
        return prepare()
      case "network":
        online = input.online
        return true
      case "drop-response":
        dropResponse = true
        return true
      case "snapshot":
        return snapshot()
      case "run":
        return run()
      case "cleanup":
        return cleanup()
      case "save":
        if (!account) throw new Error("Plan fixture is not prepared")
        return saveLocalPlan(account, input.request)
      case "commit":
        if (!outbox || !database || !account)
          throw new Error("Plan fixture is not prepared")
        switch (input.command.type) {
          case "task.move": {
            const entry = await commitLocalTaskMoveCommand(
              database,
              userId,
              input.command,
              {},
              true
            )
            notifyLocalOutboxChange(userId)
            return entry
          }
          case "tag.save":
          case "tag.delete":
          case "tag.move":
          case "item-view.set":
            return outbox.commitPreferenceCommand(input.command)
          case "item.create":
          case "item.update":
          case "item.delete":
          case "plan.set-status":
          case "plan.set-checklist-entry":
          case "task.set-status":
          case "task.set-checklist-entry":
            return outbox.commitItemCommand(input.command)
          default:
            throw new Error("Plan fixture command is unsupported")
        }
    }
  })
  previous = work.catch(() => undefined)
  void work
    .then(
      (value) => port.postMessage({ ok: true, value }),
      (error) =>
        port.postMessage({
          ok: false,
          reason:
            error instanceof Error ? error.message : "Fixture command failed",
        })
    )
    .finally(() => port.close())
})
window.addEventListener("pagehide", () => {
  void runtime?.close()
  outbox?.close()
  database?.close()
})
parent.postMessage({ runId: fixture.runId, ready: true }, fixture.origins[0])
