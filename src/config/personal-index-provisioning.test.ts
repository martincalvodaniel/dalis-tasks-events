import { describe, expect, test } from "bun:test"
import { parsePersonalIndexConnectionConfiguration } from "@/config/personal-index-provisioning"
import { validatePersonalIndexTarget } from "@/lib/db/personal-index-target"

describe("personal index connection configuration", () => {
  test("resolves explicit targets without returning credentials or changing seed order", () => {
    for (const [mongodbUri, mongodbAuthority] of [
      ["mongodb://127.0.0.1:27017", "127.0.0.1:27017"],
      [
        "mongodb://user:encoded%40secret@host-a:27017,host-b:27018/source?replicaSet=test",
        "host-a:27017,host-b:27018",
      ],
      [
        "mongodb+srv://user:secret@cluster.example.mongodb.net/source?retryWrites=true",
        "cluster.example.mongodb.net",
      ],
      ["mongodb://[::1]:27017/?directConnection=true", "[::1]:27017"],
    ]) {
      const config = parsePersonalIndexConnectionConfiguration({
        mongodbUri,
        databaseName: "dalis-preview",
      })
      expect(config).toEqual({
        databaseName: "dalis-preview",
        mongodbAuthority,
      })
      expect(
        validatePersonalIndexTarget(
          { ...config, environment: "preproduction" },
          config
        )
      ).toEqual({ ...config, environment: "preproduction" })
      expect(JSON.stringify(config)).not.toContain("secret")
    }
  })

  test("rejects missing database and ambiguous URIs with a generic error and no cause", () => {
    const cases: unknown[] = [
      { mongodbUri: "mongodb://host" },
      { mongodbUri: "mongodb://host", databaseName: "" },
      { mongodbUri: "mongodb://host", databaseName: "dalis.preview" },
      {
        mongodbUri: "mongodb://host",
        databaseName: "dalis-preview",
        extra: true,
      },
      null,
    ]
    for (const mongodbUri of [
      "https://host",
      "mongodb://",
      "mongodb://user:secret@host@evil",
      "mongodb://@host",
      "mongodb://user:raw:secret@host",
      "mongodb://user:%ZZ@host",
      "mongodb://host:0",
      "mongodb://host:65536",
      "mongodb://host:027017",
      "mongodb://host,,other",
      "mongodb://host,host",
      "mongodb://host..example",
      "mongodb://host/#fragment",
      "mongodb://host\n",
      "mongodb://[invalid]:27017",
      "mongodb+srv://host:27017",
      "mongodb+srv://host,other",
      "mongodb://%2Ftmp%2Fmongodb.sock",
    ])
      cases.push({ mongodbUri, databaseName: "dalis-preview" })
    for (const input of cases) {
      try {
        parsePersonalIndexConnectionConfiguration(input)
        throw new Error("Invalid configuration was accepted")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          "Personal index provisioning configuration is invalid"
        )
        expect((error as Error).cause).toBeUndefined()
      }
    }
  })
})
