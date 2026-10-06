"use client"

import { openLocalDatabase } from "@/lib/local-db/client"
import {
  type LocalRecords,
  type LocalStoreName,
  parseLocalRecord,
} from "@/lib/local-db/store-config"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { timestampSchema, userIdSchema } from "@/schemas/primitives"

export class LocalRepository {
  private constructor(
    readonly userId: string,
    private readonly database: IDBDatabase
  ) {}

  static async open(userId: string): Promise<LocalRepository> {
    const validUserId = userIdSchema.parse(userId)
    return new LocalRepository(
      validUserId,
      await openLocalDatabase(validUserId)
    )
  }

  close(): void {
    this.database.close()
  }

  get<Store extends LocalStoreName>(
    store: Store,
    key: IDBValidKey
  ): Promise<LocalRecords[Store] | null> {
    return runLocalTransaction(
      this.database,
      [store],
      "readonly",
      (context) => {
        const request = context.transaction.objectStore(store).get(key)
        request.onsuccess = () => {
          try {
            context.setResult(
              request.result === undefined
                ? null
                : parseLocalRecord(store, request.result, this.userId)
            )
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  list<Store extends LocalStoreName>(
    store: Store,
    options: {
      includeDeleted?: boolean
      index?: string
      query?: IDBValidKey | IDBKeyRange
    } = {}
  ): Promise<LocalRecords[Store][]> {
    return runLocalTransaction(
      this.database,
      [store],
      "readonly",
      (context) => {
        const objectStore = context.transaction.objectStore(store)
        const source = options.index
          ? objectStore.index(options.index)
          : objectStore
        const request = source.getAll(options.query)
        request.onsuccess = () => {
          try {
            const records = request.result.map((value) =>
              parseLocalRecord(store, value, this.userId)
            )
            context.setResult(
              options.includeDeleted
                ? records
                : records.filter((record) => !record.deletedAt)
            )
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }

  // Low-level cache writes. Product edits must use the atomic outbox layer added in 03b.
  async put<Store extends LocalStoreName>(
    store: Store,
    value: LocalRecords[Store]
  ): Promise<LocalRecords[Store]> {
    const record = parseLocalRecord(store, value, this.userId)
    return runLocalTransaction(
      this.database,
      [store],
      "readwrite",
      (context) => {
        context.transaction.objectStore(store).put(record)
        context.setResult(record)
      }
    )
  }

  tombstone<Store extends LocalStoreName>(
    store: Store,
    key: IDBValidKey,
    deletedAt: string
  ): Promise<LocalRecords[Store]> {
    const timestamp = timestampSchema.parse(deletedAt)
    return runLocalTransaction(
      this.database,
      [store],
      "readwrite",
      (context) => {
        const objectStore = context.transaction.objectStore(store)
        const request = objectStore.get(key)
        request.onsuccess = () => {
          try {
            if (request.result === undefined)
              throw new Error("Local record does not exist")
            const record = parseLocalRecord(
              store,
              { ...request.result, deletedAt: timestamp, updatedAt: timestamp },
              this.userId
            )
            objectStore.put(record)
            context.setResult(record)
          } catch (error) {
            context.fail(error)
          }
        }
      }
    )
  }
}
