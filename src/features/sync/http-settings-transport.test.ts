import { expect, test } from "bun:test"
import {
  settingsSyncProtocolVersion,
  syncProtocolHeader,
} from "@/config/sync-protocol"
import {
  createHttpRecurringSyncTransport,
  createHttpSettingsSyncTransport,
} from "@/features/sync/http-recurring-transport"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type {
  PreferenceEffect,
  RemotePreferenceEffects,
} from "@/types/preference-effects"
import type { RemotePushInputV2 } from "@/types/remote-push-v2"
import type { RemoteRecurringPushResult } from "@/types/remote-recurring-push"
import type { RemoteRecurringChangesPage } from "@/types/remote-recurring-sync"

const actor = "settings-http-owner",
  now = "2026-10-12T12:00:00.000Z"
function fixture(): {
  request: RemotePushInputV2
  response: RemoteRecurringPushResult
  page: RemoteRecurringChangesPage
} {
  const request: RemotePushInputV2 = {
    transportVersion: 2,
    expectedUserId: actor,
    operations: [
      {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 0,
        command: {
          type: "settings.update",
          input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
        },
      },
    ],
  }
  const operationId = request.operations[0].operationId
  const effect: PreferenceEffect = {
    store: "settings",
    record: {
      userId: actor,
      timeZone: "UTC",
      weekStartsOn: 1,
      locale: "es-ES",
      revision: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
  const effects: RemotePreferenceEffects = {
    version: 1,
    userId: actor,
    operationId,
    sequence: 1,
    effects: [effect],
  }
  return {
    request,
    response: {
      transportVersion: 2,
      status: "complete",
      results: [
        {
          kind: "preference",
          outcome: { operationId, status: "applied", effects },
        },
      ],
    },
    page: {
      version: 2,
      changes: [
        {
          version: 2,
          kind: "preference",
          recipientUserId: actor,
          operationId,
          sequence: 1,
          effects,
        },
      ],
      nextAfter: 1,
      through: 1,
      hasMore: false,
    },
  }
}
const query = { after: 0, through: null, limit: 100 }
function response(body: unknown, version = 6) {
  return new Response(JSON.stringify(body), {
    headers: { [syncProtocolHeader]: encodeSyncProtocolRange(version) },
  })
}
test("generation six rejects old, spanning and absent headers before identity or pull bodies", async () => {
  for (const header of [
    encodeSyncProtocolRange(5),
    JSON.stringify({ minimum: 5, maximum: 6 }),
    null,
  ]) {
    let bodies = 0,
      sends = 0
    const fetchRequest = (async () => {
      const reply = new Response("{}", {
        headers: header ? { [syncProtocolHeader]: header } : {},
      })
      reply.json = async () => {
        bodies++
        throw new Error("Unexpected incompatible body")
      }
      return reply
    }) as unknown as typeof fetch
    const client = createHttpSettingsSyncTransport(
      actor,
      async () => {
        sends++
      },
      fetchRequest
    )
    await expect(client.readIdentity()).rejects.toMatchObject({
      reason: "update_required",
    })
    await expect(client.pull(query)).rejects.toMatchObject({
      reason: "update_required",
    })
    expect(bodies).toBe(0)
    expect(sends).toBe(0)
  }
})
test("generation five rejects settings generation before reading the response body", async () => {
  let bodies = 0
  const fetchRequest = (async () => {
    const reply = response({})
    reply.json = async () => {
      bodies++
      throw new Error("Unexpected settings body")
    }
    return reply
  }) as unknown as typeof fetch
  const client = createHttpRecurringSyncTransport(
    actor,
    async () => {},
    fetchRequest
  )
  await expect(client.readIdentity()).rejects.toMatchObject({
    reason: "update_required",
  })
  await expect(client.pull(query)).rejects.toMatchObject({
    reason: "update_required",
  })
  expect(bodies).toBe(0)
})
test("compatible settings transport validates full page and preserves Preview cookies and frozen checkpoint", async () => {
  const value = fixture(),
    requests: { path: string; options?: RequestInit }[] = []
  const fetchRequest = (async (
    path: Parameters<typeof fetch>[0],
    options?: RequestInit
  ) => {
    requests.push({ path: String(path), options })
    return response(
      String(path).includes("identity") ? { userId: actor } : value.page
    )
  }) as unknown as typeof fetch
  const client = createHttpSettingsSyncTransport(
    actor,
    async () => value.response,
    fetchRequest
  )
  expect(settingsSyncProtocolVersion).toBe(6)
  expect(await client.readIdentity()).toBe(actor)
  expect(await client.pull(query)).toEqual(value.page)
  expect(
    requests.every(
      (value) =>
        value.options?.credentials === "same-origin" &&
        value.options.cache === "no-store" &&
        value.options.signal
    )
  ).toBe(true)
  expect(requests[1].path).toContain(`expectedUserId=${actor}`)
})
test("push keeps envelope two and intention one and rejects a changed account before sending", async () => {
  const value = fixture(),
    sent: unknown[] = []
  const client = createHttpSettingsSyncTransport(actor, async (input) => {
    sent.push(input)
    return value.response
  })
  expect(await client.push(value.request)).toEqual(value.response)
  expect(sent).toEqual([value.request])
  await expect(
    client.push({ ...value.request, expectedUserId: "other-owner" })
  ).rejects.toMatchObject({ reason: "account_changed" })
  expect(sent).toHaveLength(1)
})
test("compatible header does not permit foreign settings and deadline leaves input unchanged", async () => {
  const value = fixture(),
    before = JSON.stringify(value.request)
  const foreign = structuredClone(value.page)
  const change = foreign.changes[0]
  if (change.kind !== "preference")
    throw new Error("Expected settings journal fixture")
  change.effects.effects[0].record.userId = "other-owner"
  const client = createHttpSettingsSyncTransport(
    actor,
    async () => {},
    (async () => response(foreign)) as unknown as typeof fetch
  )
  await expect(client.pull(query)).rejects.toThrow()
  const pending = createHttpSettingsSyncTransport(
    actor,
    () => new Promise(() => {}),
    fetch,
    1
  )
  await expect(pending.push(value.request)).rejects.toMatchObject({
    reason: "retry_later",
  })
  expect(JSON.stringify(value.request)).toBe(before)
})
