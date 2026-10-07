import { expect, test } from "bun:test"
import type { LocalSyncRuntime } from "@/features/sync/local-runtime"
import { isAccountSyncCacheKey, SyncAttempt } from "@/features/sync/manual-sync"

const settled = { status: "settled" as const, uploaded: 1, downloaded: 1 }
test("manual attempts coalesce and close owned resources after refreshing", async () => {
  const events: string[] = []
  const attempt = new SyncAttempt(
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
  expect(await first).toEqual(settled)
  expect(events).toEqual(["run", "refresh", "close"])
})
test("stopping during runtime opening prevents network effects and closes it", async () => {
  let complete: (runtime: LocalSyncRuntime) => void = () => undefined
  const opened = new Promise<LocalSyncRuntime>((resolve) => {
    complete = resolve
  })
  let calls = 0
  let closed = 0
  const attempt = new SyncAttempt(
    () => opened,
    async () => {
      calls++
    }
  )
  const running = attempt.run()
  attempt.stop()
  complete({
    run: async () => {
      calls++
      return settled
    },
    close: async () => {
      closed++
    },
  })
  expect((await running).status).toBe("stopped")
  expect(calls).toBe(0)
  expect(closed).toBe(1)
})
test("stopping an active pass closes once and never refreshes a stale account", async () => {
  let finish: (result: typeof settled) => void = () => undefined
  const pass = new Promise<typeof settled>((resolve) => {
    finish = resolve
  })
  let closed = 0
  let refreshed = 0
  const attempt = new SyncAttempt(
    async () => ({
      run: () => pass,
      close: async () => {
        closed++
        finish(settled)
      },
    }),
    async () => {
      refreshed++
    }
  )
  const running = attempt.run()
  await Promise.resolve()
  attempt.stop()
  expect((await running).status).toBe("stopped")
  expect(closed).toBe(1)
  expect(refreshed).toBe(0)
})
test("runtime and cache failures propagate while resources are closed", async () => {
  for (const phase of ["run", "refresh"]) {
    let closed = 0
    const attempt = new SyncAttempt(
      async () => ({
        run: async () => {
          if (phase === "run") throw new Error("Test runtime failed")
          return settled
        },
        close: async () => {
          closed++
        },
      }),
      async () => {
        throw new Error("Test refresh failed")
      }
    )
    await expect(attempt.run()).rejects.toThrow()
    expect(closed).toBe(1)
  }
})
test("cache revalidation matches only the current user and epoch", () => {
  expect(
    isAccountSyncCacheKey(
      ["dalis:local-tasks", "user", "epoch"],
      "user",
      "epoch"
    )
  ).toBe(true)
  for (const key of [
    "dalis:active-local-account",
    ["dalis:local-tasks", "other", "epoch"],
    ["dalis:local-tasks", "user", "old"],
    ["foreign", "user", "epoch"],
    null,
  ])
    expect(isAccountSyncCacheKey(key, "user", "epoch")).toBe(false)
})
