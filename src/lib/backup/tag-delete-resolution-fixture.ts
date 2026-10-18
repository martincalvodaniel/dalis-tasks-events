import { tagOrderResolutionFixture } from "@/lib/backup/tag-order-resolution-fixture"
import { applyTagCommand } from "@/lib/preferences/preference-command"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { captureTagDeletionResolutionSnapshot } from "@/lib/sync/tag-delete-resolution"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
export function tagDeletionResolutionFixture(
  actor = "category-deletion-owner"
) {
  const base = tagOrderResolutionFixture(actor),
    command = { type: "tag.delete" as const, tagId: base.original[0].id },
    entry = outboxEntrySchema.parse({
      ...base.entry,
      operation: { ...base.entry.operation, command },
    }),
    local = base.original.map((tag, index) =>
      index === 0
        ? applyTagCommand(base.original, command, actor, base.now)
        : tag
    ),
    outcome = localPreferenceOutcomeV2Schema.parse({
      ...base.outcome,
      operation: entry.operation,
      local: [
        {
          entityKey: entry.entityKey,
          record: { store: "tags", record: local[0] },
        },
      ],
    }),
    input = {
      ...base.input,
      tags: local,
      entries: [entry],
      outcomes: [outcome],
    },
    projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Category deletion fixture incident missing")
  const capture = {
      userId: actor,
      incident: projected.incident,
      entries: input.entries,
      localTags: local,
      observedTags: base.observed,
    },
    snapshot = captureTagDeletionResolutionSnapshot(capture)
  return {
    actor,
    now: base.now,
    original: base.original,
    observed: base.observed,
    local,
    entry,
    outcome,
    input,
    capture,
    snapshot,
  }
}
