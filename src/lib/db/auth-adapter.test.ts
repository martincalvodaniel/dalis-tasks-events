import "server-only"

import { describe, expect, mock, test } from "bun:test"
import type { Db } from "mongodb"
import {
  createAuthAdapterDatabase,
  createAuthDatabaseAdapter,
} from "@/lib/db/auth-adapter"

describe("auth adapter database boundary", () => {
  test("acknowledges registered indexes without creating them", async () => {
    const createIndex = mock(async () => "unexpected")
    const database = {
      collection: () => ({ createIndex }),
    } as unknown as Db
    const guarded = createAuthAdapterDatabase(database)

    const name = await guarded
      .collection("users")
      .createIndex({ email: 1 }, { name: "users_email_uidx", unique: true })

    expect(name).toBe("users_email_uidx")
    expect(createIndex).not.toHaveBeenCalled()
    await expect(
      guarded.collection("users").createIndex({ name: 1 }, { name: "other" })
    ).rejects.toThrow("unregistered index")
    await expect(
      guarded
        .collection("users")
        .createIndex({ email: 1 }, { name: "users_email_uidx", unique: false })
    ).rejects.toThrow("unregistered index")
    expect(() => guarded.collection("items")).toThrow("unregistered collection")
    expect(createIndex).not.toHaveBeenCalled()
  })

  test("preserves the receiver of driver methods", async () => {
    const collection = {
      marker: 7,
      async countDocuments() {
        return this.marker
      },
    }
    const database = {
      collection: () => collection,
    } as unknown as Db

    expect(
      await createAuthAdapterDatabase(database)
        .collection("users")
        .countDocuments()
    ).toBe(7)
  })
})

describe("lazy auth adapter", () => {
  test("does not connect on import and retries failed initialization", async () => {
    const loadDatabase = mock(async (): Promise<Db> => {
      throw new Error("Test database unavailable")
    })
    const adapter = createAuthDatabaseAdapter(loadDatabase)({})
    expect(loadDatabase).not.toHaveBeenCalled()

    const results = await Promise.allSettled([
      adapter.findOne({ model: "user", where: [] }),
      adapter.findOne({ model: "user", where: [] }),
    ])
    expect(results.every((result) => result.status === "rejected")).toBe(true)
    expect(loadDatabase).toHaveBeenCalledTimes(1)

    await expect(adapter.findOne({ model: "user", where: [] })).rejects.toThrow(
      "Test database unavailable"
    )
    expect(loadDatabase).toHaveBeenCalledTimes(2)
  })
})
