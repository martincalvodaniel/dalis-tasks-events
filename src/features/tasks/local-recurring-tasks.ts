"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { createTaskOccurrenceIndex } from "@/lib/calendar/task-occurrence-selection"
import { openLocalDatabase } from "@/lib/local-db/client"
import { readLocalTaskSnapshot } from "@/lib/local-db/task-snapshot"

export async function readLocalRecurringTasks(account: LocalAccount) {
  await requireActiveAccount(account)
  const database = await openLocalDatabase(account.userId)
  try {
    const snapshot = await readLocalTaskSnapshot(database, account.userId)
    const index = createTaskOccurrenceIndex(
      snapshot.items,
      snapshot.occurrences,
      account.userId
    )
    await requireActiveAccount(account)
    return { index, timeZone: snapshot.settings.timeZone }
  } finally {
    database.close()
  }
}
