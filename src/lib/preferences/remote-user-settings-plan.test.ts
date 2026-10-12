import { expect, test } from "bun:test"
import { planRemoteUserSettingsOperation } from "@/lib/preferences/remote-user-settings-plan"
import { applyUserSettingsCommand } from "@/lib/preferences/user-settings-command"
import type { UserSettings } from "@/types/preferences"

const actor = "settings-test-owner"
const created = "2026-10-10T12:00:00.000Z"
const timestamp = "2026-10-12T12:00:00.000Z"
const values = {
  timeZone: "Europe/Madrid",
  weekStartsOn: 1 as const,
  locale: "es-ES" as const,
}
function current(): UserSettings {
  return {
    ...values,
    userId: actor,
    revision: 3,
    createdAt: created,
    updatedAt: created,
    deletedAt: null,
  }
}
function input(
  record: UserSettings | null = null,
  revision = record?.revision ?? 0
) {
  return {
    userId: actor,
    timestamp,
    current: record,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1 as const,
      baseRevision: revision,
      command: {
        type: "settings.update" as const,
        input: { ...values, timeZone: "Pacific/Kiritimati" },
      },
    },
  }
}
test("settings planning creates only the actor's settings at revision one", () => {
  const value = input(),
    before = structuredClone(value)
  const plan = planRemoteUserSettingsOperation(value)
  expect(plan.status).toBe("changes")
  if (plan.status !== "changes") throw new Error("Creation plan missing")
  expect(plan.effects).toEqual([
    {
      store: "settings",
      record: {
        ...values,
        timeZone: "Pacific/Kiritimati",
        userId: actor,
        revision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    },
  ])
  expect(value).toEqual(before)
})
test("updates preserve creation and advance the exact personal CAS without changing locale or week start", () => {
  const value = input(current()),
    before = structuredClone(value)
  const plan = planRemoteUserSettingsOperation(value)
  if (plan.status !== "changes") throw new Error("Update plan missing")
  expect(plan.effects).toEqual([
    {
      store: "settings",
      record: {
        ...current(),
        timeZone: "Pacific/Kiritimati",
        revision: 4,
        updatedAt: timestamp,
      },
    },
  ])
  expect(value).toEqual(before)
  expect(planRemoteUserSettingsOperation(value)).toEqual(plan)
})
test("stale, absent and tombstoned settings return evidence without effects or resurrection", () => {
  const deleted = { ...current(), deletedAt: timestamp }
  for (const [record, base] of [
    [current(), 0],
    [current(), 2],
    [null, 1],
    [deleted, 3],
  ] as const) {
    expect(planRemoteUserSettingsOperation(input(record, base))).toEqual({
      status: "conflict",
      current: record,
    })
  }
})
test("ownership and invalid revisions are rejected before a plan can be formed", () => {
  expect(() =>
    planRemoteUserSettingsOperation(
      input({ ...current(), userId: "other-owner" })
    )
  ).toThrow()
  expect(() =>
    planRemoteUserSettingsOperation(input({ ...current(), revision: 0 }))
  ).toThrow()
  expect(() =>
    planRemoteUserSettingsOperation({ ...input(), injected: true })
  ).toThrow()
  const exhausted = { ...current(), revision: Number.MAX_SAFE_INTEGER }
  expect(planRemoteUserSettingsOperation(input(exhausted))).toEqual({
    status: "invalid_command",
  })
})
test("invalid zones, altered fixed settings and injected owner fields fail strict input validation", () => {
  for (const invalid of [
    { ...values, timeZone: "Invalid/Zone" },
    { ...values, weekStartsOn: 0 },
    { ...values, locale: "en-US" },
    { ...values, userId: "other-owner" },
  ]) {
    const value = input()
    expect(() =>
      planRemoteUserSettingsOperation({
        ...value,
        operation: {
          ...value.operation,
          command: { type: "settings.update", input: invalid },
        },
      })
    ).toThrow()
  }
})
test("other operation families remain unsupported, with no empty successful effects", () => {
  const value = input()
  expect(
    planRemoteUserSettingsOperation({
      ...value,
      operation: {
        ...value.operation,
        command: { type: "item.delete", itemId: crypto.randomUUID() },
      },
    })
  ).toEqual({ status: "unsupported" })
})
test("the shared local mutation preserves its revision until a real remote result arrives", () => {
  expect(
    applyUserSettingsCommand(null, values, actor, timestamp).revision
  ).toBe(0)
  expect(applyUserSettingsCommand(current(), values, actor, timestamp)).toEqual(
    { ...current(), updatedAt: timestamp }
  )
  expect(() =>
    applyUserSettingsCommand(
      { ...current(), userId: "other-owner" },
      values,
      actor,
      timestamp
    )
  ).toThrow()
  expect(() =>
    applyUserSettingsCommand(
      { ...current(), deletedAt: timestamp },
      values,
      actor,
      timestamp
    )
  ).toThrow()
})
