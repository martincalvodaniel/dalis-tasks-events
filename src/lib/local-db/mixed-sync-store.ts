"use client"

import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { applyLocalPreferenceResult } from "@/lib/local-db/preference-sync-results"
import { applyLocalChangesPageV2 } from "@/lib/local-db/pull-changes-v2"
import { LocalSyncStore } from "@/lib/local-db/sync-store"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { validateLocalSyncResultInputV2 } from "@/lib/sync/local-sync-result-v2"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import { userIdSchema } from "@/schemas/primitives"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPullCursor, OutboxEntry } from "@/types/local-sync"

// The caller must guard the active account and transition epoch around network work.
export class LocalMixedSyncStore {
  private closed = false

  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase,
    private readonly itemStore: LocalSyncStore,
    private readonly allowPlans: boolean
  ) {}

  static async open(
    userIdInput: string,
    allowPlans = false
  ): Promise<LocalMixedSyncStore> {
    const userId = userIdSchema.parse(userIdInput)
    const database = await openLocalDatabase(userId)
    let itemStore: LocalSyncStore | null = null
    try {
      itemStore = await LocalSyncStore.open(userId)
      const store = new LocalMixedSyncStore(
        userId,
        database,
        itemStore,
        allowPlans
      )
      store.ensurePartition()
      return store
    } catch (error) {
      itemStore?.close()
      database.close()
      throw error
    }
  }

  private ensurePartition(): void {
    if (this.closed) throw new Error("Mixed sync store is closed")
    if (
      this.database.name !== localDatabaseName(this.userId) ||
      this.itemStore.userId !== this.userId
    )
      throw new Error("Mixed sync store belongs to another partition")
  }

  readPullCursor(): Promise<LocalPullCursor> {
    this.ensurePartition()
    return this.itemStore.readPullCursor()
  }

  readQueueState(): Promise<{
    entries: OutboxEntry[]
    items: CalendarItem[]
  }> {
    this.ensurePartition()
    return runLocalTransaction(
      this.database,
      ["items", "outbox"],
      "readonly",
      (context) => {
        const transaction = context.transaction
        const entries = transaction
          .objectStore("outbox")
          .getAll(undefined, 10001)
        const items = transaction.objectStore("items").getAll(undefined, 10001)
        let remaining = 2
        const finish = () => {
          if (--remaining) return
          try {
            const state = personalQueueDiagnosticsInputSchema.parse({
              userId: this.userId,
              entries: entries.result,
              items: items.result,
            })
            context.setResult({ entries: state.entries, items: state.items })
          } catch (error) {
            context.fail(error)
          }
        }
        entries.onsuccess = finish
        items.onsuccess = finish
      }
    )
  }

  applyChangesPage(input: unknown): Promise<"applied" | "ignored"> {
    this.ensurePartition()
    return applyLocalChangesPageV2(
      this.database,
      this.userId,
      input,
      this.allowPlans
    )
  }

  applyOperationResult(input: unknown): Promise<"applied" | "replayed"> {
    this.ensurePartition()
    const submission = validateLocalSyncResultInputV2(input, this.userId)
    return submission.result.kind === "preference"
      ? applyLocalPreferenceResult(this.database, this.userId, submission)
      : this.itemStore.applyOperationResult({
          ...submission,
          result: submission.result.outcome,
        })
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.itemStore.close()
    this.database.close()
  }
}
