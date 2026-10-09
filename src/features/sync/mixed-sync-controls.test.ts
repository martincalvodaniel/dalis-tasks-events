import { expect, test } from "bun:test"
import type { SyncPassResultV2 } from "@/features/sync/coordinator-v2"
import type { LocalSyncRuntimeV2 } from "@/features/sync/local-runtime-v2"
import {
  SyncAttemptV2,
  SyncSchedulerV2,
} from "@/features/sync/mixed-sync-controls"
import { diagnosePersonalQueue } from "@/lib/sync/personal-queue-diagnostics"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import type { OutboxEntry } from "@/types/local-sync"

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined
  const promise = new Promise<Value>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function result(
  status: SyncPassResultV2["status"] = "settled"
): SyncPassResultV2 {
  const userId = "mixed-controls-owner"
  const timestamp = "2026-10-09T00:00:00.000Z"
  const itemId = crypto.randomUUID()
  const move: OutboxEntry = {
    userId,
    entityKey: taskPlacementEntityKey(itemId, "day", "2026-10-09"),
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "task.move",
        itemId,
        occurrenceId: null,
        scope: "day",
        date: "2026-10-09",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
    },
    sequence: 1,
    dependencies: [],
    state: "pending",
    attempts: 0,
    createdAt: timestamp,
    lease: null,
  }
  const tagId = crypto.randomUUID()
  const category: OutboxEntry = {
    ...move,
    entityKey: `tag:${tagId}`,
    sequence: 2,
    dependencies: [move.operation.operationId],
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "tag.save",
        tagId,
        input: { name: "Blocked category", color: "#123456", position: 1024 },
      },
    },
  }
  return {
    status,
    uploaded: 1,
    downloaded: 2,
    diagnostics: diagnosePersonalQueue({
      userId,
      entries: [move, category],
      items: [],
    }),
  }
}

function schedulerFixture(run: () => Promise<SyncPassResultV2>) {
  let clock = 0
  let cancelled = 0
  const results: SyncPassResultV2[] = []
  const timers = new Map<() => void, number>()
  const scheduler = new SyncSchedulerV2({
    run,
    cancel: () => {
      cancelled++
    },
    onResult: (value) => results.push(value),
    isAvailable: () => true,
    now: () => clock,
    schedule: (callback, delay) => {
      timers.set(callback, clock + delay)
      return () => {
        timers.delete(callback)
      }
    },
  })
  return {
    scheduler,
    results,
    timers,
    cancelled: () => cancelled,
    fire: () => {
      const [callback, dueAt] = [...timers][0] ?? []
      if (!callback) throw new Error("Expected scheduled mixed pass")
      clock = dueAt
      timers.delete(callback)
      callback()
      return scheduler.request()
    },
  }
}

test("mixed attempts retain blocked personal diagnostics, coalesce and close through legacy lifecycle", async () => {
  const settled = result()
  const events: string[] = []
  const attempt = new SyncAttemptV2(
    async () => ({
      run: async () => {
        events.push("run")
        return settled
      },
      close: async () => {
        events.push("close")
      },
    }),
    async () => {
      events.push("refresh")
    }
  )
  const first = attempt.run()
  expect(attempt.run()).toBe(first)
  const value = await first
  expect(value).toEqual(settled)
  expect(value.diagnostics?.personalProjectionBlocked).toBe(true)
  expect(value.diagnostics?.unsupported).toHaveLength(1)
  expect(value.diagnostics?.blocked).toHaveLength(1)
  expect(events).toEqual(["run", "refresh", "close"])
  expect(attempt.run()).toBe(first)
  const changed = result("account_changed")
  const accountAttempt = new SyncAttemptV2(
    async () => ({ run: async () => changed, close: async () => {} }),
    async () => {}
  )
  expect(await accountAttempt.run()).toEqual({ ...changed, diagnostics: null })
})

test("mixed cancellation during opening or an active pass closes once, clears diagnostics and suppresses refresh", async () => {
  for (const phase of ["opening", "running"] as const) {
    const opened = deferred<LocalSyncRuntimeV2>()
    const started = deferred<void>()
    const pass = deferred<SyncPassResultV2>()
    let runs = 0
    let closes = 0
    let refreshes = 0
    const attempt = new SyncAttemptV2(
      () => opened.promise,
      async () => {
        refreshes++
      }
    )
    const running = attempt.run()
    expect(attempt.run()).toBe(running)
    const runtime: LocalSyncRuntimeV2 = {
      run: () => {
        runs++
        started.resolve()
        return pass.promise
      },
      close: async () => {
        closes++
        pass.resolve(result())
      },
    }
    if (phase === "opening") {
      attempt.stop()
      opened.resolve(runtime)
    } else {
      opened.resolve(runtime)
      await started.promise
      attempt.stop()
    }
    expect(await running).toEqual({
      status: "stopped",
      uploaded: 0,
      downloaded: 0,
      diagnostics: null,
    })
    expect(refreshes).toBe(0)
    expect(closes).toBe(1)
    expect(runs).toBe(phase === "opening" ? 0 : 1)
  }
})

test("mixed scheduling coalesces passes and keeps more-work and settled diagnostics without declaring convergence", async () => {
  const gate = deferred<SyncPassResultV2>()
  const more = result("more_work")
  const settled = result()
  let calls = 0
  const value = schedulerFixture(async () =>
    ++calls === 1 ? gate.promise : settled
  )
  value.scheduler.start()
  const first = value.scheduler.request()
  expect(value.scheduler.request()).toBe(first)
  gate.resolve(more)
  expect(await first).toEqual(more)
  expect(await first).toBe(value.results[0])
  expect([...value.timers.values()]).toEqual([2000])
  expect(await value.fire()).toEqual(settled)
  expect(value.results[1].diagnostics?.personalProjectionBlocked).toBe(true)
  expect([...value.timers.values()]).toEqual([62000])
  value.scheduler.changed()
  expect([...value.timers.values()]).toEqual([3000])
  value.scheduler.stop()
  expect(value.cancelled()).toBe(1)
  expect(value.timers.size).toBe(0)
})

test("mixed scheduler fallback retries clear diagnostics while retaining backoff and account-change pauses", async () => {
  let next: SyncPassResultV2 | null = null
  const value = schedulerFixture(async () => {
    if (!next) throw new Error("Test mixed pass failed")
    return next
  })
  value.scheduler.start()
  const first = value.scheduler.request()
  expect(value.scheduler.request()).toBe(first)
  expect(await first).toEqual({
    status: "retry_later",
    uploaded: 0,
    downloaded: 0,
    diagnostics: null,
  })
  expect(await first).toBe(value.results[0])
  value.scheduler.changed()
  value.scheduler.wake()
  expect([...value.timers.values()]).toEqual([30000])
  expect((await value.fire()).diagnostics).toBeNull()
  expect([...value.timers.values()]).toEqual([90000])
  next = result("retry_later")
  expect(await value.fire()).toEqual(next)
  expect([...value.timers.values()]).toEqual([210000])
  next = result("account_changed")
  expect(await value.fire()).toEqual({ ...next, diagnostics: null })
  value.scheduler.changed()
  value.scheduler.wake()
  expect(value.timers.size).toBe(0)
  value.scheduler.stop()
  expect(await value.scheduler.request()).toEqual({
    status: "stopped",
    uploaded: 0,
    downloaded: 0,
    diagnostics: null,
  })
})
