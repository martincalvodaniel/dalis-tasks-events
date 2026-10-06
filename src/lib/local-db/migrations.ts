"use client"

import { localStoreDefinitions } from "@/lib/local-db/store-config"

export const LOCAL_DATABASE_VERSION = 1

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
}
