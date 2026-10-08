import "server-only"

import { describe, expect, test } from "bun:test"
import { syncProtocolHeader, syncProtocolVersion } from "@/config/sync-protocol"
import {
  getSyncChangesResponseV2,
  type PullDependenciesV2,
} from "@/features/sync/pull-response-v2"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { acceptsSyncProtocolRange } from "@/lib/sync/sync-protocol"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

const actor = "mixed-pull-owner"
const now = "2026-10-09T10:00:00.000Z"
const metadata = {
  revision: 3,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}
function page(): RemoteChangesPageV2 {
  const operationId = crypto.randomUUID()
  return {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "item",
        recipientUserId: actor,
        operationId: crypto.randomUUID(),
        sequence: 1,
        item: {
          ...metadata,
          id: crypto.randomUUID(),
          ownerId: actor,
          kind: "task",
          title: "Downloaded task",
          description: "",
          scheduledDate: "2026-10-09",
          status: "not_started",
          checklist: [],
          completedAt: null,
          recurrence: null,
        },
      },
      {
        version: 2,
        kind: "preference",
        recipientUserId: actor,
        operationId,
        sequence: 2,
        effects: {
          version: 1,
          userId: actor,
          operationId,
          sequence: 2,
          effects: [
            {
              store: "tags",
              record: {
                ...metadata,
                id: crypto.randomUUID(),
                userId: actor,
                name: "Work",
                normalizedName: "work",
                color: "#123456",
                position: 0,
              },
            },
          ],
        },
      },
    ],
    nextAfter: 2,
    through: 2,
    hasMore: false,
  }
}
function fixture() {
  const calls: string[] = []
  const value = page()
  const dependencies: PullDependenciesV2 = {
    readActor: async () => {
      calls.push("actor")
      return actor
    },
    readReadiness: async () => {
      calls.push("readiness")
      return { ready: true, missing: [], incompatible: [] }
    },
    readChanges: async (userId, query) => {
      calls.push("changes")
      expect(userId).toBe(actor)
      expect(query).toEqual({ after: 0, through: 2, limit: 50 })
      return value
    },
  }
  const request = (query = `expectedUserId=${actor}&through=2`) =>
    new Request(`https://example.test/api/sync/changes?${query}`, {
      headers: { cookie: "session=opaque-test-value" },
    })
  return { calls, value, dependencies, request }
}
function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(response.headers.get("Set-Cookie")).toBeNull()
  expect(
    acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 1)
  ).toBe(false)
  expect(
    acceptsSyncProtocolRange(response.headers.get(syncProtocolHeader), 2)
  ).toBe(true)
  expect(syncProtocolVersion).toBe(1)
}

describe("preparatory private mixed download", () => {
  test("returns the complete validated mixed page with an explicit v2 announcement", async () => {
    const f = fixture()
    const original = structuredClone(f.value)
    const response = await getSyncChangesResponseV2(f.request(), f.dependencies)
    privateResponse(response, 200)
    expect(await response.json()).toEqual(original)
    expect(f.calls).toEqual(["actor", "readiness", "changes"])
    expect(f.value).toEqual(original)
  })

  test("requires a valid authenticated actor before query validation or readiness", async () => {
    for (const userId of [null, "", " ", "x".repeat(129)]) {
      const f = fixture()
      f.dependencies.readActor = async () => {
        f.calls.push("actor")
        return userId
      }
      const response = await getSyncChangesResponseV2(
        f.request("unexpected=1"),
        f.dependencies
      )
      privateResponse(response, 401)
      expect(f.calls).toEqual(["actor"])
    }
  })

  test("requires the expected account and rejects duplicate, unknown and invalid queries", async () => {
    for (const query of [
      "",
      "expectedUserId=",
      `expectedUserId=${actor}&expectedUserId=${actor}`,
      `expectedUserId=${actor}&actor=foreign`,
      `expectedUserId=${actor}&after=0&after=1`,
      ...[
        "after=-1",
        "after=1.2",
        "after=1e2",
        "after=",
        "through=null",
        "limit=101",
        "after=3&through=2",
      ].map((value) => `expectedUserId=${actor}&${value}`),
    ]) {
      const f = fixture()
      const response = await getSyncChangesResponseV2(
        f.request(query),
        f.dependencies
      )
      privateResponse(response, 400)
      expect(f.calls).toEqual(["actor"])
    }
    const f = fixture()
    const response = await getSyncChangesResponseV2(
      f.request("expectedUserId=other-owner"),
      f.dependencies
    )
    privateResponse(response, 409)
    expect(await response.json()).toMatchObject({ code: "account_changed" })
    expect(f.calls).toEqual(["actor"])
  })

  test("refuses missing or incompatible readiness without reading the journal", async () => {
    for (const readiness of [
      { ready: false, missing: [], incompatible: [] },
      { ready: true, missing: ["required-index"], incompatible: [] },
      { ready: true, missing: [], incompatible: ["wrong-index"] },
    ]) {
      const f = fixture()
      f.dependencies.readReadiness = async () => {
        f.calls.push("readiness")
        return readiness
      }
      const response = await getSyncChangesResponseV2(
        f.request(),
        f.dependencies
      )
      privateResponse(response, 503)
      expect(f.calls).toEqual(["actor", "readiness"])
      expect(await response.text()).not.toContain("index")
    }
  })

  test("hides all backend failures, distinguishing only reader cursor errors", async () => {
    for (const phase of [
      "readActor",
      "readReadiness",
      "readChanges",
    ] as const) {
      for (const error of [
        new Error("secret user@example.test database"),
        new RemoteCursorAheadError(),
      ]) {
        const f = fixture()
        f.dependencies[phase] = async () => {
          throw error
        }
        const response = await getSyncChangesResponseV2(
          f.request(),
          f.dependencies
        )
        const status =
          phase === "readChanges" && error instanceof RemoteCursorAheadError
            ? 409
            : 503
        privateResponse(response, status)
        const body = await response.text()
        expect(body).not.toContain("secret")
        expect(body).not.toContain("user@example.test")
        if (status === 409) expect(JSON.parse(body).code).toBe("cursor_ahead")
        expect(f.calls).not.toContain("changes")
      }
    }
  })

  test("rejects the whole page for foreign, future, unknown-store or checkpoint corruption", async () => {
    const corrupt = (value: RemoteChangesPageV2): unknown[] => [
      { ...value, version: 3 },
      { ...value, extra: true },
      { ...value, through: 3, hasMore: true },
      { ...value, nextAfter: 1 },
      {
        ...value,
        changes: value.changes.map((change) => ({
          ...change,
          recipientUserId: "other-owner",
        })),
      },
      {
        ...value,
        changes: [
          value.changes[0],
          {
            ...value.changes[1],
            effects: {
              ...(value.changes[1].kind === "preference"
                ? value.changes[1].effects
                : {}),
              effects: [{ store: "unknown", record: {} }],
            },
          },
        ],
      },
      {
        ...value,
        changes: [{ ...value.changes[0], version: 3 }, value.changes[1]],
      },
    ]
    for (const value of corrupt(page())) {
      const f = fixture()
      f.dependencies.readChanges = async () => value as RemoteChangesPageV2
      const response = await getSyncChangesResponseV2(
        f.request(),
        f.dependencies
      )
      privateResponse(response, 503)
      expect(await response.json()).toEqual({
        error: "Sync download is temporarily unavailable",
      })
    }
    const f = fixture()
    f.dependencies.readChanges = async () => f.value
    privateResponse(
      await getSyncChangesResponseV2(
        f.request(`expectedUserId=${actor}&through=2&limit=1`),
        f.dependencies
      ),
      503
    )
  })

  test("rejects otherwise known personal stores which the local mixed reader cannot receive", async () => {
    const f = fixture()
    const personal = f.value.changes[1]
    if (personal.kind !== "preference")
      throw new Error("Preference fixture is missing")
    personal.effects.effects = [
      {
        store: "settings",
        record: {
          ...metadata,
          userId: actor,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
        },
      },
    ]
    const response = await getSyncChangesResponseV2(f.request(), f.dependencies)
    privateResponse(response, 503)
    expect(await response.text()).not.toContain("settings")
  })

  test("retains the captured query when a reader mutates its detached argument", async () => {
    const f = fixture()
    f.dependencies.readChanges = async (_, query) => {
      query.through = 3
      return { ...f.value, through: 3, hasMore: true }
    }
    const response = await getSyncChangesResponseV2(f.request(), f.dependencies)
    privateResponse(response, 503)
    expect(f.value.through).toBe(2)
  })
})
