"use client"

import { useEffect } from "react"
import { createRoot } from "react-dom/client"
import { SWRConfig, unstable_serialize, useSWRConfig } from "swr"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { PlanReleaseBoundary } from "@/features/plans/components/plan-release-boundary"
import {
  confirmLocalPlanReset,
  readLocalPlanRelease,
} from "@/features/plans/local-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { readLocalBackup } from "@/lib/local-db/backup"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import {
  prepareLocalCommonPlanRelease,
  requireLocalCommonPlanRelease,
  resetLocalCommonPlanContent,
} from "@/lib/local-db/common-plan-local-release"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import {
  commonPlanContentStores,
  commonPlanLocalReleaseSchema,
} from "@/schemas/common-plan-local-release"
import { entityIdSchema } from "@/schemas/primitives"

if (location.origin !== "http://127.0.0.1:4241")
  throw new Error("Local release proof requires its isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-common-plan-release`
const marker = `dalis:common-plan-release-proof:${runId}`
const mountKey = `${marker}:mounts`
const baselineKey = `${marker}:baseline`
const controlKey = `${marker}:control`
const previousChangeKey = `${marker}:previous-change`
const sessionKey = `${marker}:session`
const phaseKey = `${marker}:phase`
const accountChangeKey = "dalis:account-change"
const timestamp = "2026-10-11T10:00:00.000Z"
const ownedUsers = [
  userId,
  `${userId}-guards`,
  `${userId}-rollback`,
  `${userId}-race`,
]
const allStores = [...commonPlanContentStores, "settings"]
const reload = query.get("phase") === "reload"

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejects(work: () => Promise<unknown>, message: string) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected, message)
}
async function snapshot(database: IDBDatabase): Promise<string> {
  return runLocalTransaction(database, allStores, "readonly", (context) => {
    const records: Record<string, unknown[]> = {}
    let remaining = allStores.length
    for (const name of allStores) {
      const request = context.transaction.objectStore(name).getAll()
      request.onsuccess = () => {
        records[name] = request.result
        if (--remaining === 0)
          context.setResult(
            JSON.stringify(allStores.map((store) => records[store]))
          )
      }
    }
  })
}
async function seedContent(database: IDBDatabase, partitionUserId: string) {
  await runLocalTransaction(database, allStores, "readwrite", (context) => {
    const id = crypto.randomUUID()
    for (const name of commonPlanContentStores) {
      // Deliberately old raw records exercise reset without trusting their schema.
      context.transaction.objectStore(name).put({
        id,
        itemId: id,
        occurrenceId: id,
        scope: "day",
        date: "2026-10-11",
        userId: partitionUserId,
        operation: { operationId: id },
        entityKey: `item:${id}`,
        key: "old-content",
        sequence: 1,
        title: "Contenido anterior",
      })
    }
    context.transaction.objectStore("settings").put({
      userId: partitionUserId,
      timeZone: "Europe/Madrid",
      weekStartsOn: 1,
      locale: "es-ES",
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    })
    context.setResult(undefined)
  })
}
function resetInput() {
  return { operationId: crypto.randomUUID(), preparedAt: timestamp }
}
async function putMarker(database: IDBDatabase, value: unknown) {
  return runLocalTransaction(
    database,
    ["syncMetadata"],
    "readwrite",
    (context) => {
      context.transaction.objectStore("syncMetadata").put(value)
      context.setResult(undefined)
    }
  )
}
async function runGuardProofs() {
  const database = await openLocalDatabase(ownedUsers[1])
  try {
    assert(
      (await prepareLocalCommonPlanRelease(database, ownedUsers[1], timestamp))
        .status === "ready",
      "Fresh empty partition must prepare automatically"
    )
    await requireLocalCommonPlanRelease(database, ownedUsers[1])
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction.objectStore("syncMetadata").clear()
        context.setResult(undefined)
      }
    )
    await seedContent(database, ownedUsers[1])
    const partitionBaseline = await snapshot(database)
    await rejects(
      () => requireLocalCommonPlanRelease(database, ownedUsers[1]),
      "Old partition was accepted without preparation"
    )
    await rejects(
      () => prepareLocalCommonPlanRelease(database, userId, timestamp),
      "Wrong partition preparation was accepted"
    )
    await rejects(
      () => resetLocalCommonPlanContent(database, userId, resetInput()),
      "Wrong partition reset was accepted"
    )
    await rejects(
      () => requireLocalCommonPlanRelease(database, userId),
      "Wrong partition requirement was accepted"
    )
    assert(
      (await snapshot(database)) === partitionBaseline,
      "Wrong partition rejection changed existing content"
    )
    for (const value of [
      { key: "common-plan-release", version: 3 },
      {
        key: "common-plan-release",
        version: 4,
        userId,
        preparedAt: timestamp,
        operationId: null,
      },
    ]) {
      await putMarker(database, value)
      const before = await snapshot(database)
      await rejects(
        () => prepareLocalCommonPlanRelease(database, ownedUsers[1], timestamp),
        "Invalid marker preparation was accepted"
      )
      await rejects(
        () =>
          resetLocalCommonPlanContent(database, ownedUsers[1], resetInput()),
        "Invalid marker reset was accepted"
      )
      await rejects(
        () => requireLocalCommonPlanRelease(database, ownedUsers[1]),
        "Invalid marker requirement was accepted"
      )
      await rejects(
        () => readLocalBackup(database, ownedUsers[1], timestamp),
        "Invalid marker backup was accepted"
      )
      assert(
        (await snapshot(database)) === before,
        "Rejected marker operation erased content"
      )
    }
  } finally {
    database.close()
  }
  const rollbackDatabase = await openLocalDatabase(ownedUsers[2])
  try {
    await seedContent(rollbackDatabase, ownedUsers[2])
    const before = await snapshot(rollbackDatabase)
    const originalAdd = IDBObjectStore.prototype.add
    let injected = false
    IDBObjectStore.prototype.add = function (
      value: unknown,
      key?: IDBValidKey
    ) {
      if (
        this.transaction.db.name === rollbackDatabase.name &&
        this.name === "syncMetadata" &&
        typeof value === "object" &&
        value !== null &&
        "key" in value &&
        value.key === "common-plan-release"
      ) {
        injected = true
        throw new DOMException(
          "Injected marker failure after queued clears",
          "DataError"
        )
      }
      return key === undefined
        ? originalAdd.call(this, value)
        : originalAdd.call(this, value, key)
    }
    try {
      await rejects(
        () =>
          resetLocalCommonPlanContent(
            rollbackDatabase,
            ownedUsers[2],
            resetInput()
          ),
        "Injected reset failure unexpectedly committed"
      )
    } finally {
      IDBObjectStore.prototype.add = originalAdd
    }
    assert(injected, "Marker failure injection did not run")
    assert(
      (await snapshot(rollbackDatabase)) === before,
      "Reset rollback failed to preserve data and outbox"
    )
  } finally {
    rollbackDatabase.close()
  }
  const raceDatabase = await openLocalDatabase(ownedUsers[3])
  try {
    await seedContent(raceDatabase, ownedUsers[3])
    const input = resetInput()
    const first = resetLocalCommonPlanContent(
      raceDatabase,
      ownedUsers[3],
      input
    )
    const write = runLocalTransaction(
      raceDatabase,
      ["items"],
      "readwrite",
      (context) => {
        context.transaction
          .objectStore("items")
          .put({ id: runId, title: "Contenido nuevo" })
        context.setResult(undefined)
      }
    )
    const replay = resetLocalCommonPlanContent(
      raceDatabase,
      ownedUsers[3],
      input
    )
    await Promise.all([first, write, replay])
    const preserved = await snapshot(raceDatabase)
    assert(
      preserved.includes("Contenido nuevo"),
      "Concurrent reset replay erased new content"
    )
    await resetLocalCommonPlanContent(raceDatabase, ownedUsers[3], resetInput())
    assert(
      (await snapshot(raceDatabase)) === preserved,
      "Repeated reset erased new content"
    )
  } finally {
    raceDatabase.close()
  }
}

const rootElement = document.getElementById("root")
const statusElement = document.getElementById("status")
const actionsElement = document.getElementById("actions")
if (!rootElement || !statusElement || !actionsElement)
  throw new Error("Local release proof markup is missing")
const status = statusElement
const actions = actionsElement
function reportFailure(error: unknown) {
  status.textContent = "Verificación fallida; los datos de prueba se conservan."
  status.dataset.result = "failed"
  console.error(
    error instanceof Error ? error.message : "Local release proof failed"
  )
}
const existing = await indexedDB.databases()
if (reload) {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Reload run ownership is missing"
  )
  assert(
    sessionStorage.getItem(phaseKey) === "ready",
    "Reload requires verified preparation"
  )
} else {
  assert(
    !existing.some(
      (entry) =>
        entry.name === ACCOUNT_CONTROL_DATABASE ||
        ownedUsers.some((id) => entry.name === localDatabaseName(id))
    ),
    "Existing database blocks isolated release proof"
  )
  assert(
    localStorage.getItem(OFFLINE_ACCOUNT_KEY) === null,
    "Foreign legacy account blocks isolated release proof"
  )
  assert(
    localStorage.getItem(sessionKey) === null,
    "Existing session sentinel blocks release proof"
  )
  sessionStorage.setItem(marker, "owned")
  sessionStorage.setItem(mountKey, "0")
  sessionStorage.setItem(
    previousChangeKey,
    JSON.stringify(localStorage.getItem(accountChangeKey))
  )
  localStorage.setItem(sessionKey, runId)
  await runGuardProofs()
}
let control = await readAccountControl()
if (!reload) {
  assert(
    control.userId === null && !control.logoutPending,
    "Foreign active account blocks release proof"
  )
  const database = await openLocalDatabase(userId)
  try {
    await seedContent(database, userId)
    sessionStorage.setItem(baselineKey, await snapshot(database))
  } finally {
    database.close()
  }
  control = await activatePreparedAccount(userId, timestamp, control.epoch)
  sessionStorage.setItem(controlKey, JSON.stringify(control))
}
const account: LocalAccount = {
  userId,
  epoch: control.epoch,
  itemCount: 1,
  offlineReady: false,
}
async function verifyIdentity() {
  assert(
    JSON.stringify(await readAccountControl()) ===
      sessionStorage.getItem(controlKey),
    "Preparation changed account control"
  )
  assert(
    localStorage.getItem(sessionKey) === runId,
    "Preparation changed the session sentinel"
  )
}
await verifyIdentity()
const staleCacheData = [{ id: runId, title: "Contenido anterior en memoria" }]
const accountCacheKeys = ["dalis:local-tags", "dalis:local-plans"].map(
  (key) => [key, account.userId, account.epoch] as const
)
const foreignCacheKey = [
  "dalis:local-tags",
  `${account.userId}-foreign-cache`,
  account.epoch,
] as const
const fixtureCache = new Map<string, { data?: unknown; _k?: unknown }>()
for (const key of [...(!reload ? accountCacheKeys : []), foreignCacheKey])
  fixtureCache.set(unstable_serialize(key), { data: staleCacheData, _k: key })
export function ReleasedContentProbe() {
  const { cache } = useSWRConfig()
  // Check during render: stale data must be gone before protected children mount.
  for (const key of accountCacheKeys)
    assert(
      cache.get(unstable_serialize(key))?.data === undefined,
      "Protected content rendered before stale account caches were cleared"
    )
  useEffect(() => {
    sessionStorage.setItem(
      mountKey,
      String(Number(sessionStorage.getItem(mountKey)) + 1)
    )
  }, [])
  return (
    <p data-release-probe="ready" className="rounded border p-3">
      Contenido común disponible
    </p>
  )
}
const root = createRoot(rootElement)
root.render(
  <SWRConfig
    value={{ shouldRetryOnError: false, provider: () => fixtureCache }}
  >
    <PlanReleaseBoundary account={account}>
      <ReleasedContentProbe />
    </PlanReleaseBoundary>
  </SWRConfig>
)
status.textContent = reload
  ? "Recarga preparada: verifica la persistencia."
  : "Guardias, rollback y concurrencia correctos. Abre la confirmación y cancela primero."
status.dataset.result = reload ? "reloaded" : "guards-passed"
function button(label: string, work: () => Promise<void>) {
  const element = document.createElement("button")
  element.textContent = label
  element.className = "min-h-11 rounded border px-3 text-sm"
  element.onclick = () => {
    void work().catch(reportFailure)
  }
  actions.append(element)
  return element
}
button("Verificar cancelación", async () => {
  assert(
    !document.querySelector('[role="dialog"]'),
    "Confirmation remains open"
  )
  assert(
    !document.querySelector('[data-release-probe="ready"]') &&
      sessionStorage.getItem(mountKey) === "0",
    "Protected child mounted before consent"
  )
  for (const key of accountCacheKeys)
    assert(
      fixtureCache.get(unstable_serialize(key))?.data === staleCacheData,
      "Cancellation cleared the old account cache"
    )
  const database = await openLocalDatabase(userId)
  try {
    assert(
      (await snapshot(database)) === sessionStorage.getItem(baselineKey),
      "Cancellation changed old content"
    )
    const state = await readLocalPlanRelease(account)
    assert(
      state.status === "reset_required" && state.recordCount === 10,
      "Old content no longer requires confirmation"
    )
    await rejects(
      () =>
        confirmLocalPlanReset(
          { ...account, epoch: crypto.randomUUID() },
          crypto.randomUUID()
        ),
      "Inactive account reset was accepted"
    )
    assert(
      (await snapshot(database)) === sessionStorage.getItem(baselineKey),
      "Inactive account reset changed old content"
    )
    await verifyIdentity()
    status.textContent =
      "Correcto: cancelar conserva los diez almacenes y las cachés; el contenido sigue sin montar."
    status.dataset.result = "cancel-passed"
  } finally {
    database.close()
  }
})
async function verifyReady() {
  assert(
    document.querySelector('[data-release-probe="ready"]') &&
      Number(sessionStorage.getItem(mountKey)) > 0,
    "Protected child did not mount after consent"
  )
  for (const key of accountCacheKeys)
    assert(
      fixtureCache.get(unstable_serialize(key))?.data === undefined,
      "Preparation left stale account caches"
    )
  assert(
    fixtureCache.get(unstable_serialize(foreignCacheKey))?.data ===
      staleCacheData,
    "Preparation cleared another account's cache"
  )
  const database = await openLocalDatabase(userId)
  try {
    await requireLocalCommonPlanRelease(database, userId)
    const backup = await readLocalBackup(database, userId, timestamp)
    for (const name of commonPlanContentStores)
      assert(
        backup.stores[name].length === 0,
        "Reset left former content or portable marker"
      )
    assert(
      backup.stores.settings.length === 1 &&
        backup.stores.settings[0].userId === userId,
      "Reset erased settings"
    )
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readonly",
      (context) => {
        const request = context.transaction.objectStore("syncMetadata").getAll()
        request.onsuccess = () => {
          try {
            assert(
              request.result.length === 1,
              "Reset did not leave exactly one release marker"
            )
            const release = commonPlanLocalReleaseSchema.parse(
              request.result[0]
            )
            assert(
              release.userId === userId && release.operationId !== null,
              "Reset marker lost confirmation identity"
            )
            context.setResult(undefined)
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
    await verifyIdentity()
    sessionStorage.setItem(phaseKey, "ready")
    status.textContent = reload
      ? "Correcto: preparación persistente tras recarga; ajustes y sesión conservados."
      : "Correcto: diez almacenes limpios y cachés vacías antes de montar; ajustes y sesión conservados; backup sin marcador."
    status.dataset.result = reload ? "reload-passed" : "ready-passed"
  } finally {
    database.close()
  }
}
button("Verificar preparación", verifyReady)
const reloadLink = document.createElement("a")
reloadLink.textContent = "Recargar prueba"
reloadLink.className = "inline-flex min-h-11 items-center underline"
reloadLink.href = `/?run=${runId}&phase=reload`
actions.append(reloadLink)
const cleanup = button("Limpiar prueba", async () => {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Cleanup ownership is missing"
  )
  await verifyIdentity()
  root.unmount()
  const hidden = await hideLocalAccount()
  const closed = await completeRemoteLogout(hidden.epoch)
  assert(
    closed.userId === null &&
      !closed.logoutPending &&
      closed.epoch === hidden.epoch,
    "Owned account closure changed"
  )
  const changeAfterClosure = localStorage.getItem(accountChangeKey)
  for (const name of [
    ...ownedUsers.map(localDatabaseName),
    ACCOUNT_CONTROL_DATABASE,
  ])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned release proof cleanup is blocked"))
    })
  if (localStorage.getItem(accountChangeKey) === changeAfterClosure) {
    const previous = JSON.parse(
      sessionStorage.getItem(previousChangeKey) ?? "null"
    ) as string | null
    if (previous === null) localStorage.removeItem(accountChangeKey)
    else localStorage.setItem(accountChangeKey, previous)
  }
  if (localStorage.getItem(sessionKey) === runId)
    localStorage.removeItem(sessionKey)
  for (const key of [
    marker,
    mountKey,
    baselineKey,
    controlKey,
    previousChangeKey,
    phaseKey,
  ])
    sessionStorage.removeItem(key)
  assert(
    !(await indexedDB.databases()).some(
      (entry) =>
        entry.name === ACCOUNT_CONTROL_DATABASE ||
        ownedUsers.some((id) => entry.name === localDatabaseName(id))
    ),
    "Owned databases remain after cleanup"
  )
  status.textContent = "Correcto: prueba y bases propias eliminadas."
  status.dataset.result = "cleanup-passed"
  for (const element of actions.querySelectorAll("button"))
    element.disabled = true
  cleanup.disabled = true
})
