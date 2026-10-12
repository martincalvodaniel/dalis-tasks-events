import { expect, test } from "bun:test"
import { readRecurringSyncCommandCapability } from "@/lib/sync/recurring-sync-capabilities"
import { outboxEntrySchema } from "@/schemas/local-sync"
import {
  userSettingsEntityKey,
  userSettingsEntityKeySchema,
} from "@/schemas/user-settings-key"

test("personal settings keys are canonical and bind the actor in the durable intention", () => {
  const actor = "settings-owner:one"
  const entry = {
    userId: actor,
    entityKey: userSettingsEntityKey(actor),
    sequence: 1,
    dependencies: [],
    state: "pending",
    attempts: 0,
    lease: null,
    createdAt: "2026-10-12T08:00:00.000Z",
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "settings.update",
        input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
      },
    },
  }
  expect(outboxEntrySchema.safeParse(entry).success).toBe(true)
  expect(
    outboxEntrySchema.safeParse({
      ...entry,
      entityKey: "settings:another-owner",
    }).success
  ).toBe(false)
  for (const key of [
    "settings:",
    "settings: owner",
    "settings:owner ",
    "settings: ",
  ])
    expect(userSettingsEntityKeySchema.safeParse(key).success).toBe(false)
  expect(userSettingsEntityKeySchema.parse(userSettingsEntityKey(actor))).toBe(
    entry.entityKey
  )
  expect(
    readRecurringSyncCommandCapability(entry.operation.command)
  ).toMatchObject({ supported: false, reason: "settings_executor_unavailable" })
})
