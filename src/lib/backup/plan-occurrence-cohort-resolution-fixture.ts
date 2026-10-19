import { capturePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import {
  planOccurrenceCohortResolution,
  planOccurrenceCohortRetryOperationCount,
} from "@/lib/sync/plan-occurrence-cohort-resolution"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { localRecurringBackupV3Schema } from "@/schemas/local-recurring-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"

export function planOccurrenceCohortResolutionFixture(
  retry = true,
  prerequisite = false
) {
  let source = planOccurrenceCohortFixture()
  if (prerequisite) {
    const entry = outboxEntrySchema.parse({
      ...source.entries[0],
      state: "acknowledged",
      sequence: 1,
      operation: {
        ...source.entries[0].operation,
        operationId: crypto.randomUUID(),
        command: {
          ...source.entries[0].operation.command,
          status: "not_started",
          expectedOccurrenceRevision: 8,
        },
      },
    })
    const outcome = localPlanOccurrenceOutcomeSchema.parse({
      ...source.outcomes[0],
      key: `operation-outcome:${entry.operation.operationId}`,
      operation: entry.operation,
      result: {
        kind: "plan-occurrence",
        userId: source.userId,
        outcome: {
          status: "applied",
          operationId: entry.operation.operationId,
          sequence: 1,
          seriesRevision: 3,
          occurrence: source.shadows[0].record,
        },
      },
    })
    source = {
      ...source,
      entries: [
        entry,
        ...source.entries.map((value, index) => ({
          ...value,
          sequence: value.sequence + 1,
          dependencies: index
            ? value.dependencies
            : [entry.operation.operationId],
        })),
      ],
      outcomes: [outcome, ...source.outcomes],
    }
  }
  const expected = capturePlanOccurrenceCohortComparison(source)
  const request = {
    userId: source.userId,
    resolutionId: crypto.randomUUID(),
    choice: retry ? "retry_local" : "adopt_remote",
    operationIds: retry
      ? Array.from(
          { length: planOccurrenceCohortRetryOperationCount(expected) },
          () => crypto.randomUUID()
        )
      : [],
    createdAt: "2026-10-19T17:00:00.000Z",
    expected,
  }
  const record = planOccurrenceCohortResolution(request, expected)
  const ids = new Set(record.supersededOperationIds)
  const maximum = Math.max(...source.entries.map((entry) => entry.sequence))
  const backup = localRecurringBackupV3Schema.parse({
    format: "dalis-local-backup",
    version: 3,
    protocolVersion: 1,
    databaseVersion: 2,
    userId: source.userId,
    exportedAt: request.createdAt,
    stores: {
      items: [source.series],
      occurrences: record.locals.map((slot) => slot.record),
      tags: [],
      itemViews: [],
      taskPlacements: [],
      settings: [],
      memberships: [],
      invitations: [],
      remoteShadows: source.shadows,
      outbox: [
        ...source.entries.map((entry) =>
          ids.has(entry.operation.operationId)
            ? { ...entry, state: "superseded", lease: null }
            : entry
        ),
        ...record.replacements.map((replacement, index) =>
          outboxEntrySchema.parse({
            userId: source.userId,
            entityKey: `item:${source.series.id}`,
            operation: replacement.operation,
            sequence: maximum + index + 1,
            dependencies: replacement.dependencies,
            state: "pending",
            attempts: 0,
            lease: null,
            createdAt: record.createdAt,
          })
        ),
      ],
      syncMetadata: [
        ...source.outcomes,
        record,
        { key: "outbox-sequence", value: maximum + record.replacements.length },
      ],
    },
  })
  return { source, expected, request, record, backup }
}
