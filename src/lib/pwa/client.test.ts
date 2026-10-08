import { expect, test } from "bun:test"
import { checkOfflineUpdate, observeOfflineUpdates } from "@/lib/pwa/client"

async function withNavigator(value: unknown, work: () => Promise<void>) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator")
  Object.defineProperty(globalThis, "navigator", { value, configurable: true })
  try {
    await work()
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original)
    else Reflect.deleteProperty(globalThis, "navigator")
  }
}
function fixture() {
  const worker = new EventTarget()
  let updates = 0
  const registration = Object.assign(new EventTarget(), {
    active: worker,
    installing: null as EventTarget | null,
    waiting: null as EventTarget | null,
    update: async () => {
      updates++
    },
  })
  return {
    worker,
    registration,
    updates: () => updates,
    navigator: {
      onLine: true,
      serviceWorker: {
        getRegistration: async (scope: string) => {
          expect(scope).toBe("/workspace")
          return registration
        },
      },
    },
  }
}
test("update checks distinguish preparation states and never register or force activation", async () => {
  const f = fixture()
  await withNavigator(f.navigator, async () => {
    expect(await checkOfflineUpdate()).toBe("current")
    f.registration.installing = f.worker
    expect(await checkOfflineUpdate()).toBe("installing")
    f.registration.waiting = f.worker
    expect(await checkOfflineUpdate()).toBe("waiting")
    f.navigator.onLine = false
    expect(await checkOfflineUpdate()).toBe("offline")
    expect(f.updates()).toBe(3)
  })
  await withNavigator({ onLine: true }, async () =>
    expect(await checkOfflineUpdate()).toBe("unavailable")
  )
  await withNavigator(
    { onLine: true, serviceWorker: { getRegistration: async () => undefined } },
    async () => expect(await checkOfflineUpdate()).toBe("unavailable")
  )
})
test("observing an installation already in progress detects waiting and releases listeners", async () => {
  const f = fixture()
  f.registration.installing = f.worker
  f.navigator.onLine = false
  let notices = 0
  await withNavigator(f.navigator, async () => {
    const dispose = observeOfflineUpdates(() => notices++)
    await Promise.resolve()
    await Promise.resolve()
    f.registration.waiting = f.worker
    f.worker.dispatchEvent(new Event("statechange"))
    expect(notices).toBe(1)
    dispose()
    f.worker.dispatchEvent(new Event("statechange"))
    f.registration.dispatchEvent(new Event("updatefound"))
    expect(notices).toBe(1)
    expect(f.updates()).toBe(0)
  })
})
test("disposing before registration lookup prevents subsequent notices or update requests", async () => {
  const f = fixture()
  f.registration.waiting = f.worker
  let notices = 0
  await withNavigator(f.navigator, async () => {
    const dispose = observeOfflineUpdates(() => notices++)
    dispose()
    await Promise.resolve()
    await Promise.resolve()
    expect(notices).toBe(0)
    expect(f.updates()).toBe(0)
  })
})
