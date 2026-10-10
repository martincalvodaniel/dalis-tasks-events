import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import { createHttpSyncTransportV3 } from "@/features/sync/http-transport-v3"
import { createHttpSyncTransportV4 } from "@/features/sync/http-transport-v4"
import { rejectRetiredSyncPushV3 } from "@/features/sync/retired-sync-push-v3"
import {
  placementSyncCapabilityPolicy,
  planSyncCapabilityPolicy,
} from "@/lib/sync/sync-capabilities"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { planSchema } from "@/schemas/plan-item"

const actor = "common-plan-transport-owner"
const item = planSchema.parse({
  kind: "plan",
  variant: "note",
  id: crypto.randomUUID(),
  ownerId: actor,
  title: "Common note",
  description: "",
  status: "not_started",
  checklist: [],
  schedule: {
    mode: "all_day",
    startDate: "2026-10-10",
    endDateExclusive: "2026-10-11",
  },
  recurrence: null,
  completedAt: null,
  revision: 1,
  deletedAt: null,
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
})
function page(): import("@/types/remote-changes-page-v2").RemoteChangesPageV2 {
  return {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "item",
        recipientUserId: actor,
        operationId: crypto.randomUUID(),
        sequence: 1,
        item,
      },
    ],
    nextAfter: 1,
    through: 1,
    hasMore: false,
  }
}
function transport(version: 3 | 4, fetchRequest: typeof fetch) {
  return (
    version === 4 ? createHttpSyncTransportV4 : createHttpSyncTransportV3
  )(actor, async () => null, fetchRequest)
}

test("common plans negotiate exclusive four before reading identity or page bodies", async () => {
  for (const [client, server] of [
    [4, 3],
    [3, 4],
  ] as const) {
    let reads = 0
    const clientTransport = transport(client, (async () => {
      const response = Response.json(
        {},
        { headers: { [syncProtocolHeader]: encodeSyncProtocolRange(server) } }
      )
      response.json = async () => {
        reads++
        throw new Error("Unexpected incompatible body read")
      }
      return response
    }) as unknown as typeof fetch)
    await expect(clientTransport.readIdentity()).rejects.toMatchObject({
      reason: "update_required",
    })
    await expect(
      clientTransport.pull({ after: 0, through: null, limit: 10 })
    ).rejects.toMatchObject({ reason: "update_required" })
    expect(reads).toBe(0)
  }
})

test("only generation four accepts non-recurring common plan pages", async () => {
  for (const version of [3, 4] as const) {
    const value = page()
    const clientTransport = transport(version, (async () =>
      Response.json(value, {
        headers: { [syncProtocolHeader]: encodeSyncProtocolRange(version) },
      })) as unknown as typeof fetch)
    const result = clientTransport.pull({ after: 0, through: null, limit: 10 })
    if (version === 4) expect(await result).toEqual(value)
    else await expect(result).rejects.toThrow("committed simple item")
  }
})

test("retired generation three authenticates but never emits an ACK", async () => {
  const request = {
    transportVersion: 2,
    expectedUserId: actor,
    operations: [
      {
        protocolVersion: 1,
        operationId: crypto.randomUUID(),
        baseRevision: 1,
        command: {
          type: "plan.set-status",
          itemId: item.id,
          status: "completed",
        },
      },
    ],
  }
  const original = structuredClone(request)
  for (const userId of [actor, "other", null]) {
    expect(
      await rejectRetiredSyncPushV3(request, new Headers(), {
        readSession: async () => (userId ? { user: { id: userId } } : null),
      })
    ).toEqual({
      transportVersion: 2,
      status:
        userId === actor
          ? "update_required"
          : userId
            ? "account_changed"
            : "unauthorized",
    })
  }
  expect(request).toEqual(original)
})

test("common progress policy is isolated from the placement generation", () => {
  const operation = {
    protocolVersion: 1,
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    command: { type: "plan.set-status", itemId: item.id, status: "completed" },
  }
  expect(planSyncCapabilityPolicy.supportsPlans).toBe(true)
  expect(
    planSyncCapabilityPolicy.readCommand(operation.command, item).supported
  ).toBe(true)
  expect(
    placementSyncCapabilityPolicy.readCommand(operation.command, item).supported
  ).toBe(false)
})
