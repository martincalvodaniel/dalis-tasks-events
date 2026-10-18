import { expect, test } from "bun:test"
import { planRemoteTagOperation } from "@/lib/preferences/remote-tag-plan"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import {
  availableTagResolutionChoices,
  planTagIncidentResolution,
  validateTagResolutionRecord,
} from "@/lib/sync/tag-resolution"
import { localPreferenceOutcomeV2Schema } from "@/schemas/local-preference-outcome-v2"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { tagSchema } from "@/schemas/preferences"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

function fixture() {
  const actor = "category-resolution-owner",
    id = crypto.randomUUID(),
    now = "2026-10-18T05:40:00.000Z"
  const tag = tagSchema.parse({
    id,
    userId: actor,
    name: "Local",
    normalizedName: "local",
    color: "#123456",
    position: 80,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  const remote = {
    ...tag,
    name: "Remote",
    normalizedName: "remote",
    color: "#654321",
    position: 20,
    revision: 2,
  }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `tag:${id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 1,
      command: {
        type: "tag.save",
        tagId: id,
        input: { name: tag.name, color: tag.color, position: tag.position },
      },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: now,
  })
  const child = outboxEntrySchema.parse({
    ...entry,
    operation: { ...entry.operation, operationId: crypto.randomUUID() },
    state: "pending",
    attempts: 0,
    sequence: 2,
    dependencies: [entry.operation.operationId],
  })
  const outcome = localPreferenceOutcomeV2Schema.parse({
    version: 2,
    kind: "preference",
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "preference",
      outcome: {
        status: "conflict",
        operationId: entry.operation.operationId,
        current: { store: "tags", record: remote },
      },
    },
    local: [
      { entityKey: entry.entityKey, record: { store: "tags", record: tag } },
    ],
    base: [{ entityKey: entry.entityKey, record: null }],
  })
  const input = {
    userId: actor,
    items: [],
    occurrences: [],
    tags: [tag],
    itemViews: [],
    taskPlacements: [],
    settings: [],
    entries: [entry, child],
    outcomes: [outcome],
    shadows: [],
  }
  const projected = projectRecurringSettingsSyncIncidentOverview(input)[0]
  if (projected.kind !== "preference")
    throw new Error("Category fixture is missing")
  const current: PersonalSyncIncidentSnapshot = JSON.parse(
    JSON.stringify(projected.incident)
  )
  const request = {
    userId: actor,
    resolutionId: crypto.randomUUID(),
    operationId: crypto.randomUUID(),
    choice: "retry_local" as const,
    createdAt: now,
    expected: current,
  }
  return { actor, tag, remote, entry, child, outcome, input, current, request }
}

test("category adoption retains remote data without ACK and retry uses local name/color with remote order and fresh CAS", () => {
  const { current, request, remote, tag } = fixture(),
    before = JSON.stringify(current)
  expect(availableTagResolutionChoices(current)).toEqual([
    "adopt_remote",
    "retry_local",
  ])
  const adopt = planTagIncidentResolution(
    { ...request, choice: "adopt_remote", operationId: null },
    current
  )
  expect(adopt.local).toEqual(remote)
  expect(adopt.replacement).toBeNull()
  const retry = planTagIncidentResolution(request, current)
  expect(retry.replacement).toEqual({
    operationId: request.operationId,
    protocolVersion: 1,
    baseRevision: 2,
    command: {
      type: "tag.save",
      tagId: tag.id,
      input: { name: tag.name, color: tag.color, position: remote.position },
    },
  })
  expect(retry.local).toMatchObject({
    name: tag.name,
    color: tag.color,
    position: remote.position,
    revision: remote.revision,
  })
  expect(retry.supersededOperationIds).toEqual(
    current.intentions.map((entry) => entry.operation.operationId)
  )
  expect(validateTagResolutionRecord(retry, request.userId)).toEqual(retry)
  expect(JSON.stringify(current)).toBe(before)
  const planned = planRemoteTagOperation({
    userId: request.userId,
    timestamp: request.createdAt,
    operation: retry.replacement,
    tags: [remote],
  })
  expect(planned).toMatchObject({
    status: "changes",
    effects: [
      {
        store: "tags",
        record: {
          name: tag.name,
          color: tag.color,
          position: remote.position,
          revision: 3,
        },
      },
    ],
  })
})

test("category comparison rejects foreign identities, stale evidence, unsupported or uncertain chains and absent or deleted remotes", () => {
  const changes: ((value: PersonalSyncIncidentSnapshot) => void)[] = [
    (v) => {
      v.blockedByRelatedIntentions = true
    },
    (v) => {
      v.entry.userId = "foreign"
    },
    (v) => {
      v.intentions[1].attempts = 1
    },
    (v) => {
      v.intentions[1].operation.command = {
        type: "tag.delete",
        tagId: crypto.randomUUID(),
      }
    },
    (v) => {
      v.remote[0].record = null
    },
    (v) => {
      const r = v.remote[0].record
      if (r) r.record.deletedAt = "2026-10-18T06:00:00.000Z"
    },
    (v) => {
      const r = v.remote[0].record
      if (r) r.record.revision = 1
    },
    (v) => {
      const r = v.remote[0].record
      if (r?.store === "tags") r.record.color = "#ffffff"
    },
    (v) => {
      v.intentions = []
    },
    (v) => {
      v.intentions.push(structuredClone(v.intentions[1]))
    },
  ]
  for (const change of changes) {
    const { current, request } = fixture()
    change(current)
    expect(availableTagResolutionChoices(current)).toEqual([])
    expect(() =>
      planTagIncidentResolution({ ...request, expected: current }, current)
    ).toThrow()
  }
  const { current, request } = fixture()
  expect(() =>
    planTagIncidentResolution({ ...request, userId: "foreign" }, current)
  ).toThrow()
  const changed = structuredClone(current)
  changed.tagNames[crypto.randomUUID()] = "Later category"
  expect(() => planTagIncidentResolution(request, changed)).toThrow("changed")
})

test("category retry rejects a normalized name collision and does not pretend to restore a local tombstone", () => {
  const { current, request, tag } = fixture()
  current.tagNames[crypto.randomUUID()] = "ＬＯＣＡＬ"
  expect(availableTagResolutionChoices(current)).toEqual(["adopt_remote"])
  expect(() => planTagIncidentResolution(request, current)).toThrow(
    "duplicates"
  )
  delete current.tagNames[
    Object.keys(current.tagNames).find((key) => key !== tag.id) ?? ""
  ]
  current.local[0].record = null
  expect(availableTagResolutionChoices(current)).toEqual(["adopt_remote"])
  expect(() =>
    planTagIncidentResolution({ ...request, expected: current }, current)
  ).toThrow("living local")
})

test("category decisions reject reused identities and any tampering with replanned receipt", () => {
  const { current, request } = fixture()
  for (const id of [request.resolutionId, current.entry.operation.operationId])
    expect(() =>
      planTagIncidentResolution({ ...request, operationId: id }, current)
    ).toThrow("identities")
  const record = planTagIncidentResolution(request, current)
  expect(() =>
    validateTagResolutionRecord(
      { ...record, local: { ...record.local, color: "#ffffff" } },
      request.userId
    )
  ).toThrow("contradicts")
  expect(() => validateTagResolutionRecord(record, "foreign")).toThrow(
    "another account"
  )
})

test("category projection blocks incoming and outgoing unconfirmed dependencies while preserving independent preferences", () => {
  const { input, entry, child } = fixture()
  const otherId = crypto.randomUUID()
  const independent = outboxEntrySchema.parse({
    ...child,
    entityKey: `tag:${otherId}`,
    sequence: 3,
    dependencies: [],
    operation: {
      ...child.operation,
      operationId: crypto.randomUUID(),
      command: {
        type: "tag.save",
        tagId: otherId,
        input: { name: "Other", color: "#654321", position: 40 },
      },
    },
  })
  function project(entries: typeof input.entries) {
    const result = projectRecurringSettingsSyncIncidentOverview({
      ...input,
      entries,
    })[0]
    if (result.kind !== "preference")
      throw new Error("Expected personal incident")
    return result.incident
  }
  expect(
    availableTagResolutionChoices(project([...input.entries, independent]))
  ).toEqual(["adopt_remote", "retry_local"])
  expect(
    availableTagResolutionChoices(
      project([
        ...input.entries,
        { ...independent, dependencies: [entry.operation.operationId] },
      ])
    )
  ).toEqual([])
  expect(
    availableTagResolutionChoices(
      project([
        { ...independent, sequence: 1 },
        {
          ...entry,
          sequence: 2,
          dependencies: [independent.operation.operationId],
        },
        { ...child, sequence: 3 },
      ])
    )
  ).toEqual([])
})
