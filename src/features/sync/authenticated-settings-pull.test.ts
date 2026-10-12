import "server-only"
import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import type { AuthenticatedRecurringPullPorts } from "@/features/sync/authenticated-recurring-pull"
import { getAuthenticatedSettingsSyncChangesResponse } from "@/features/sync/authenticated-settings-pull"
import { getRecurringSyncChangesResponse } from "@/features/sync/pull-recurring-response"
import { getAuthenticatedSettingsSyncIdentityResponse } from "@/features/sync/settings-identity-response"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type { RemoteRecurringChangesPage } from "@/types/remote-recurring-sync"

const actor = "settings-pull-auth-owner",
  now = "2026-10-12T12:00:00.000Z"
function fixture() {
  const operationId = crypto.randomUUID(),
    calls: string[] = []
  const page: RemoteRecurringChangesPage = {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "preference",
        recipientUserId: actor,
        operationId,
        sequence: 1,
        effects: {
          version: 1,
          userId: actor,
          operationId,
          sequence: 1,
          effects: [
            {
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
            },
          ],
        },
      },
    ],
    nextAfter: 1,
    through: 1,
    hasMore: false,
  }
  const request = new Request(
    `https://fixture.invalid/api/sync/changes?after=0&limit=100&expectedUserId=${actor}`,
    { headers: { cookie: "opaque-owned-fixture" } }
  )
  const ports: AuthenticatedRecurringPullPorts = {
    readSession: async (headers) => {
      expect(headers).toBe(request.headers)
      calls.push("session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness-six")
      return { ready: true, missing: [], incompatible: [] }
    },
    readChanges: async (userId, query) => {
      calls.push("changes-six")
      expect(userId).toBe(actor)
      expect(query).toEqual({ after: 0, through: null, limit: 100 })
      return page
    },
  }
  return { page, request, ports, calls }
}
test("private settings identity returns exact authorized ID and exclusive six without account details", async () => {
  const success = await getAuthenticatedSettingsSyncIdentityResponse({
    readIdentity: async () => ({ userId: actor }),
  })
  expect(success.status).toBe(200)
  expect(await success.json()).toEqual({ userId: actor })
  expect(success.headers.get(syncProtocolHeader)).toBe(
    encodeSyncProtocolRange(6)
  )
  expect(success.headers.get("Cache-Control")).toBe("private, no-store")
  expect(
    (
      await getAuthenticatedSettingsSyncIdentityResponse({
        readIdentity: async () => null,
      })
    ).status
  ).toBe(401)
  const invalid = await getAuthenticatedSettingsSyncIdentityResponse({
    readIdentity: async () => ({
      userId: actor,
      privateEmail: "owned-placeholder",
    }),
  })
  expect(invalid.status).toBe(503)
  expect(await invalid.text()).not.toContain("owned-placeholder")
})
test("private pull validates authorized complete settings page and announces six while five remains strict", async () => {
  const value = fixture(),
    response = await getAuthenticatedSettingsSyncChangesResponse(
      value.request,
      value.ports
    )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(value.page)
  expect(response.headers.get(syncProtocolHeader)).toBe(
    encodeSyncProtocolRange(6)
  )
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(value.calls).toEqual(["session", "readiness-six", "changes-six"])
  const old = await getRecurringSyncChangesResponse(value.request, {
    readActor: async () => actor,
    readReadiness: value.ports.readReadiness,
    readChanges: value.ports.readChanges,
  })
  expect(old.status).toBe(503)
  expect(old.headers.get(syncProtocolHeader)).toBe(encodeSyncProtocolRange(5))
})
test("authentication, duplicate query and changed expected actor stop before readiness or reader", async () => {
  for (const variant of ["unauthorized", "duplicate", "account"] as const) {
    const value = fixture()
    value.ports.readSession = async () =>
      variant === "unauthorized" ? null : { user: { id: actor } }
    const request =
      variant === "duplicate"
        ? new Request(`${value.request.url}&after=0`)
        : variant === "account"
          ? new Request(value.request.url.replace(actor, "other-owner"))
          : value.request
    const response = await getAuthenticatedSettingsSyncChangesResponse(
      request,
      value.ports
    )
    expect(response.status).toBe(
      variant === "unauthorized" ? 401 : variant === "duplicate" ? 400 : 409
    )
    expect(value.calls).toEqual([])
    expect(response.headers.get(syncProtocolHeader)).toBe(
      encodeSyncProtocolRange(6)
    )
  }
})
test("missing settings readiness prevents reader and cursor ahead returns a sanitized recovery signal", async () => {
  const value = fixture()
  value.ports.readReadiness = async () => ({
    ready: false,
    missing: ["user_settings_user_uidx"],
    incompatible: [],
  })
  expect(
    (
      await getAuthenticatedSettingsSyncChangesResponse(
        value.request,
        value.ports
      )
    ).status
  ).toBe(503)
  expect(value.calls).toEqual(["session"])
  value.ports.readReadiness = async () => ({
    ready: true,
    missing: [],
    incompatible: [],
  })
  value.ports.readChanges = async () => {
    throw new RemoteCursorAheadError()
  }
  const response = await getAuthenticatedSettingsSyncChangesResponse(
    value.request,
    value.ports
  )
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({ code: "cursor_ahead" })
})
test("foreign record, malformed page and session error return no partial journal or private error text", async () => {
  for (const variant of ["foreign", "sequence", "session"] as const) {
    const value = fixture()
    if (variant === "foreign") {
      const change = value.page.changes[0]
      if (change.kind !== "preference")
        throw new Error("Missing preference fixture")
      change.effects.effects[0].record.userId = "other-owner"
    } else if (variant === "sequence") value.page.nextAfter = 4
    else
      value.ports.readSession = async () => {
        throw new Error("owned-sensitive-error-placeholder")
      }
    const response = await getAuthenticatedSettingsSyncChangesResponse(
      value.request,
      value.ports
    )
    expect(response.status).toBe(503)
    const body = await response.text()
    expect(body).not.toContain("changes")
    expect(body).not.toContain("owned-sensitive-error-placeholder")
  }
})
