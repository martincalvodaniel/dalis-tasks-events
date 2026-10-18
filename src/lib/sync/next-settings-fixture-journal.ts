import { nextSettingsSyncJournalSchema } from "@/schemas/next-sync-test"
import { remoteRecurringChangesPageSchema } from "@/schemas/remote-recurring-changes"

// Test diagnostics only: authenticate and verify the owned fixture before invoking this reader.
export async function readNextSettingsFixtureJournal(
  readPage: (query: {
    after: number
    through: number | null
    limit: number
  }) => Promise<unknown>
) {
  let after = 0,
    through: number | null = null
  const changes: ReturnType<
    typeof remoteRecurringChangesPageSchema.parse
  >["changes"] = []
  while (true) {
    const page = remoteRecurringChangesPageSchema.parse(
      await readPage({ after, through, limit: 100 })
    )
    through ??= page.through
    if (
      page.through !== through ||
      page.nextAfter !== after + page.changes.length ||
      (page.changes.length && page.changes[0].sequence !== after + 1) ||
      (page.hasMore && page.nextAfter <= after)
    )
      throw new Error(
        "Fixture journal pagination changed its checkpoint or skipped history"
      )
    if (changes.length + page.changes.length > 10000)
      throw new Error("Fixture journal exceeds its complete record limit")
    changes.push(...page.changes)
    if (!page.hasMore)
      return nextSettingsSyncJournalSchema.parse({ ...page, changes })
    after = page.nextAfter
  }
}
