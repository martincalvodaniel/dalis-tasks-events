import "server-only"

import { mongodbAdapter } from "better-auth/adapters/mongodb"
import type { DBAdapter, DBAdapterInstance } from "better-auth/types"
import type { CreateIndexesOptions, Db, IndexSpecification } from "mongodb"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"
import { getDatabase } from "@/lib/db/client"
import { INDEX_SPECS } from "@/lib/db/ensure-indexes"

export function createAuthAdapterDatabase(database: Db): Db {
  // Better Auth owns its queries. Restrict its database view to registered
  // auth collections and acknowledge only indexes already provisioned centrally.
  return new Proxy(database, {
    get(target, property) {
      if (property !== "collection") {
        const value = Reflect.get(target, property, target)
        return typeof value === "function" ? value.bind(target) : value
      }

      return (name: string) => {
        if (!Object.values(AUTH_MODEL_NAMES).some((model) => model === name)) {
          throw new Error(
            "The auth adapter requested an unregistered collection"
          )
        }

        const collection = target.collection(name)
        return new Proxy(collection, {
          get(collectionTarget, collectionProperty) {
            if (collectionProperty === "createIndex") {
              return async (
                keys: IndexSpecification,
                options?: CreateIndexesOptions
              ) => {
                const registered = INDEX_SPECS.find(
                  (spec) =>
                    spec.collection === name &&
                    spec.options.name === options?.name &&
                    JSON.stringify(spec.keys) === JSON.stringify(keys) &&
                    Boolean(spec.options.unique) === Boolean(options?.unique)
                )
                if (!registered) {
                  throw new Error(
                    "The auth adapter requested an unregistered index"
                  )
                }
                return registered.options.name
              }
            }

            const value = Reflect.get(
              collectionTarget,
              collectionProperty,
              collectionTarget
            )
            return typeof value === "function"
              ? value.bind(collectionTarget)
              : value
          },
        })
      }
    },
  })
}

export function createAuthDatabaseAdapter(
  loadDatabase: () => Promise<Db> = getDatabase
): DBAdapterInstance {
  return (options) => {
    let adapterPromise: Promise<DBAdapter> | undefined

    function getAdapter(): Promise<DBAdapter> {
      if (!adapterPromise) {
        // Delay connections until the first query, including during Next.js builds.
        adapterPromise = loadDatabase()
          .then((database) =>
            mongodbAdapter(createAuthAdapterDatabase(database), {
              // Auth uses document-level writes and registered unique indexes.
              // Sync transactions are introduced separately once deployment support is verified.
              transaction: false,
            })(options)
          )
          .catch((error: unknown) => {
            adapterPromise = undefined
            throw error
          })
      }
      return adapterPromise
    }

    return {
      id: "mongodb-adapter",
      create: async (data) => (await getAdapter()).create(data),
      findOne: async (data) => (await getAdapter()).findOne(data),
      findMany: async (data) => (await getAdapter()).findMany(data),
      count: async (data) => (await getAdapter()).count(data),
      update: async (data) => (await getAdapter()).update(data),
      updateMany: async (data) => (await getAdapter()).updateMany(data),
      delete: async (data) => (await getAdapter()).delete(data),
      deleteMany: async (data) => (await getAdapter()).deleteMany(data),
      consumeOne: async (data) => (await getAdapter()).consumeOne(data),
      incrementOne: async (data) => (await getAdapter()).incrementOne(data),
      transaction: async (callback) =>
        (await getAdapter()).transaction(callback),
    }
  }
}
