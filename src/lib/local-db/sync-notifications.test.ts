import { expect, test } from "bun:test"
import {
  notifyLocalOutboxChange,
  subscribeLocalOutboxChanges,
} from "@/lib/local-db/sync-notifications"

test("notification failures cannot reject committed work and close their channel", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "BroadcastChannel"
  )
  let closed = 0
  class FailedChannel {
    postMessage() {
      throw new Error("Test channel failed")
    }
    close() {
      closed++
    }
  }
  try {
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      value: FailedChannel,
    })
    expect(() => notifyLocalOutboxChange("own-account")).not.toThrow()
    expect(closed).toBe(1)
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "BroadcastChannel", descriptor)
    else Reflect.deleteProperty(globalThis, "BroadcastChannel")
  }
})

test("local subscribers validate messages, isolate accounts and detach on cleanup", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window")
  const target = new EventTarget()
  let calls = 0
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: target,
    })
    const unsubscribe = subscribeLocalOutboxChanges("own-account", () => {
      calls++
    })
    for (const detail of [
      { type: "OUTBOX_CHANGED", userId: "other-account" },
      { type: "OUTBOX_CHANGED", userId: "own-account", unexpected: true },
      { type: "OTHER_EVENT", userId: "own-account" },
    ])
      target.dispatchEvent(new CustomEvent("dalis:outbox-changed", { detail }))
    expect(calls).toBe(0)
    target.dispatchEvent(
      new CustomEvent("dalis:outbox-changed", {
        detail: { type: "OUTBOX_CHANGED", userId: "own-account" },
      })
    )
    expect(calls).toBe(1)
    unsubscribe()
    target.dispatchEvent(
      new CustomEvent("dalis:outbox-changed", {
        detail: { type: "OUTBOX_CHANGED", userId: "own-account" },
      })
    )
    expect(calls).toBe(1)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
