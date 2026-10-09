import { describe, expect, test } from "bun:test"
import { validatePersonalIndexTarget } from "@/lib/db/personal-index-target"

const configured = {
  databaseName: "dalis-preview",
  mongodbAuthority: "cluster.example.mongodb.net",
}
const target = { ...configured, environment: "preproduction" as const }

describe("personal index target descriptor", () => {
  test("requires an exact connection descriptor and returns a detached target", () => {
    const result = validatePersonalIndexTarget(target, configured)
    expect(result).toEqual(target)
    expect(result).not.toBe(target)
    result.databaseName = "changed"
    expect(target.databaseName).toBe("dalis-preview")
    for (const authority of [
      "127.0.0.1:27017",
      "host-a:27017,host-b:27018",
      "[::1]:27017",
    ])
      expect(
        validatePersonalIndexTarget(
          { ...target, environment: "local", mongodbAuthority: authority },
          { ...configured, mongodbAuthority: authority }
        ).mongodbAuthority
      ).toBe(authority)
  })

  test("rejects mismatch, fallback, unsafe input and production without leaking values", () => {
    const cases: [unknown, unknown][] = [
      [{ ...target, environment: "production" }, configured],
      [{ ...target, extra: true }, configured],
      [{ ...target, databaseName: "dalis-preview-other" }, configured],
      [
        { ...target, mongodbAuthority: "evil-cluster.example.mongodb.net" },
        configured,
      ],
      [target, { ...configured, databaseName: undefined }],
      [target, { ...configured, databaseName: "" }],
      [target, { ...configured, extra: true }],
      [null, configured],
    ]
    for (const mongodbAuthority of [
      "user:secret@host",
      "mongodb://host",
      "mongodb+srv://host",
      "host/database",
      "host?password=secret",
      "host#fragment",
      "host\n",
      "",
    ])
      cases.push([
        { ...target, mongodbAuthority },
        { ...configured, mongodbAuthority },
      ])
    for (const [input, connection] of cases) {
      try {
        validatePersonalIndexTarget(input, connection)
        throw new Error("Invalid target was accepted")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          "Personal index provisioning target is invalid"
        )
        expect((error as Error).cause).toBeUndefined()
      }
    }
  })
})
