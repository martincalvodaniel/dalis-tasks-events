import { describe, expect, test } from "bun:test"
import {
  parsePersonalIndexCliArguments,
  personalIndexCliArgumentsSchema,
} from "@/schemas/personal-index-cli"
import { personalIndexExecutionSchema } from "@/schemas/personal-index-target"

const args = [
  "local",
  "dalis-owned-test",
  "127.0.0.1:27017",
  "--apply",
  "--acknowledge-automatic-bootstrap",
]

describe("pure personal index CLI arguments", () => {
  test("accepts only the exact acknowledged target and returns detached execution input", () => {
    for (const [environment, authority] of [
      ["local", "127.0.0.1:27017"],
      ["local", "[::1]:27017"],
      ["local", "host-a:27017,host-b:27018"],
      ["preproduction", "cluster.example.mongodb.net"],
    ] as const) {
      const input = [environment, args[1], authority, ...args.slice(3)]
      const original = [...input]
      const result = parsePersonalIndexCliArguments(input)
      expect(result).toEqual({
        target: {
          environment,
          databaseName: args[1],
          mongodbAuthority: authority,
        },
        acknowledgeAutomaticBootstrap: true,
      })
      expect(personalIndexExecutionSchema.parse(result)).toEqual(result)
      result.target.databaseName = "changed"
      expect(input).toEqual(original)
    }
  })

  test("rejects absent, extra, reordered or substituted positional flags", () => {
    for (const input of [
      [],
      args.slice(0, 3),
      args.slice(0, 4),
      [...args, "--extra"],
      [...args.slice(0, 3), args[4], args[3]],
      [...args.slice(0, 3), "--dry-run", args[4]],
      [...args.slice(0, 4), "--acknowledge-automatic-bootstrap=true"],
      ["--apply", ...args.slice(0, 3), args[4]],
      null,
      {},
      args.join(" "),
      ["local", args[1], args[2], true, true],
    ]) {
      expect(personalIndexCliArgumentsSchema.safeParse(input).success).toBe(
        false
      )
      expect(() => parsePersonalIndexCliArguments(input)).toThrow(
        "Invalid personal index provisioning arguments"
      )
    }
  })

  test("rejects production, unsafe database names and credential-bearing authorities without disclosure", () => {
    const invalid = [
      ["production", ...args.slice(1)],
      ["LOCAL", ...args.slice(1)],
      [" local", ...args.slice(1)],
      ...[
        "",
        "../database",
        "db/name",
        "db name",
        "-database",
        "a".repeat(65),
      ].map((name) => [args[0], name, ...args.slice(2)]),
      ...[
        "",
        "mongodb://host",
        "mongodb+srv://host",
        "user:secret@host",
        "host/database",
        "host?password=secret",
        "host#fragment",
        "host\n",
        "host ",
      ].map((authority) => [...args.slice(0, 2), authority, ...args.slice(3)]),
    ]
    for (const input of invalid) {
      let caught: unknown
      try {
        parsePersonalIndexCliArguments(input)
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(Error)
      const error = caught as Error
      expect(error.message).toBe(
        "Invalid personal index provisioning arguments"
      )
      expect(error.cause).toBeUndefined()
      expect(error.message).not.toContain("secret")
      expect(error.message).not.toContain("mongodb://")
    }
  })
})
