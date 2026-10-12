import { expect, test } from "bun:test"
import {
  readLocalPersonalSettings,
  saveLocalPersonalSettings,
} from "@/features/workspace/local-personal-settings"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { UserSettings } from "@/types/preferences"

const account = {
    userId: "settings-feature-owner",
    epoch: crypto.randomUUID(),
  },
  now = "2026-10-12T12:00:00.000Z"
const input = { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" } as const
function fixture() {
  const settings: UserSettings = {
    userId: account.userId,
    ...input,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  const entry = outboxEntrySchema.parse({
    userId: account.userId,
    entityKey: `settings:${account.userId}`,
    sequence: 1,
    state: "pending",
    attempts: 0,
    dependencies: [],
    lease: null,
    createdAt: now,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: { type: "settings.update", input },
    },
  })
  const calls: string[] = []
  const ports = {
    requireActive: async (captured: typeof account) => {
      expect(captured).toEqual(account)
      calls.push("guard")
    },
    readSettings: async (userId: string) => {
      expect(userId).toBe(account.userId)
      calls.push("read")
      return settings
    },
    commitSettings: async (
      userId: string,
      received: unknown,
      expected: unknown
    ) => {
      expect(userId).toBe(account.userId)
      expect(received).toEqual(input)
      expect(expected).toEqual(settings)
      calls.push("commit")
      return entry
    },
  }
  return { settings, entry, ports, calls }
}
test("feature reads validated settings and queues a provisional change between account guards", async () => {
  const value = fixture()
  expect(await readLocalPersonalSettings(account, value.ports)).toEqual(
    value.settings
  )
  expect(value.calls).toEqual(["guard", "read", "guard"])
  value.calls.length = 0
  expect(
    await saveLocalPersonalSettings(account, input, value.settings, value.ports)
  ).toEqual(value.entry)
  expect(value.calls).toEqual(["guard", "commit", "guard"])
  expect(value.entry.state).toBe("pending")
  expect(value.settings.revision).toBe(0)
})
test("invalid account, preference input or expected foreign record fails before opening storage", async () => {
  const value = fixture()
  await expect(
    readLocalPersonalSettings({ ...account, epoch: "invalid" }, value.ports)
  ).rejects.toThrow()
  await expect(
    saveLocalPersonalSettings(
      account,
      { ...input, weekStartsOn: 0 },
      value.settings,
      value.ports
    )
  ).rejects.toThrow()
  await expect(
    saveLocalPersonalSettings(
      account,
      input,
      { ...value.settings, userId: "other-owner" },
      value.ports
    )
  ).rejects.toThrow("another account")
  expect(value.calls).toEqual([])
})
test("foreign stored data and closing account before a write cannot produce an accepted value", async () => {
  const value = fixture()
  value.ports.readSettings = async () => ({
    ...value.settings,
    userId: "other-owner",
  })
  await expect(readLocalPersonalSettings(account, value.ports)).rejects.toThrow(
    "another account"
  )
  value.calls.length = 0
  value.ports.requireActive = async () => {
    throw new Error("Owned account closed")
  }
  await expect(
    saveLocalPersonalSettings(account, input, value.settings, value.ports)
  ).rejects.toThrow("closed")
  expect(value.calls).toEqual([])
})
test("closing account after commit preserves the recorded intention and prevents reporting success", async () => {
  const value = fixture(),
    before = structuredClone(value.entry)
  let committed = false
  value.ports.requireActive = async () => {
    if (committed) throw new Error("Owned epoch changed")
  }
  const commit = value.ports.commitSettings
  value.ports.commitSettings = async (...args) => {
    const entry = await commit(...args)
    committed = true
    return entry
  }
  await expect(
    saveLocalPersonalSettings(account, input, value.settings, value.ports)
  ).rejects.toThrow("epoch changed")
  expect(committed).toBe(true)
  expect(value.entry).toEqual(before)
  expect(value.entry.state).toBe("pending")
})
test("CAS/storage failure is propagated without claiming a commit or advancing local revision", async () => {
  const value = fixture()
  value.ports.commitSettings = async () => {
    throw new Error("Owned stale editor")
  }
  await expect(
    saveLocalPersonalSettings(account, input, value.settings, value.ports)
  ).rejects.toThrow("stale editor")
  expect(value.calls).toEqual(["guard"])
  expect(value.settings.revision).toBe(0)
})
