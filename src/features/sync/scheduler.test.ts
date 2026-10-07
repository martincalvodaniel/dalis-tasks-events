import { expect, test } from "bun:test"
import type { SyncPassResult } from "@/features/sync/coordinator"
import { SyncScheduler } from "@/features/sync/scheduler"

function fixture(run: () => Promise<SyncPassResult>) {
  let clock = 0
  let available = true
  let cancelled = 0
  const results: SyncPassResult[] = []
  const timers = new Map<() => void, number>()
  const scheduler = new SyncScheduler({
    run,
    cancel: () => {
      cancelled++
    },
    onResult: (result) => {
      results.push(result)
    },
    isAvailable: () => available,
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
    available: (value: boolean) => {
      available = value
    },
    fire: async () => {
      const [callback, dueAt] = [...timers][0] ?? []
      if (!callback) throw new Error("Expected a scheduled sync pass")
      clock = dueAt
      timers.delete(callback)
      callback()
      for (let index = 0; index < 5; index++) await Promise.resolve()
    },
  }
}
function result(status: SyncPassResult["status"]): SyncPassResult {
  return { status, uploaded: 0, downloaded: 0 }
}

test("local changes shorten idle polling but never failure backoff or authorization pauses", async () => {
  let next = result("settled")
  const test = fixture(async () => next)
  test.scheduler.start()
  await test.fire()
  test.scheduler.changed()
  test.scheduler.changed()
  expect([...test.timers.values()]).toEqual([1000])
  next = result("retry_later")
  await test.fire()
  test.scheduler.changed()
  expect([...test.timers.values()]).toEqual([31000])
  next = result("unauthorized")
  await test.fire()
  test.scheduler.changed()
  expect(test.timers.size).toBe(0)
})

test("a local write during an active pass schedules a short follow-up", async () => {
  let complete: (value: SyncPassResult) => void = () => undefined
  const pass = new Promise<SyncPassResult>((resolve) => {
    complete = resolve
  })
  const test = fixture(() => pass)
  test.scheduler.start()
  await test.fire()
  test.scheduler.changed()
  complete(result("settled"))
  await test.scheduler.request()
  expect([...test.timers.values()]).toEqual([1000])
})

test("scheduler starts immediately, continues bounded pages, then polls once a minute", async () => {
  const values = [result("more_work"), result("settled")]
  const test = fixture(async () => values.shift() ?? result("settled"))
  test.scheduler.start()
  expect([...test.timers.values()]).toEqual([0])
  await test.fire()
  expect([...test.timers.values()]).toEqual([2000])
  await test.fire()
  expect([...test.timers.values()]).toEqual([62000])
})
test("network failure backs off to five minutes and wake events cannot bypass it", async () => {
  const test = fixture(async () => {
    throw new Error("Test network failed")
  })
  test.scheduler.start()
  for (const expected of [30000, 90000, 210000, 450000, 750000, 1050000]) {
    await test.fire()
    for (let index = 0; index < 10; index++) test.scheduler.wake()
    expect([...test.timers.values()]).toEqual([expected])
  }
})
test("offline or hidden execution waits for an available wake event", async () => {
  let calls = 0
  const test = fixture(async () => {
    calls++
    return result("settled")
  })
  test.available(false)
  test.scheduler.start()
  expect(test.timers.size).toBe(0)
  test.available(true)
  test.scheduler.wake()
  test.available(false)
  await test.fire()
  expect(calls).toBe(0)
  test.available(true)
  test.scheduler.wake()
  await test.fire()
  expect(calls).toBe(1)
})
test("authorization and recovery pauses require an explicit request", async () => {
  for (const status of [
    "unauthorized",
    "account_changed",
    "recovery_required",
    "stopped",
  ] as const) {
    let next = result(status)
    const test = fixture(async () => next)
    test.scheduler.start()
    await test.fire()
    test.scheduler.wake()
    expect(test.timers.size).toBe(0)
    next = result("settled")
    expect((await test.scheduler.request()).status).toBe("settled")
    expect(test.timers.size).toBe(1)
  }
})
test("manual and automatic requests coalesce; stopping suppresses late results and timers", async () => {
  let complete: (value: SyncPassResult) => void = () => undefined
  const running = new Promise<SyncPassResult>((resolve) => {
    complete = resolve
  })
  let calls = 0
  const test = fixture(() => {
    calls++
    return running
  })
  test.scheduler.start()
  await test.fire()
  const first = test.scheduler.request()
  expect(test.scheduler.request()).toBe(first)
  expect(calls).toBe(1)
  test.scheduler.stop()
  test.scheduler.stop()
  complete(result("settled"))
  expect((await first).status).toBe("stopped")
  expect(test.cancelled()).toBe(1)
  expect(test.results).toEqual([])
  expect(test.timers.size).toBe(0)
  expect((await test.scheduler.request()).status).toBe("stopped")
})
