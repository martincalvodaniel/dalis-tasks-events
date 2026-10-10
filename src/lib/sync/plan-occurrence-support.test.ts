import { expect, test } from "bun:test"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { remoteOperationKind } from "@/lib/sync/remote-push-v2"
import {
  readPlacementSyncCommandCapability,
  readPlanSyncCommandCapability,
  readSyncCommandCapability,
} from "@/lib/sync/sync-capabilities"
import { localBackupStoresSchema } from "@/schemas/local-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceCommandSchema } from "@/schemas/plan-occurrence-command"
import { syncCommandSchema } from "@/schemas/sync"

const itemId = "00000000-0000-4000-8000-000000000001"
const entryId = "00000000-0000-4000-8000-000000000002"
const now = "2026-10-10T09:00:00.000Z"
const plan = planSchema.parse({
  kind: "plan",
  variant: "note",
  id: itemId,
  ownerId: "occurrence-contract-owner",
  title: "Repeat",
  description: "",
  status: "not_started",
  completedAt: null,
  checklist: [{ id: entryId, text: "Step", completed: false }],
  schedule: {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-11",
  },
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-10",
    interval: 1,
    timeZone: "Europe/Madrid",
    end: { type: "never" },
  },
  revision: 0,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
})
const occurrence = planOccurrencesPage(plan, {
  startDate: "2026-10-10",
  endDate: "2026-10-10",
}).occurrences[0]
const commands = planOccurrenceCommandSchema.options.map((schema, index) =>
  schema.parse(
    [
      {
        type: "plan.set-occurrence-status",
        itemId,
        occurrenceId: occurrence.id,
        status: "completed",
      },
      {
        type: "plan.set-occurrence-checklist-entry",
        itemId,
        occurrenceId: occurrence.id,
        entryId,
        completed: true,
      },
      {
        type: "plan.update-occurrence",
        itemId,
        occurrenceId: occurrence.id,
        input: {
          title: "Changed",
          description: "",
          schedule: occurrence.schedule,
          checklist: [],
        },
      },
      { type: "plan.cancel-occurrence", itemId, occurrenceId: occurrence.id },
    ][index]
  )
)

test("common occurrence intentions are durable item intentions but unsupported by every remote policy", () => {
  for (const command of commands) {
    expect(syncCommandSchema.parse(command)).toEqual(command)
    expect(remoteOperationKind(command)).toBe("item")
    for (const read of [
      readSyncCommandCapability,
      readPlacementSyncCommandCapability,
      readPlanSyncCommandCapability,
    ]) {
      expect(read(command, plan)).toMatchObject({
        supported: false,
        reason: "occurrence_executor_unavailable",
        kind: "item",
        requiresRemoteValidation: true,
      })
      expect(read(command, null).supported).toBe(false)
    }
    expect(
      syncCommandSchema.safeParse({ ...command, occurrenceId: null }).success
    ).toBe(false)
    expect(
      syncCommandSchema.safeParse({ ...command, extra: true }).success
    ).toBe(false)
  }
})

test("backup store validation retains common occurrences and original UUID, payload and dependency evidence", () => {
  const entries = commands.map((command, index) =>
    outboxEntrySchema.parse({
      userId: plan.ownerId,
      entityKey: `item:${itemId}`,
      sequence: index + 1,
      operation: {
        operationId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
        protocolVersion: 1,
        baseRevision: 0,
        command,
      },
      dependencies: [],
      state: "pending",
      attempts: 0,
      createdAt: now,
      lease: null,
    })
  )
  const stores = localBackupStoresSchema.parse({
    items: [plan],
    occurrences: [occurrence],
    outbox: entries,
    tags: [],
    itemViews: [],
    taskPlacements: [],
    settings: [],
    memberships: [],
    invitations: [],
    remoteShadows: [],
    syncMetadata: [],
  })
  expect(stores.occurrences).toEqual([occurrence])
  expect(stores.outbox).toEqual(entries)
  expect(itemOccurrenceSchema.parse(occurrence)).toEqual(occurrence)
  expect(
    itemOccurrenceSchema.safeParse({ ...occurrence, completedAt: now }).success
  ).toBe(false)
})
