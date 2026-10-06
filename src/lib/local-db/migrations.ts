"use client"

import { outboxStoreDefinitions } from "@/lib/local-db/outbox-stores"
import { localStoreDefinitions } from "@/lib/local-db/store-config"

export const LOCAL_DATABASE_VERSION = 2

export function migrateLocalDatabase(
  database: IDBDatabase,
  oldVersion: number
) {
  if (oldVersion < 1) {
    for (const [name, definition] of Object.entries(localStoreDefinitions)) {
      const store = database.createObjectStore(name, {
        keyPath: definition.keyPath,
      })
      for (const index of definition.indexes) {
        store.createIndex(index.name, index.keyPath, {
          unique: index.unique ?? false,
        })
      }
    }
  }
  if (oldVersion < 2) {
    for (const [name, definition] of Object.entries(outboxStoreDefinitions)) {
      const store = database.createObjectStore(name, {
        keyPath: definition.keyPath,
      })
      for (const index of definition.indexes) {
        store.createIndex(index.name, index.keyPath, { unique: index.unique })
      }
    }
  }
}
