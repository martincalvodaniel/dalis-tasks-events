import { expect, test } from "bun:test"
import { planRemotePlanOccurrenceOperation } from "@/lib/calendar/remote-plan-occurrence-plan"
import { capturePlanOccurrenceCohortComparison } from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import {
  planOccurrenceCohortResolution,
  planOccurrenceCohortRetryOperationCount,
  validatePlanOccurrenceCohortResolutionRecord,
} from "@/lib/sync/plan-occurrence-cohort-resolution"
import { remotePlanOccurrenceShadowSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { PlanOccurrenceCohortResolutionRequest } from "@/types/plan-occurrence-cohort-resolution"

function fixture(
  choice: PlanOccurrenceCohortResolutionRequest["choice"] = "retry_local"
) {
  const source = planOccurrenceCohortFixture(),
    expected = capturePlanOccurrenceCohortComparison(source)
  return {
    userId: source.userId,
    resolutionId: crypto.randomUUID(),
    choice,
    operationIds:
      choice === "adopt_remote"
        ? []
        : Array.from(
            { length: planOccurrenceCohortRetryOperationCount(expected) },
            () => crypto.randomUUID()
          ),
    createdAt: "2026-10-19T17:00:00.000Z",
    expected,
  }
}

test("joint adoption preserves each remote snapshot and original history without replacements or ACK", () => {
  const request = fixture("adopt_remote"),
    before = JSON.stringify(request)
  const result = planOccurrenceCohortResolution(request, request.expected)
  expect(result.locals.map((slot) => slot.record)).toEqual(
    request.expected.slots.map((slot) => slot.remote)
  )
  expect(result.replacements).toEqual([])
  expect(result.supersededOperationIds).toEqual(request.expected.operationIds)
  expect(result.expected.source.entries.map((entry) => entry.state)).toEqual([
    "conflict",
    "pending",
    "pending",
  ])
  expect(JSON.stringify(request)).toBe(before)
  expect(
    validatePlanOccurrenceCohortResolutionRecord(
      JSON.parse(JSON.stringify(result)),
      request.userId
    )
  ).toEqual(result)
})
test("retry serializes complete slot chains with independent CAS rather than global offsets", () => {
  const request = fixture(),
    before = JSON.stringify(request.expected)
  const result = planOccurrenceCohortResolution(request, request.expected)
  expect(
    result.replacements.map(
      (entry) => entry.operation.command.expectedOccurrenceRevision
    )
  ).toEqual([9, 10, 2, 3])
  expect(result.replacements.map((entry) => entry.dependencies)).toEqual(
    request.operationIds.map((_, index) =>
      index ? [request.operationIds[index - 1]] : []
    )
  )
  expect(
    result.replacements.every((entry) => entry.operation.baseRevision === 3)
  ).toBe(true)
  expect(result.locals.map((entry) => entry.record.status)).toEqual([
    "completed",
    "in_progress",
  ])
  expect(result.locals.map((entry) => entry.record.revision)).toEqual([9, 2])
  expect(JSON.stringify(request.expected)).toBe(before)
  expect(
    validatePlanOccurrenceCohortResolutionRecord(result, request.userId)
  ).toEqual(result)
})
test("the existing remote planner accepts every replacement and reaches each exact chosen exception", () => {
  const request = fixture(),
    result = planOccurrenceCohortResolution(request, request.expected)
  const remote = new Map(
    request.expected.slots.map((slot) => [slot.occurrenceId, slot.remote])
  )
  for (const replacement of result.replacements) {
    const id = replacement.operation.command.occurrenceId
    const planned = planRemotePlanOccurrenceOperation({
      userId: request.userId,
      timestamp: request.createdAt,
      operation: replacement.operation,
      series: request.expected.source.series,
      current: remote.get(id),
    })
    expect(planned.status).toBe("changes")
    if (planned.status !== "changes")
      throw new Error("Expected a valid remote replacement")
    remote.set(id, planned.record)
  }
  for (const local of result.locals) {
    const record = remote.get(local.occurrenceId)
    expect(record).toEqual({
      ...local.record,
      revision:
        local.record.revision +
        result.replacements.filter(
          (entry) => entry.operation.command.occurrenceId === local.occurrenceId
        ).length,
    })
  }
})
test("stale comparisons, foreign actors and reused or truncated replacement identities fail before effects", () => {
  const request = fixture(),
    source = request.expected.source
  expect(() =>
    planOccurrenceCohortResolution(
      { ...request, userId: "foreign" },
      request.expected
    )
  ).toThrow()
  const current = capturePlanOccurrenceCohortComparison({
    ...source,
    occurrences: source.occurrences.map((record, index) =>
      index
        ? { ...record, content: { title: "Changed draft", description: "" } }
        : record
    ),
  })
  expect(() => planOccurrenceCohortResolution(request, current)).toThrow(
    "changed"
  )
  expect(() =>
    planOccurrenceCohortResolution(
      { ...request, resolutionId: source.entries[0].operation.operationId },
      request.expected
    )
  ).toThrow("identities")
  expect(() =>
    planOccurrenceCohortResolution(
      {
        ...request,
        operationIds: request.operationIds.map(() => request.operationIds[0]),
      },
      request.expected
    )
  ).toThrow("identities")
  expect(() =>
    planOccurrenceCohortResolution(
      { ...request, operationIds: request.operationIds.slice(1) },
      request.expected
    )
  ).toThrow("chains")
  expect(() =>
    planOccurrenceCohortResolution(
      {
        ...request,
        operationIds: [request.resolutionId, ...request.operationIds.slice(1)],
      },
      request.expected
    )
  ).toThrow("identities")
})
test("missing drafts and cancelled or deleted remotes remain joint-adoption only", () => {
  for (const reason of ["missing", "cancelled", "deleted"] as const) {
    const request = fixture("adopt_remote"),
      source = request.expected.source
    const expected = capturePlanOccurrenceCohortComparison({
      ...source,
      occurrences:
        reason === "missing" ? [source.occurrences[0]] : source.occurrences,
      shadows: source.shadows.map((raw) => {
        const value = remotePlanOccurrenceShadowSchema.parse(raw)
        if (value.record.id !== request.expected.slots[1].occurrenceId)
          return raw
        return {
          ...value,
          record: {
            ...value.record,
            cancelled: reason === "cancelled",
            deletedAt: reason === "deleted" ? request.createdAt : null,
          },
        }
      }),
    })
    expect(
      planOccurrenceCohortResolution({ ...request, expected }, expected)
        .replacements
    ).toEqual([])
    expect(() => planOccurrenceCohortRetryOperationCount(expected)).toThrow()
  }
})
test("revision overflow is checked independently per slot while adoption remains safe", () => {
  const request = fixture("adopt_remote"),
    source = request.expected.source
  const raw = remotePlanOccurrenceShadowSchema.parse(source.shadows[1])
  const expected = capturePlanOccurrenceCohortComparison({
    ...source,
    shadows: [
      source.shadows[0],
      { ...raw, record: { ...raw.record, revision: Number.MAX_SAFE_INTEGER } },
    ],
  })
  expect(
    planOccurrenceCohortResolution({ ...request, expected }, expected)
      .replacements
  ).toEqual([])
  expect(() => planOccurrenceCohortRetryOperationCount(expected)).toThrow(
    "revision"
  )
})
test("durable revalidation rejects altered dependency chains, projections and superseded identities", () => {
  const request = fixture(),
    result = planOccurrenceCohortResolution(request, request.expected)
  expect(() =>
    validatePlanOccurrenceCohortResolutionRecord(result, "foreign")
  ).toThrow("account")
  expect(() =>
    validatePlanOccurrenceCohortResolutionRecord(
      {
        ...result,
        replacements: result.replacements.map((entry, index) =>
          index === 2 ? { ...entry, dependencies: [] } : entry
        ),
      },
      request.userId
    )
  ).toThrow("evidence")
  expect(() =>
    validatePlanOccurrenceCohortResolutionRecord(
      { ...result, locals: result.locals.toReversed() },
      request.userId
    )
  ).toThrow("evidence")
  expect(() =>
    validatePlanOccurrenceCohortResolutionRecord(
      {
        ...result,
        supersededOperationIds: result.supersededOperationIds.slice(1),
      },
      request.userId
    )
  ).toThrow("evidence")
})

test("retry reserves post-write queue capacity without deleting unrelated acknowledged history", () => {
  const request = fixture("adopt_remote"),
    source = request.expected.source
  const history = Array.from({ length: 9997 }, (_, index) => {
    const tagId = crypto.randomUUID()
    return outboxEntrySchema.parse({
      ...source.entries[0],
      entityKey: `tag:${tagId}`,
      state: "acknowledged",
      sequence: index + 1,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: 1,
        command: { type: "tag.delete", tagId },
      },
    })
  })
  const expected = capturePlanOccurrenceCohortComparison({
    ...source,
    entries: [
      ...history,
      ...source.entries.map((entry) => ({
        ...entry,
        sequence: entry.sequence + history.length,
      })),
    ],
  })
  expect(expected.source.entries).toHaveLength(10000)
  expect(() => planOccurrenceCohortRetryOperationCount(expected)).toThrow(
    "queue limit"
  )
  const adopted = planOccurrenceCohortResolution(
    { ...request, expected },
    expected
  )
  expect(adopted.replacements).toEqual([])
  expect(adopted.expected.source.entries).toHaveLength(10000)
  expect(adopted.supersededOperationIds).toHaveLength(3)
})
