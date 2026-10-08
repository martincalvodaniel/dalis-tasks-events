import { expect, test } from "bun:test"
import { validateLocalSyncResultInputV2 } from "@/lib/sync/local-sync-result-v2"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"

const actor = "submission-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
function fixture(): LocalSyncResultInputV2 {
  const operationId = crypto.randomUUID()
  const tagId = crypto.randomUUID()
  const neighborId = crypto.randomUUID()
  return {
    senderId: crypto.randomUUID(),
    operation: {
      protocolVersion: 1,
      operationId,
      baseRevision: 2,
      command: { type: "tag.move", tagId, beforeId: neighborId, afterId: null },
    },
    result: {
      kind: "preference",
      outcome: {
        operationId,
        status: "applied",
        effects: {
          version: 1,
          userId: actor,
          operationId,
          sequence: 4,
          effects: [tagId, neighborId].map((id, index) => ({
            store: "tags",
            record: {
              id,
              userId: actor,
              name: `Category ${index}`,
              normalizedName: `category ${index}`,
              color: "#123456",
              position: index * 1024,
              revision: index === 0 ? 3 : 8,
              createdAt: timestamp,
              updatedAt: timestamp,
              deletedAt: null,
            },
          })),
        },
      },
    },
  }
}

test("mixed submissions retain full effects with independent revisions and cloned intentions", () => {
  const input = fixture()
  const before = structuredClone(input)
  const result = validateLocalSyncResultInputV2(input, actor)
  expect(result).toEqual(input)
  if (
    result.result.kind !== "preference" ||
    result.result.outcome.status !== "applied"
  )
    throw new Error("Expected personal result")
  expect(
    result.result.outcome.effects.effects.map(
      (effect) => effect.record.revision
    )
  ).toEqual([3, 8])
  result.operation.baseRevision = 9
  result.result.outcome.effects.effects[0].record.revision = 10
  expect(input).toEqual(before)
})

test("receipt correspondence rejects foreign accounts, other targets and families", () => {
  const input = fixture()
  expect(() => validateLocalSyncResultInputV2(input, "foreign")).toThrow()
  const wrongTarget = structuredClone(input)
  if (
    wrongTarget.result.kind !== "preference" ||
    wrongTarget.result.outcome.status !== "applied"
  )
    throw new Error("Expected personal result")
  wrongTarget.result.outcome.effects.effects.shift()
  expect(() => validateLocalSyncResultInputV2(wrongTarget, actor)).toThrow()
  expect(() =>
    validateLocalSyncResultInputV2(
      {
        ...input,
        result: {
          kind: "item",
          outcome: {
            operationId: input.operation.operationId,
            status: "unsupported",
          },
        },
      },
      actor
    )
  ).toThrow()
  for (const invalid of [
    { ...input, senderId: "invalid" },
    { ...input, unexpected: true },
    { ...input, operation: { ...input.operation, protocolVersion: 2 } },
    {
      ...input,
      operation: { ...input.operation, operationId: crypto.randomUUID() },
    },
    { ...input, result: { ...input.result, version: 3 } },
  ])
    expect(() => validateLocalSyncResultInputV2(invalid, actor)).toThrow()
})

test("both families retain rejected statuses without granting account ownership or an ACK", () => {
  const input = fixture()
  for (const kind of ["item", "preference"] as const) {
    const operation =
      kind === "item"
        ? {
            ...input.operation,
            command: {
              type: "item.delete" as const,
              itemId: crypto.randomUUID(),
            },
          }
        : input.operation
    for (const status of [
      "unsupported",
      "unavailable",
      "invalid_command",
      "identity_reuse",
    ] as const) {
      const submission = {
        senderId: input.senderId,
        operation,
        result: {
          kind,
          outcome: { operationId: operation.operationId, status },
        },
      }
      expect(validateLocalSyncResultInputV2(submission, actor)).toEqual(
        submission
      )
    }
  }
  expect(() => validateLocalSyncResultInputV2(input, "")).toThrow()
})
