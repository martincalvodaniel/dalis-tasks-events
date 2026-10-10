import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import {
  LOCAL_DATABASE_VERSION,
  migrateLocalDatabase,
} from "@/lib/local-db/migrations"
import { commitLocalPlanSave } from "@/lib/local-db/plan-outbox"
import { commitLocalPreferenceCommand } from "@/lib/local-db/preference-outbox"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import type { PlanSaveRequest } from "@/schemas/plan-save"
import { entityIdSchema } from "@/schemas/primitives"
import type { Plan } from "@/types/plan-item"
import type { ItemView } from "@/types/preferences"

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejects(work: () => Promise<unknown>) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected, "Plan save should have rejected the operation")
}
function snapshot(database: IDBDatabase) {
  const stores = ["items", "itemViews", "outbox", "syncMetadata"]
  return runLocalTransaction<Record<string, unknown[]>>(
    database,
    stores,
    "readonly",
    (context) => {
      const result: Record<string, unknown[]> = {}
      let remaining = stores.length
      for (const name of stores) {
        const request = context.transaction.objectStore(name).getAll()
        request.onsuccess = () => {
          result[name] = request.result
          if (--remaining === 0) context.setResult(result)
        }
      }
    }
  )
}
function removeOwnedDatabase(name: string, allowed: Set<string>) {
  assert(allowed.has(name), "Fixture database ownership is missing")
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Fixture cleanup is blocked"))
  })
}
function rollbackDatabase(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, LOCAL_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      migrateLocalDatabase(request.result, 0)
      request.transaction
        ?.objectStore("outbox")
        .createIndex("fixtureUniqueCreatedAt", "createdAt", { unique: true })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function runPlanOutboxProof(runInput: string) {
  assert(
    location.hostname === "127.0.0.1" || location.hostname === "localhost",
    "Plan proof requires an isolated loopback origin"
  )
  const runId = entityIdSchema.parse(runInput)
  const actor = `browser-test-${runId}-plan-save`
  const primaryName = localDatabaseName(actor)
  const rollbackName = `${primaryName}-rollback`
  const allowed = new Set([primaryName, rollbackName])
  const database = await openLocalDatabase(actor)
  let failingDatabase: IDBDatabase | null = null
  const checks: string[] = []
  const now = "2026-10-10T12:00:00.000Z"
  const firstTagId = crypto.randomUUID()
  const firstTagOperationId = crypto.randomUUID()
  const request: PlanSaveRequest = {
    mode: "create",
    itemId: crypto.randomUUID(),
    contentOperationId: crypto.randomUUID(),
    viewOperationId: crypto.randomUUID(),
    primaryTagId: firstTagId,
    now,
    input: {
      kind: "plan",
      variant: "task",
      title: "Proof plan",
      description: "Retained content",
      status: "in_progress",
      checklist: [
        { id: crypto.randomUUID(), text: "Retained step", completed: true },
      ],
      recurrence: null,
      schedule: {
        mode: "all_day",
        startDate: "2026-10-10",
        endDateExclusive: "2026-10-11",
      },
    },
  }
  let notifications = 0
  const listener = () => {
    notifications++
  }
  window.addEventListener("dalis:outbox-changed", listener)
  try {
    await commitLocalPreferenceCommand(
      database,
      actor,
      {
        type: "tag.save",
        tagId: firstTagId,
        input: { name: "First", color: "#123abc", position: 1024 },
      },
      { operationId: firstTagOperationId, now: new Date(now) }
    )
    const created = await commitLocalPlanSave(database, actor, request)
    let stored = await snapshot(database)
    assert(
      !created.replayed &&
        created.contentEntry.state === "pending" &&
        created.viewEntry.state === "pending",
      "Content and view must remain pending"
    )
    assert(
      created.viewEntry.dependencies.includes(request.contentOperationId) &&
        created.viewEntry.dependencies.includes(firstTagOperationId),
      "View must depend on content and category intent"
    )
    assert(
      created.viewEntry.sequence === created.contentEntry.sequence + 1 &&
        stored.items.length === 1 &&
        stored.itemViews.length === 1 &&
        notifications === 1,
      "Plan, view and notification must commit together"
    )
    checks.push(
      "Create commits content, category and two pending intents atomically"
    )
    const beforeReplay = JSON.stringify(stored)
    const replay = await commitLocalPlanSave(database, actor, request)
    assert(
      replay.replayed &&
        JSON.stringify(await snapshot(database)) === beforeReplay &&
        notifications === 1,
      "Replay must preserve stored records and avoid duplicate notification"
    )
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...request,
        input: { ...request.input, title: "Changed replay" },
      })
    )
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...request,
        viewOperationId: crypto.randomUUID(),
      })
    )
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...request,
        now: "2026-10-10T13:00:00.000Z",
      })
    )
    assert(
      JSON.stringify(await snapshot(database)) === beforeReplay,
      "Rejected replay must not alter records"
    )
    checks.push(
      "Exact replay is idempotent; changed input, partial pair and timestamp reuse reject"
    )
    const secondTagId = crypto.randomUUID()
    const secondTagOperationId = crypto.randomUUID()
    await commitLocalPreferenceCommand(
      database,
      actor,
      {
        type: "tag.save",
        tagId: secondTagId,
        input: { name: "Second", color: "#654321", position: 2048 },
      },
      { operationId: secondTagOperationId, now: new Date(now) }
    )
    const expectedPlan = stored.items[0] as Plan
    const expectedView = stored.itemViews[0] as ItemView
    const update: PlanSaveRequest = {
      ...request,
      mode: "update",
      expectedPlan,
      expectedView,
      input: { ...request.input, variant: "note", title: "Updated plan" },
      contentOperationId: crypto.randomUUID(),
      viewOperationId: crypto.randomUUID(),
      primaryTagId: secondTagId,
      now: "2026-10-10T13:00:00.000Z",
    }
    const updated = await commitLocalPlanSave(database, actor, update)
    assert(
      updated.contentEntry.dependencies.includes(request.contentOperationId),
      "Content update must retain item tail"
    )
    for (const operationId of [
      update.contentOperationId,
      request.contentOperationId,
      request.viewOperationId,
      secondTagOperationId,
    ])
      assert(
        updated.viewEntry.dependencies.includes(operationId),
        "View update must retain content, item, view, category and preference tails"
      )
    stored = await snapshot(database)
    assert(
      (stored.items[0] as Plan).variant === "note" &&
        (stored.itemViews[0] as ItemView).primaryTagId === secondTagId &&
        (stored.items[0] as Plan).checklist[0].completed,
      "Update must preserve identity and progress"
    )
    checks.push(
      "Update preserves variant identity/progress and all existing unresolved dependency tails"
    )
    const beforeStale = JSON.stringify(stored)
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...update,
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
      })
    )
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...update,
        expectedPlan: stored.items[0] as Plan,
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
      })
    )
    await rejects(() =>
      commitLocalPlanSave(database, actor, {
        ...request,
        itemId: crypto.randomUUID(),
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
        primaryTagId: crypto.randomUUID(),
      })
    )
    assert(
      JSON.stringify(await snapshot(database)) === beforeStale,
      "Failed CAS/category validation must preserve all stores"
    )
    checks.push(
      "Stale plan, stale category view and missing category roll back without queue writes"
    )
    for (const variant of ["event", "appointment", "note"] as const) {
      const other = {
        ...request,
        itemId: crypto.randomUUID(),
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
        primaryTagId: null,
        input: { ...request.input, variant },
      }
      await commitLocalPlanSave(database, actor, other)
    }
    assert(
      (await snapshot(database)).items.length === 4,
      "All four variants must use the same atomic save"
    )
    checks.push("All four variants use one content/category save path")
    failingDatabase = await rollbackDatabase(rollbackName)
    const beforeFailure = JSON.stringify(await snapshot(failingDatabase))
    const beforeNotifications = notifications
    await rejects(() =>
      commitLocalPlanSave(failingDatabase as IDBDatabase, actor, {
        ...request,
        primaryTagId: null,
      })
    )
    assert(
      JSON.stringify(await snapshot(failingDatabase)) === beforeFailure &&
        notifications === beforeNotifications,
      "Second intent constraint failure must roll back content, view, first intent and metadata"
    )
    checks.push(
      "Actual second-intent write failure rolls back all stores and notification"
    )
    return { checks, status: "passed" as const }
  } finally {
    window.removeEventListener("dalis:outbox-changed", listener)
    database.close()
    failingDatabase?.close()
    await removeOwnedDatabase(primaryName, allowed)
    await removeOwnedDatabase(rollbackName, allowed)
  }
}
