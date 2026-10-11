import "server-only"

import { expect, test } from "bun:test"
import { syncProtocolHeader } from "@/config/sync-protocol"
import {
  type AuthenticatedRecurringPullPorts,
  getAuthenticatedRecurringSyncChangesResponse,
} from "@/features/sync/authenticated-recurring-pull"
import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { acceptsExclusiveSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { planSchema } from "@/schemas/plan-item"
import type { RemoteRecurringChangesPage } from "@/types/remote-recurring-sync"

const actor = "authenticated-pull-owner"

test("recurring download validates a complete parent and appearance page without exposing malformed data", async () => {
  const timestamp = "2026-10-11T13:00:00.000Z"
  const parent = planSchema.parse({
    kind: "plan",
    variant: "appointment",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Own series",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-11",
      endDateExclusive: "2026-10-12",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-11",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const operationId = crypto.randomUUID()
  const appearance = {
    ...applyPlanOccurrenceCommand(
      parent,
      null,
      {
        type: "plan.set-occurrence-status",
        itemId: parent.id,
        occurrenceId: `${parent.id}:2026-10-11`,
        status: "completed",
      },
      actor,
      timestamp
    ),
    revision: 1,
  }
  const page: RemoteRecurringChangesPage = {
    version: 2,
    changes: [
      {
        version: 2,
        kind: "item",
        recipientUserId: actor,
        operationId: crypto.randomUUID(),
        sequence: 1,
        item: parent,
      },
      {
        version: 2,
        kind: "plan-occurrence",
        recipientUserId: actor,
        operationId,
        sequence: 2,
        occurrence: appearance,
        seriesRevision: 1,
      },
    ],
    nextAfter: 2,
    through: 2,
    hasMore: false,
  }
  const request = new Request(
    `https://example.test/sync?expectedUserId=${actor}&after=0&limit=50`
  )
  for (const invalid of [
    false,
    "actor",
    "revision",
    "duplicate",
    "query",
    "cursor",
  ] as const) {
    const f = fixture()
    f.ports.readSession = async () => ({ user: { id: actor } })
    f.ports.readChanges = async () => {
      if (invalid === "cursor") throw new RemoteCursorAheadError()
      const value = structuredClone(page)
      const change = value.changes[1]
      if (change.kind !== "plan-occurrence")
        throw new Error("Expected fixture appearance")
      if (invalid === "actor") change.recipientUserId = "foreign"
      if (invalid === "revision") change.occurrence.revision = 0
      if (invalid === "duplicate") change.sequence = 1
      if (invalid === "query") value.through = 51
      return value
    }
    const response = await getAuthenticatedRecurringSyncChangesResponse(
      request,
      f.ports
    )
    expect(response.status).toBe(
      !invalid ? 200 : invalid === "cursor" ? 409 : 503
    )
    expect(
      acceptsExclusiveSyncProtocolRange(
        response.headers.get(syncProtocolHeader),
        5
      )
    ).toBe(true)
    expect(
      acceptsExclusiveSyncProtocolRange(
        response.headers.get(syncProtocolHeader),
        4
      )
    ).toBe(false)
    if (!invalid) expect(await response.json()).toEqual(page)
    else expect(await response.text()).not.toContain("Own series")
  }
})
function fixture() {
  const calls: string[] = []
  const request = new Request(
    `https://example.test/sync?expectedUserId=${actor}&after=3&through=3&limit=2`,
    {
      headers: { cookie: "opaque-test-session", "x-request-marker": "first" },
    }
  )
  const page: RemoteRecurringChangesPage = {
    version: 2,
    changes: [],
    nextAfter: 3,
    through: 3,
    hasMore: false,
  }
  const ports: AuthenticatedRecurringPullPorts = {
    readSession: async (headers) => {
      calls.push("session")
      expect(headers).toBe(request.headers)
      expect(headers.get("cookie")).toBe("opaque-test-session")
      return { user: { id: actor } }
    },
    readReadiness: async () => {
      calls.push("readiness")
      return { ready: true, missing: [], incompatible: [] }
    },
    readChanges: async (userId, query) => {
      calls.push("journal")
      expect(userId).toBe(actor)
      expect(query).toEqual({ after: 3, through: 3, limit: 2 })
      return page
    },
  }
  return { calls, request, ports, page }
}

test("authenticated pull passes exact request headers and receives a private validated recurring page with an exclusive five announcement", async () => {
  const f = fixture()
  const response = await getAuthenticatedRecurringSyncChangesResponse(
    f.request,
    f.ports
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  expect(
    acceptsExclusiveSyncProtocolRange(
      response.headers.get(syncProtocolHeader),
      1
    )
  ).toBe(false)
  expect(
    acceptsExclusiveSyncProtocolRange(
      response.headers.get(syncProtocolHeader),
      5
    )
  ).toBe(true)
  expect(await response.json()).toEqual(f.page)
  expect(f.calls).toEqual(["session", "readiness", "journal"])
  const other = new Request(f.request.url, {
    headers: { cookie: "second-session" },
  })
  f.ports.readSession = async (headers) => {
    expect(headers).toBe(other.headers)
    expect(headers.get("cookie")).toBe("second-session")
    return null
  }
  expect(
    (await getAuthenticatedRecurringSyncChangesResponse(other, f.ports)).status
  ).toBe(401)
  expect(f.calls).toEqual(["session", "readiness", "journal"])
})

test("rejected or failed sessions never reach readiness or the journal", async () => {
  for (const mode of ["null", "error"]) {
    const f = fixture()
    f.ports.readSession = async (headers) => {
      expect(headers).toBe(f.request.headers)
      f.calls.push("session")
      if (mode === "error") throw new Error("private user@example.test session")
      return null
    }
    const response = await getAuthenticatedRecurringSyncChangesResponse(
      f.request,
      f.ports
    )
    expect(response.status).toBe(mode === "null" ? 401 : 503)
    expect(await response.text()).not.toContain("user@example.test")
    expect(f.calls).toEqual(["session"])
  }
})

test("query accounts cannot inject an actor and invalid queries never inspect indexes", async () => {
  for (const [query, status] of [
    ["expectedUserId=other", 409],
    ["", 400],
    [`expectedUserId=${actor}&actor=injected`, 400],
    [`expectedUserId=${actor}&limit=101`, 400],
    [`expectedUserId=${actor}&after=4&through=3`, 400],
  ] as const) {
    const f = fixture()
    const request = new Request(`https://example.test/sync?${query}`)
    f.ports.readSession = async (headers) => {
      expect(headers).toBe(request.headers)
      f.calls.push("session")
      return { user: { id: actor } }
    }
    const response = await getAuthenticatedRecurringSyncChangesResponse(
      request,
      f.ports
    )
    expect(response.status).toBe(status)
    expect(f.calls).toEqual(["session"])
  }
})

test("readiness precedes journal access and malformed complete pages are rejected", async () => {
  const f = fixture()
  f.ports.readReadiness = async () => {
    f.calls.push("readiness")
    return { ready: true, missing: ["private-index"], incompatible: [] }
  }
  const unavailable = await getAuthenticatedRecurringSyncChangesResponse(
    f.request,
    f.ports
  )
  expect(unavailable.status).toBe(503)
  expect(await unavailable.text()).not.toContain("private-index")
  expect(f.calls).toEqual(["session", "readiness"])
  for (const page of [
    { ...f.page, version: 3 },
    { ...f.page, through: 4, hasMore: true },
    { ...f.page, extra: true },
  ]) {
    const next = fixture()
    next.ports.readChanges = async () => {
      next.calls.push("journal")
      return page as RemoteRecurringChangesPage
    }
    const response = await getAuthenticatedRecurringSyncChangesResponse(
      next.request,
      next.ports
    )
    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(next.calls).toEqual(["session", "readiness", "journal"])
  }
})
