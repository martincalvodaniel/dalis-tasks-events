import "server-only"

import { type Db, MongoClient } from "mongodb"
import { getDatabaseEnv } from "@/config/env"
import { ensureIndexes } from "@/lib/db/ensure-indexes"

interface MongoGlobal {
  dalisMongoClientPromise?: Promise<MongoClient>
}

const mongoGlobal = globalThis as typeof globalThis & MongoGlobal

let clientPromise: Promise<MongoClient> | undefined

function createClientPromise(): Promise<MongoClient> {
  return new MongoClient(getDatabaseEnv().uri).connect()
}

function getClientPromise(): Promise<MongoClient> {
  const databaseEnv = getDatabaseEnv()
  if (databaseEnv.isDevelopment) {
    if (!mongoGlobal.dalisMongoClientPromise) {
      const connection = createClientPromise()
      mongoGlobal.dalisMongoClientPromise = connection
      connection.catch(() => {
        if (mongoGlobal.dalisMongoClientPromise === connection) {
          mongoGlobal.dalisMongoClientPromise = undefined
        }
      })
    }

    return mongoGlobal.dalisMongoClientPromise
  }

  if (!clientPromise) {
    const connection = createClientPromise()
    clientPromise = connection
    connection.catch(() => {
      if (clientPromise === connection) {
        clientPromise = undefined
      }
    })
  }

  return clientPromise
}

let indexesPromise: Promise<void> | undefined

async function ensureIndexesOnce(database: Db): Promise<void> {
  if (!indexesPromise) {
    indexesPromise = ensureIndexes(database).catch((error: unknown) => {
      indexesPromise = undefined
      throw error
    })
  }

  await indexesPromise
}

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise()
  const database = client.db(getDatabaseEnv().databaseName)

  await ensureIndexesOnce(database)

  return database
}

export async function closeDatabaseConnection(): Promise<void> {
  const activeClientPromise =
    mongoGlobal.dalisMongoClientPromise ?? clientPromise

  if (!activeClientPromise) {
    return
  }

  try {
    const client = await activeClientPromise
    await client.close()
  } finally {
    indexesPromise = undefined
    clientPromise = undefined

    mongoGlobal.dalisMongoClientPromise = undefined
  }
}
