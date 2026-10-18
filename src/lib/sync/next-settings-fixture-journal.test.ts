import { expect, test } from "bun:test"
import { planCategoryResolutionFixture } from "@/lib/backup/plan-category-resolution-fixture"
import { readNextSettingsFixtureJournal } from "@/lib/sync/next-settings-fixture-journal"
import { remoteRecurringChangesPageSchema } from "@/schemas/remote-recurring-changes"

function changes(count: number) {
  const item = planCategoryResolutionFixture().remote
  return Array.from({ length: count }, (_, index) => ({
    version: 2 as const,
    recipientUserId: item.ownerId,
    kind: "item" as const,
    sequence: index + 1,
    operationId: crypto.randomUUID(),
    item,
  }))
}
test("fixture diagnostics read every bounded page with the first checkpoint pinned", async () => {
  const journal = changes(145),
    calls: unknown[] = []
  const snapshot = await readNextSettingsFixtureJournal(async (query) => {
    calls.push(query)
    return {
      version: 2,
      changes: journal.slice(query.after, query.after + query.limit),
      nextAfter: Math.min(query.after + query.limit, 145),
      through: 145,
      hasMore: query.after + query.limit < 145,
    }
  })
  expect(calls).toEqual([
    { after: 0, through: null, limit: 100 },
    { after: 100, through: 145, limit: 100 },
  ])
  expect(snapshot.changes).toEqual(journal)
  expect(snapshot.hasMore).toBe(false)
  expect(remoteRecurringChangesPageSchema.safeParse(snapshot).success).toBe(
    false
  )
})
test("fixture diagnostics preserve an empty complete snapshot", async () => {
  expect(
    await readNextSettingsFixtureJournal(async () => ({
      version: 2,
      changes: [],
      nextAfter: 0,
      through: 0,
      hasMore: false,
    }))
  ).toEqual({
    version: 2,
    changes: [],
    nextAfter: 0,
    through: 0,
    hasMore: false,
  })
})
test("fixture diagnostics reject drifting checkpoints, gaps and stalled incomplete pages", async () => {
  for (const fault of ["checkpoint", "gap", "stalled"] as const) {
    const journal = changes(2)
    let calls = 0
    await expect(
      readNextSettingsFixtureJournal(async () => {
        calls++
        if (calls === 1)
          return {
            version: 2,
            changes: [journal[0]],
            nextAfter: 1,
            through: fault === "gap" ? 3 : 2,
            hasMore: true,
          }
        if (fault === "stalled")
          return {
            version: 2,
            changes: [],
            nextAfter: 1,
            through: 2,
            hasMore: true,
          }
        return {
          version: 2,
          changes: [{ ...journal[1], sequence: fault === "gap" ? 3 : 2 }],
          nextAfter: fault === "gap" ? 3 : 2,
          through: 3,
          hasMore: fault !== "gap",
        }
      })
    ).rejects.toThrow()
  }
})

test("fixture diagnostics reject an incomplete history beyond their own record cap", async () => {
  const journal = changes(10001)
  await expect(
    readNextSettingsFixtureJournal(async (query) => ({
      version: 2,
      changes: journal.slice(query.after, query.after + 100),
      nextAfter: Math.min(query.after + 100, 10001),
      through: 10001,
      hasMore: query.after + 100 < 10001,
    }))
  ).rejects.toThrow("complete record limit")
})

test("fixture diagnostics do not mistake an empty terminal page for missing history", async () => {
  await expect(
    readNextSettingsFixtureJournal(async () => ({
      version: 2,
      changes: [],
      nextAfter: 5,
      through: 5,
      hasMore: false,
    }))
  ).rejects.toThrow("skipped history")
})
