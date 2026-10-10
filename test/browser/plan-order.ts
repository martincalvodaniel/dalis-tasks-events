import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { commitLocalPlanSave } from "@/lib/local-db/plan-outbox"
import { commitLocalPreferenceCommand } from "@/lib/local-db/preference-outbox"
import { commitLocalTaskMoveCommand } from "@/lib/local-db/task-move-outbox"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import type { OutboxEntry } from "@/types/local-sync"
import type { TaskPlacement } from "@/types/preferences"

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
function snapshot(database: IDBDatabase) {
  return runLocalTransaction<{
    entries: OutboxEntry[]
    placements: TaskPlacement[]
  }>(database, ["outbox", "taskPlacements"], "readonly", (context) => {
    const entries = context.transaction.objectStore("outbox").getAll()
    const placements = context.transaction
      .objectStore("taskPlacements")
      .getAll()
    let reads = 2
    const done = () => {
      if (--reads === 0)
        context.setResult({
          entries: entries.result,
          placements: placements.result,
        })
    }
    entries.onsuccess = done
    placements.onsuccess = done
  })
}
export async function runPlanOrderProof(runIdInput: string) {
  if (location.hostname !== "127.0.0.1")
    throw new Error("Plan order proof requires its isolated loopback origin")
  const runId = entityIdSchema.parse(runIdInput),
    actor = `browser-test-${runId}-plan-order`
  const name = localDatabaseName(actor)
  const database = await openLocalDatabase(actor)
  const checks: string[] = []
  try {
    const tagId = crypto.randomUUID()
    const now = new Date("2026-10-10T12:00:00.000Z")
    await commitLocalPreferenceCommand(
      database,
      actor,
      {
        type: "tag.save",
        tagId,
        input: { name: "Test", color: "#2563eb", position: 0 },
      },
      { operationId: crypto.randomUUID(), now }
    )
    const ids: string[] = []
    for (const variant of ["task", "event", "appointment", "note"] as const) {
      const itemId = crypto.randomUUID()
      ids.push(itemId)
      await commitLocalPlanSave(database, actor, {
        mode: "create",
        itemId,
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
        primaryTagId: tagId,
        now: now.toISOString(),
        input: {
          kind: "plan",
          variant,
          title: variant,
          description: "",
          schedule: {
            mode: "all_day",
            startDate: "2026-10-10",
            endDateExclusive: "2026-10-11",
          },
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      })
    }
    const before = await snapshot(database)
    const command = {
      type: "task.move" as const,
      itemId: ids[3],
      occurrenceId: null,
      scope: "day" as const,
      date: "2026-10-10",
      tagId,
      afterId: null,
      beforeId: ids[0],
    }
    const operationId = crypto.randomUUID()
    const result = await commitLocalTaskMoveCommand(
      database,
      actor,
      command,
      { operationId, now },
      true
    )
    const after = await snapshot(database)
    assert(
      after.entries.length === before.entries.length + 1 &&
        after.placements.length === 4,
      "One movement must atomically write all placements and one intent"
    )
    assert(
      result.state === "pending" &&
        result.attempts === 0 &&
        result.operation.baseRevision === 0,
      "Local movement must not acknowledge its intent"
    )
    const tail = before.entries.toSorted(
      (left, right) => right.sequence - left.sequence
    )[0]
    assert(
      result.dependencies.includes(tail.operation.operationId),
      "Movement must depend on content/category pending tail"
    )
    checks.push(
      "Mixed four-variant order commits all ranks and one dependent pending intent atomically"
    )
    assert(
      after.placements.every((record) => record.revision === 0),
      "Local optimism must retain acknowledged revisions"
    )
    assert(
      (after.placements.find((record) => record.occurrenceId === ids[3])
        ?.position ?? 0) <
        (after.placements.find((record) => record.occurrenceId === ids[0])
          ?.position ?? 0),
      "Note must move before Task"
    )
    checks.push(
      "Note orders before Task without rewriting content or claiming a remote revision"
    )
    assert(
      JSON.stringify(
        await commitLocalTaskMoveCommand(
          database,
          actor,
          command,
          { operationId, now },
          true
        )
      ) === JSON.stringify(result),
      "Replay must retain exact intent"
    )
    assert(
      JSON.stringify(await snapshot(database)) === JSON.stringify(after),
      "Replay must create no new writes"
    )
    checks.push(
      "Exact movement replay retains operation ID, dependencies and ranks"
    )
    let rejected = false
    try {
      await commitLocalTaskMoveCommand(
        database,
        actor,
        { ...command, beforeId: crypto.randomUUID() },
        { operationId: crypto.randomUUID(), now },
        true
      )
    } catch {
      rejected = true
    }
    assert(
      rejected &&
        JSON.stringify(await snapshot(database)) === JSON.stringify(after),
      "Stale neighbor failure must preserve ranks and queue"
    )
    checks.push(
      "Invalid neighbor rolls back ranks and queue without discarding dependencies"
    )
    return { status: "passed" as const, checks }
  } finally {
    database.close()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned order proof cleanup is blocked"))
    })
  }
}
