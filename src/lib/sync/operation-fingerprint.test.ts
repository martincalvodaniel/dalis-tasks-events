import "server-only"

import { describe, expect, test } from "bun:test"
import { syncOperationFingerprint } from "@/lib/sync/operation-fingerprint"

const operationId = "00000000-0000-4000-8000-000000000001"
const itemId = "00000000-0000-4000-8000-000000000002"
const otherId = "00000000-0000-4000-8000-000000000003"
const deletion = {
  operationId,
  protocolVersion: 1,
  baseRevision: 4,
  command: { type: "item.delete", itemId },
}
const creation = {
  operationId,
  protocolVersion: 1,
  baseRevision: 0,
  command: {
    type: "item.create",
    itemId,
    input: {
      kind: "task",
      title: "Comprar pan",
      description: "Café ☕",
      scheduledDate: "2026-10-07",
      status: "not_started",
      recurrence: null,
      checklist: [
        { id: itemId, text: "Primero", completed: false },
        { id: otherId, text: "Segundo", completed: true },
      ],
    },
  },
}

function reverseProperties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseProperties)
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .toReversed()
        .map(([key, nested]) => [key, reverseProperties(nested)])
    )
  return value
}

describe("sync operation fingerprints", () => {
  test("matches an independent SHA256 oracle for the versioned canonical payload", async () => {
    const canonical = `{"baseRevision":4,"command":{"itemId":"${itemId}","type":"item.delete"},"operationId":"${operationId}","protocolVersion":1}`
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`sync-operation-fingerprint:v1\n${canonical}`)
    )
    const expected = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
    expect(syncOperationFingerprint(deletion)).toBe(expected)
    expect(expected).toMatch(/^[0-9a-f]{64}$/)
  })

  test("ignores property order, preserves input and uses existing input normalization", () => {
    const snapshot = JSON.stringify(creation)
    const hash = syncOperationFingerprint(creation)
    expect(syncOperationFingerprint(reverseProperties(creation))).toBe(hash)
    expect(
      syncOperationFingerprint({
        ...creation,
        command: {
          ...creation.command,
          input: { ...creation.command.input, title: "  Comprar pan  " },
        },
      })
    ).toBe(hash)
    expect(JSON.stringify(creation)).toBe(snapshot)
  })

  test("detects changed identity, revision, command content and array order", () => {
    const hash = syncOperationFingerprint(deletion)
    for (const change of [
      { ...deletion, operationId: otherId },
      { ...deletion, baseRevision: 5 },
      { ...deletion, command: { type: "item.delete", itemId: otherId } },
    ])
      expect(syncOperationFingerprint(change)).not.toBe(hash)
    const input = creation.command.input
    for (const changedInput of [
      { ...input, checklist: input.checklist.toReversed() },
      { ...input, description: "Cafe ☕" },
      {
        ...input,
        checklist: [
          { ...input.checklist[0], completed: true },
          input.checklist[1],
        ],
      },
    ])
      expect(
        syncOperationFingerprint({
          ...creation,
          command: { ...creation.command, input: changedInput },
        })
      ).not.toBe(syncOperationFingerprint(creation))
  })

  test("rejects invalid or extra input before hashing", () => {
    for (const input of [
      null,
      { ...deletion, protocolVersion: 2 },
      { ...deletion, baseRevision: -1 },
      { ...deletion, actorUserId: "untrusted" },
      { ...deletion, operationId: "invalid" },
      { ...deletion, command: { ...deletion.command, ownerId: "untrusted" } },
      { ...creation, baseRevision: 1 },
    ])
      expect(() => syncOperationFingerprint(input)).toThrow()
  })
})
