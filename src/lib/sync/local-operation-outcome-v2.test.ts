import { expect, test } from "bun:test"
import {
  decodeLocalOperationOutcome,
  validateLocalPreferenceOutcomeV2,
} from "@/lib/sync/local-operation-outcome-v2"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import type { LocalPreferenceOutcomeV2 } from "@/types/local-operation-outcome-v2"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { SyncCommand } from "@/types/sync"

const actor = "personal-outcome-owner"
const timestamp = "2026-10-08T00:00:00.000Z"
function tag(
  id: string,
  revision: number
): Extract<PreferenceEffect, { store: "tags" }> {
  return {
    store: "tags",
    record: {
      id,
      userId: actor,
      name: "Observed",
      normalizedName: "observed",
      color: "#123456",
      position: 1024,
      revision,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
}
function fixture(): LocalPreferenceOutcomeV2 {
  const operationId = crypto.randomUUID()
  const id = crypto.randomUUID()
  const neighbor = crypto.randomUUID()
  const effects = [tag(id, 2), tag(neighbor, 8)]
  return {
    version: 2,
    kind: "preference",
    key: `operation-outcome:${operationId}`,
    operation: {
      operationId,
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "tag.move",
        tagId: id,
        beforeId: neighbor,
        afterId: null,
      },
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
          sequence: 3,
          effects,
        },
      },
    },
    local: effects.map((effect) => ({
      entityKey: `tag:${effect.record.id}`,
      record: { ...effect, record: { ...effect.record, revision: 0 } },
    })),
    base: effects.map((effect) => ({
      entityKey: `tag:${effect.record.id}`,
      record: { ...effect, record: { ...effect.record, revision: 20 } },
    })),
  }
}

test("personal outcomes retain every independent compaction revision and older replay against newer bases", () => {
  const input = fixture()
  if (input.result.outcome.status !== "applied")
    throw new Error("Expected effects")
  input.result.outcome.effects.effects[1].record.deletedAt = timestamp
  input.local.reverse()
  const before = structuredClone(input)
  const value = validateLocalPreferenceOutcomeV2(input, actor)
  expect(value).toEqual(input)
  expect(value.result.outcome).toEqual(before.result.outcome)
  expect(value.base.map((entry) => entry.record?.record.revision)).toEqual([
    20, 20,
  ])
  expect(value.local.map((entry) => entry.record?.record.revision)).toEqual([
    0, 0,
  ])
  value.operation.baseRevision = 30
  if (!value.base[0].record) throw new Error("Expected observed base")
  value.base[0].record.record.revision = 40
  expect(input).toEqual(before)
  expect(decodeLocalOperationOutcome(input, actor)).toEqual(input)
})

test("conflict evidence preserves the command target without treating current as its ancestor", () => {
  const input = fixture()
  if (input.operation.command.type !== "tag.move")
    throw new Error("Expected movement")
  input.result.outcome = {
    operationId: input.operation.operationId,
    status: "conflict",
    current: tag(input.operation.command.tagId, 2),
  }
  input.local = [input.local[0]]
  input.base = [input.base[0]]
  expect(decodeLocalOperationOutcome(input, actor)).toEqual(input)
  expect(() =>
    decodeLocalOperationOutcome(
      {
        ...input,
        result: {
          ...input.result,
          outcome: {
            ...input.result.outcome,
            current: tag(crypto.randomUUID(), 2),
          },
        },
      },
      actor
    )
  ).toThrow()
})

test("document-free errors require explicit observed absence of the primary identity for every known personal family", () => {
  const id = crypto.randomUUID()
  const commands: [SyncCommand, string][] = [
    [
      {
        type: "tag.save",
        tagId: id,
        input: { name: "Local", color: "#123456", position: 1024 },
      },
      `tag:${id}`,
    ],
    [{ type: "tag.delete", tagId: id }, `tag:${id}`],
    [
      { type: "item-view.set", itemId: id, primaryTagId: null },
      `item-view:${id}`,
    ],
    [
      {
        type: "settings.update",
        input: { timeZone: "Europe/Madrid", weekStartsOn: 1, locale: "es-ES" },
      },
      `settings:${actor}`,
    ],
    [
      {
        type: "task.move",
        itemId: id,
        occurrenceId: null,
        scope: "overdue",
        date: "2026-10-08",
        tagId: null,
        beforeId: null,
        afterId: null,
      },
      taskPlacementEntityKey(id, "overdue", "2026-10-08"),
    ],
  ]
  for (const [command, entityKey] of commands)
    for (const status of [
      "unsupported",
      "unavailable",
      "invalid_command",
      "identity_reuse",
    ] as const) {
      const input = fixture()
      input.operation.command = command
      input.result.outcome = {
        operationId: input.operation.operationId,
        status,
      }
      input.local = [{ entityKey, record: null }]
      input.base = [{ entityKey, record: null }]
      expect(decodeLocalOperationOutcome(input, actor)).toEqual(input)
      expect(() =>
        decodeLocalOperationOutcome({ ...input, local: [] }, actor)
      ).toThrow()
      expect(() =>
        decodeLocalOperationOutcome({ ...input, base: [] }, actor)
      ).toThrow()
    }
})

test("missing, duplicated, extra, foreign and mismatched snapshots reject the entire outcome", () => {
  const input = fixture()
  const first = input.base[0]
  if (!first.record) throw new Error("Expected base")
  for (const invalid of [
    { ...input, local: input.local.slice(0, 1) },
    { ...input, base: input.base.slice(0, 1) },
    { ...input, local: [input.local[0], input.local[0]] },
    {
      ...input,
      base: [
        ...input.base,
        { entityKey: `tag:${crypto.randomUUID()}`, record: null },
      ],
    },
    {
      ...input,
      base: [
        {
          ...first,
          record: {
            ...first.record,
            record: { ...first.record.record, revision: 0 },
          },
        },
        input.base[1],
      ],
    },
    {
      ...input,
      local: [
        {
          ...first,
          record: {
            ...first.record,
            record: { ...first.record.record, userId: "foreign" },
          },
        },
        input.local[1],
      ],
    },
    {
      ...input,
      base: [
        { ...first, entityKey: `item-view:${crypto.randomUUID()}` },
        input.base[1],
      ],
    },
  ])
    expect(() => decodeLocalOperationOutcome(invalid, actor)).toThrow()
  expect(() => decodeLocalOperationOutcome(input, "foreign")).toThrow()
})

test("view outcomes bind the result and observed records to the same own item identity", () => {
  const input = fixture()
  const itemId = crypto.randomUUID()
  const primaryTagId = crypto.randomUUID()
  const effect: PreferenceEffect = {
    store: "itemViews",
    record: {
      itemId,
      primaryTagId,
      userId: actor,
      revision: 3,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  }
  input.operation.command = { type: "item-view.set", itemId, primaryTagId }
  input.operation.baseRevision = 2
  input.result.outcome = {
    operationId: input.operation.operationId,
    status: "applied",
    effects: {
      version: 1,
      operationId: input.operation.operationId,
      userId: actor,
      sequence: 1,
      effects: [effect],
    },
  }
  input.local = [{ entityKey: `item-view:${itemId}`, record: null }]
  input.base = [{ entityKey: `item-view:${itemId}`, record: effect }]
  expect(decodeLocalOperationOutcome(input, actor)).toEqual(input)
  expect(() =>
    decodeLocalOperationOutcome(
      {
        ...input,
        operation: {
          ...input.operation,
          command: { ...input.operation.command, itemId: crypto.randomUUID() },
        },
      },
      actor
    )
  ).toThrow()
  expect(() =>
    decodeLocalOperationOutcome(
      {
        ...input,
        local: [
          ...input.local,
          { entityKey: `tag:${primaryTagId}`, record: null },
        ],
      },
      actor
    )
  ).toThrow()
})

test("future, ambiguous, corrupt identities and results of another family or target reject", () => {
  const input = fixture()
  for (const invalid of [
    { ...input, version: 3 },
    { ...input, unexpected: true },
    { ...input, kind: "item" },
    { ...input, key: `operation-outcome:${crypto.randomUUID()}` },
    { ...input, operation: { ...input.operation, protocolVersion: 2 } },
    {
      ...input,
      operation: {
        ...input.operation,
        command: { type: "item.delete", itemId: crypto.randomUUID() },
      },
    },
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
    {
      ...input,
      result: {
        kind: "preference",
        outcome: { operationId: crypto.randomUUID(), status: "unsupported" },
      },
    },
  ])
    expect(() => decodeLocalOperationOutcome(invalid, actor)).toThrow()
  if (input.result.outcome.status !== "applied")
    throw new Error("Expected effects")
  const invalid = structuredClone(input)
  if (invalid.result.outcome.status !== "applied")
    throw new Error("Expected effects")
  invalid.result.outcome.effects.effects.shift()
  expect(() => decodeLocalOperationOutcome(invalid, actor)).toThrow()
  invalid.result.outcome.effects.userId = "foreign"
  expect(() => decodeLocalOperationOutcome(invalid, actor)).toThrow()
})

test("common decoding preserves strict legacy item evidence and known item envelopes", () => {
  const operationId = crypto.randomUUID()
  const itemId = crypto.randomUUID()
  const input = {
    key: `operation-outcome:${operationId}`,
    operation: {
      operationId,
      protocolVersion: 1 as const,
      baseRevision: 2,
      command: { type: "item.delete" as const, itemId },
    },
    result: { operationId, status: "unavailable" as const },
    local: null,
    base: null,
  }
  const normalized = decodeLocalOperationOutcome(input, actor)
  expect(normalized).toEqual({
    ...input,
    version: 2,
    kind: "item",
    result: { kind: "item", outcome: input.result },
  })
  expect(decodeLocalOperationOutcome(normalized, actor)).toEqual(normalized)
  expect(() =>
    decodeLocalOperationOutcome({ ...input, extra: true }, actor)
  ).toThrow()
})

test("the aggregate byte ceiling measures UTF8 and rejects oversized evidence without truncation", () => {
  const input = {
    ...fixture(),
    unexpected: "界".repeat(Math.ceil(maximumLocalOperationOutcomeBytes / 3)),
  }
  const before = JSON.stringify(input)
  expect(before.length).toBeLessThan(maximumLocalOperationOutcomeBytes)
  expect(() => decodeLocalOperationOutcome(input, actor)).toThrow("byte limit")
  expect(JSON.stringify(input)).toBe(before)
})
