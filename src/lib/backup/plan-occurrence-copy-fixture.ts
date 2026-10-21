import { planOccurrenceCopy } from "@/lib/sync/plan-occurrence-copy"
import { planOccurrenceCopyFixture } from "@/lib/sync/plan-occurrence-copy-fixture"
import { localRecurringBackupV3Schema } from "@/schemas/local-recurring-backup"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { Plan } from "@/types/plan-item"

export function planOccurrenceCopyBackupFixture(
  variant: Plan["variant"] = "task"
) {
  const f = planOccurrenceCopyFixture(variant),
    record = planOccurrenceCopy(f.request, f.snapshot),
    maximum = f.entries.reduce(
      (maximum, entry) => Math.max(maximum, entry.sequence),
      0
    ),
    backup = localRecurringBackupV3Schema.parse({
      format: "dalis-local-backup",
      version: 3,
      protocolVersion: 1,
      databaseVersion: 2,
      userId: f.userId,
      exportedAt: record.createdAt,
      stores: {
        items: [f.series, record.copy],
        occurrences: f.occurrences.map((value) =>
          value.id === record.local.id ? record.local : value
        ),
        tags: [],
        itemViews: [],
        taskPlacements: [],
        settings: [],
        memberships: [],
        invitations: [],
        remoteShadows: [
          {
            version: 2,
            kind: "item",
            entityKey: `item:${f.series.id}`,
            record: f.series,
          },
          ...f.shadows,
        ],
        outbox: [
          ...f.entries.map((entry) => ({
            ...entry,
            state: "superseded",
            lease: null,
          })),
          outboxEntrySchema.parse({
            userId: f.userId,
            entityKey: `item:${record.copyItemId}`,
            operation: record.replacement,
            sequence: maximum + 1,
            dependencies: [],
            state: "pending",
            attempts: 0,
            lease: null,
            createdAt: record.createdAt,
          }),
        ],
        syncMetadata: [
          ...f.outcomes,
          record,
          { key: "outbox-sequence", value: maximum + 1 },
        ],
      },
    })
  return { ...f, record, backup }
}
