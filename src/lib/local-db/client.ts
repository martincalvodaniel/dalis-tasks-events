"use client"

import {
  LOCAL_DATABASE_VERSION,
  migrateLocalDatabase,
} from "@/lib/local-db/migrations"
import { userIdSchema } from "@/schemas/primitives"

export function localDatabaseName(userId: string): string {
  return `dalis-account:${encodeURIComponent(userIdSchema.parse(userId))}`
}

export function openLocalDatabase(userId: string): Promise<IDBDatabase> {
  const name = localDatabaseName(userId)
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this environment"))
      return
    }
    const request = indexedDB.open(name, LOCAL_DATABASE_VERSION)
    let rejected = false
    request.onblocked = () => {
      rejected = true
      reject(new Error("Local database upgrade is blocked by another tab"))
    }
    request.onupgradeneeded = (event) => {
      try {
        migrateLocalDatabase(request.result, event.oldVersion)
      } catch (error) {
        rejected = true
        request.transaction?.abort()
        reject(error)
      }
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Local database failed to open"))
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      if (rejected) database.close()
      else resolve(database)
    }
  })
}
