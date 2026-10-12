import "server-only"
import { expect, test } from "bun:test"
import type { AuthenticatedRecurringPushPorts } from "@/features/sync/authenticated-recurring-push"
import { pushAuthenticatedSettingsSyncBatch } from "@/features/sync/authenticated-settings-push"
import { rejectRetiredSyncPushV5 } from "@/features/sync/retired-sync-push-v5"
import type { RemoteRecurringOperationResult } from "@/types/remote-recurring-sync"
import type { SyncOperation } from "@/types/sync"

const actor = "settings-auth-owner",
  headers = new Headers({ cookie: "opaque-owned-fixture" })
function fixture() {
  const operations: SyncOperation[] = [
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 0,
      command: {
        type: "settings.update",
        input: { timeZone: "UTC", weekStartsOn: 1, locale: "es-ES" },
      },
    },
    {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: { type: "tag.delete", tagId: crypto.randomUUID() },
    },
  ]
  const input = { transportVersion: 2, expectedUserId: actor, operations },
    calls: string[] = []
  const ports: AuthenticatedRecurringPushPorts = {
    readSession: async (requestHeaders) => {
      expect(requestHeaders).toBe(headers)
      calls.push("session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness-six")
      return { ready: true, missing: [], incompatible: [] }
    },
    execute: async (
      owner,
      operation
    ): Promise<RemoteRecurringOperationResult> => {
      expect(owner).toBe(actor)
      calls.push(operation.operationId)
      return {
        kind: "preference",
        outcome: { operationId: operation.operationId, status: "unsupported" },
      }
    },
  }
  return { input, ports, calls }
}
test("future authenticated defaults validate actor before one readonly readiness check and both executor families", async () => {
  const value = fixture(),
    before = structuredClone(value.input)
  const result = await pushAuthenticatedSettingsSyncBatch(
    value.input,
    headers,
    value.ports
  )
  expect(result.status).toBe("complete")
  expect(value.calls).toEqual([
    "session",
    "readiness-six",
    ...value.input.operations.map((value) => value.operationId),
  ])
  expect(value.input).toEqual(before)
})
test("unauthorized, changed account, unsupported envelope and malformed command never reach readiness", async () => {
  for (const variant of ["session", "account", "version", "invalid"] as const) {
    const value = fixture()
    if (variant === "session") value.ports.readSession = async () => null
    const input =
      variant === "account"
        ? { ...value.input, expectedUserId: "other-owner" }
        : variant === "version"
          ? { ...value.input, transportVersion: 999 }
          : variant === "invalid"
            ? {
                ...value.input,
                operations: [
                  {
                    ...value.input.operations[0],
                    command: {
                      type: "settings.update",
                      input: {
                        timeZone: "Invalid/Zone",
                        weekStartsOn: 1,
                        locale: "es-ES",
                      },
                    },
                  },
                ],
              }
            : value.input
    const result = await pushAuthenticatedSettingsSyncBatch(
      input,
      headers,
      value.ports
    )
    expect(result.status).toBe(
      variant === "session"
        ? "unauthorized"
        : variant === "account"
          ? "account_changed"
          : variant === "version"
            ? "update_required"
            : "invalid_batch"
    )
    expect(value.calls).not.toContain("readiness-six")
    expect(value.calls.every((value) => value === "session")).toBe(true)
  }
})
test("incomplete readiness and session failure cannot acknowledge a settings intention", async () => {
  const value = fixture()
  value.ports.readReadiness = async () => ({
    ready: false,
    missing: ["user_settings_user_uidx"],
    incompatible: [],
  })
  const result = await pushAuthenticatedSettingsSyncBatch(
    value.input,
    headers,
    value.ports
  )
  expect(result.status).toBe("retry_later")
  expect("results" in result && result.results).toEqual([])
  expect(value.calls).toEqual(["session"])
  value.ports.readSession = async () => {
    throw new Error("Owned session failure")
  }
  await expect(
    pushAuthenticatedSettingsSyncBatch(value.input, headers, value.ports)
  ).rejects.toThrow("temporarily unavailable")
})
test("generation-five retirement validates envelope and identity without invoking any executor", async () => {
  const value = fixture(),
    before = structuredClone(value.input)
  const ports = { readSession: async () => ({ user: { id: actor } }) }
  expect(await rejectRetiredSyncPushV5(value.input, headers, ports)).toEqual({
    transportVersion: 2,
    status: "update_required",
  })
  expect(
    await rejectRetiredSyncPushV5(
      { ...value.input, expectedUserId: "other-owner" },
      headers,
      ports
    )
  ).toEqual({ transportVersion: 2, status: "account_changed" })
  expect(await rejectRetiredSyncPushV5({}, headers, ports)).toEqual({
    transportVersion: 2,
    status: "invalid_batch",
  })
  expect(
    await rejectRetiredSyncPushV5(value.input, headers, {
      readSession: async () => null,
    })
  ).toEqual({ transportVersion: 2, status: "unauthorized" })
  expect(value.calls).toEqual([])
  expect(value.input).toEqual(before)
})
