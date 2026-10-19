import { expect, test } from "bun:test"
import {
  capturePlanOccurrenceCohortComparison,
  validatePlanOccurrenceCohortComparison,
} from "@/lib/sync/plan-occurrence-cohort-comparison"
import { planOccurrenceCohortFixture } from "@/lib/sync/plan-occurrence-cohort-fixture"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import {
  planOccurrenceCohortComparisonInputSchema,
  planOccurrenceCohortComparisonSchema,
} from "@/schemas/plan-occurrence-cohort-comparison"

const fixture = planOccurrenceCohortFixture

test("comparison keeps exact independent slots, global order, cross-slot dependencies and immutable source", () => {
  const source = fixture(),
    before = JSON.stringify(source),
    snapshot = capturePlanOccurrenceCohortComparison(source)
  expect(snapshot.slots.map((slot) => slot.remote.revision)).toEqual([9, 2])
  expect(snapshot.slots[0].operationIds).toEqual([
    source.entries[0].operation.operationId,
    source.entries[2].operation.operationId,
  ])
  expect(snapshot.operationIds).toEqual(
    source.entries.map((entry) => entry.operation.operationId)
  )
  expect(snapshot.source.entries[2].dependencies).toEqual([
    source.entries[1].operation.operationId,
  ])
  expect(snapshot.slots.map((slot) => slot.local)).toEqual(source.occurrences)
  expect(
    validatePlanOccurrenceCohortComparison(
      JSON.parse(JSON.stringify(snapshot)),
      source.userId
    )
  ).toEqual(snapshot)
  expect(JSON.stringify(source)).toBe(before)
})
test("a pending untouched slot is not treated as an absent remote exception", () => {
  const source = fixture()
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      shadows: [source.shadows[0]],
    })
  ).toThrow("no known")
  const value = capturePlanOccurrenceCohortComparison({
    ...source,
    occurrences: [source.occurrences[0]],
  })
  expect(value.slots[1].local).toBeNull()
  expect(value.slots[1].remote).toEqual(source.shadows[1].record)
})
test("frozen conflicts remain available without a current shadow and later remote evidence wins without becoming an ancestor", () => {
  const source = fixture()
  expect(
    capturePlanOccurrenceCohortComparison({
      ...source,
      shadows: [source.shadows[1]],
    }).slots[0].remote.revision
  ).toBe(9)
  const next = {
    ...source.shadows[0],
    record: {
      ...source.shadows[0].record,
      revision: 12,
      content: { title: "Later remote", description: "" },
    },
  }
  const snapshot = capturePlanOccurrenceCohortComparison({
    ...source,
    shadows: [next, source.shadows[1]],
  })
  expect(snapshot.slots[0].remote.revision).toBe(12)
  expect(snapshot.source.outcomes).toEqual(source.outcomes)
})
test("same-revision contradictions and regressing shadows fail closed independently per slot", () => {
  const source = fixture()
  const contradict = {
    ...source.shadows[0],
    record: { ...source.shadows[0].record, status: "in_progress" },
  }
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      shadows: [contradict, source.shadows[1]],
    })
  ).toThrow("contradict")
  const stale = {
    ...source.shadows[0],
    record: { ...source.shadows[0].record, revision: 8 },
  }
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      shadows: [stale, source.shadows[1]],
    })
  ).toThrow("regresses")
})
test("actor, parent identity, parent revision and matching frozen intention are required", () => {
  const source = fixture(),
    snapshot = capturePlanOccurrenceCohortComparison(source)
  expect(() =>
    validatePlanOccurrenceCohortComparison(snapshot, "foreign")
  ).toThrow("account")
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      shadows: [{ ...source.shadows[0], userId: "foreign" }, source.shadows[1]],
    })
  ).toThrow()
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      series: { ...source.series, title: "Contradictory current parent" },
    })
  ).toThrow("parent")
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...source,
      series: { ...source.series, revision: 2 },
    })
  ).toThrow()
  const changed = {
    ...source.outcomes[0],
    operation: { ...source.outcomes[0].operation, baseRevision: 2 },
  }
  expect(() =>
    capturePlanOccurrenceCohortComparison({ ...source, outcomes: [changed] })
  ).toThrow("intention")
  const foreign = {
    ...source.outcomes[0],
    result: {
      ...source.outcomes[0].result,
      outcome: {
        ...source.outcomes[0].result.outcome,
        series: { ...source.series, ownerId: "foreign" },
      },
    },
  }
  expect(() =>
    capturePlanOccurrenceCohortComparison({ ...source, outcomes: [foreign] })
  ).toThrow()
})
test("duplicates, missing conflicts and forged portable projections are rejected", () => {
  const source = fixture()
  for (const input of [
    { ...source, outcomes: [] },
    { ...source, outcomes: [...source.outcomes, source.outcomes[0]] },
    { ...source, occurrences: [...source.occurrences, source.occurrences[0]] },
    { ...source, shadows: [...source.shadows, source.shadows[0]] },
  ])
    expect(() => capturePlanOccurrenceCohortComparison(input)).toThrow()
  const snapshot = capturePlanOccurrenceCohortComparison(source)
  expect(() =>
    validatePlanOccurrenceCohortComparison(
      { ...snapshot, slots: snapshot.slots.toReversed() },
      source.userId
    )
  ).toThrow("source")
  expect(() =>
    validatePlanOccurrenceCohortComparison(
      { ...snapshot, prerequisiteOperationIds: [crypto.randomUUID()] },
      source.userId
    )
  ).toThrow("source")
})
test("known cancelled and tombstoned remote slots stay exact rather than being revived", () => {
  const source = fixture(),
    remote = {
      ...source.shadows[1].record,
      cancelled: true,
      deletedAt: source.series.updatedAt,
    }
  const snapshot = capturePlanOccurrenceCohortComparison({
    ...source,
    shadows: [source.shadows[0], { ...source.shadows[1], record: remote }],
  })
  expect(snapshot.slots[1].remote).toEqual(remote)
})
test("transitive ACK DTOs require exact applied outcomes before a comparison can be reviewed", () => {
  const source = fixture(),
    prerequisite = {
      ...source.entries[0],
      state: "acknowledged",
      sequence: 1,
      operation: {
        ...source.entries[0].operation,
        operationId: crypto.randomUUID(),
        command: {
          ...source.entries[0].operation.command,
          expectedOccurrenceRevision: 8,
        },
      },
    }
  const entries = [
    prerequisite,
    ...source.entries.map((entry, index) => ({
      ...entry,
      sequence: entry.sequence + 1,
      dependencies:
        index === 0 ? [prerequisite.operation.operationId] : entry.dependencies,
    })),
  ]
  expect(() =>
    capturePlanOccurrenceCohortComparison({ ...source, entries })
  ).toThrow("prerequisite")
  const applied = {
    ...source.outcomes[0],
    key: `operation-outcome:${prerequisite.operation.operationId}`,
    operation: prerequisite.operation,
    result: {
      kind: "plan-occurrence",
      userId: source.userId,
      outcome: {
        status: "applied",
        operationId: prerequisite.operation.operationId,
        seriesRevision: 3,
        sequence: 1,
        occurrence: { ...source.shadows[0].record, status: "in_progress" },
      },
    },
  }
  const conflict = {
    ...source.outcomes[0],
    result: {
      ...source.outcomes[0].result,
      outcome: {
        ...source.outcomes[0].result.outcome,
        current: { ...source.shadows[0].record, status: "in_progress" },
      },
    },
  }
  const snapshot = capturePlanOccurrenceCohortComparison({
    ...source,
    entries,
    outcomes: [applied, conflict],
    shadows: [
      {
        ...source.shadows[0],
        record: { ...source.shadows[0].record, status: "in_progress" },
      },
      source.shadows[1],
    ],
  })
  expect(snapshot.prerequisiteOperationIds).toEqual([
    prerequisite.operation.operationId,
  ])
  expect(snapshot.source.entries[0].state).toBe("acknowledged")
  expect(snapshot.source.entries[1].state).toBe("conflict")
})
test("strict complete-catalog and byte ceilings apply to both input and derived comparison", () => {
  const source = fixture()
  expect(
    planOccurrenceCohortComparisonInputSchema.safeParse({
      ...source,
      extra: true,
    }).success
  ).toBe(false)
  expect(
    planOccurrenceCohortComparisonInputSchema.safeParse({
      ...source,
      outcomes: Array(10001).fill(source.outcomes[0]),
    }).success
  ).toBe(false)
  const oversized = {
    ...source,
    outcomes: [{ padding: "x".repeat(maximumLocalOperationOutcomeBytes) }],
  }
  expect(
    planOccurrenceCohortComparisonInputSchema.safeParse(oversized).success
  ).toBe(false)
  const snapshot = capturePlanOccurrenceCohortComparison(source)
  expect(
    planOccurrenceCohortComparisonSchema.safeParse({
      ...snapshot,
      slots: Array(10001).fill(snapshot.slots[0]),
    }).success
  ).toBe(false)
})

test("every transitive prerequisite retains a distinct applied outcome across slots", () => {
  const source = fixture()
  const first = {
    ...source.entries[0],
    state: "acknowledged",
    sequence: 1,
    operation: {
      ...source.entries[0].operation,
      operationId: crypto.randomUUID(),
      command: {
        ...source.entries[0].operation.command,
        expectedOccurrenceRevision: 8,
      },
    },
  }
  const second = {
    ...first,
    sequence: 2,
    dependencies: [first.operation.operationId],
    operation: {
      ...first.operation,
      operationId: crypto.randomUUID(),
      command: {
        ...source.entries[1].operation.command,
        expectedOccurrenceRevision: 1,
      },
    },
  }
  const entries = [
    first,
    second,
    ...source.entries.map((entry, index) => ({
      ...entry,
      sequence: entry.sequence + 2,
      dependencies:
        index === 0 ? [second.operation.operationId] : entry.dependencies,
    })),
  ]
  const records = source.shadows.map((shadow) => ({
    ...shadow.record,
    status: "in_progress" as const,
  }))
  const applied = [first, second].map((entry, index) => ({
    ...source.outcomes[0],
    local: source.occurrences[index],
    key: `operation-outcome:${entry.operation.operationId}`,
    operation: entry.operation,
    result: {
      kind: "plan-occurrence",
      userId: source.userId,
      outcome: {
        status: "applied",
        operationId: entry.operation.operationId,
        seriesRevision: 3,
        sequence: index + 1,
        occurrence: records[index],
      },
    },
  }))
  const conflict = {
    ...source.outcomes[0],
    result: {
      ...source.outcomes[0].result,
      outcome: { ...source.outcomes[0].result.outcome, current: records[0] },
    },
  }
  const input = {
    ...source,
    entries,
    shadows: source.shadows.map((shadow, index) => ({
      ...shadow,
      record: records[index],
    })),
    outcomes: [...applied, conflict],
  }
  const snapshot = capturePlanOccurrenceCohortComparison(input)
  expect(snapshot.prerequisiteOperationIds).toEqual([
    first.operation.operationId,
    second.operation.operationId,
  ])
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...input,
      outcomes: [applied[1], conflict],
    })
  ).toThrow("prerequisite")
  expect(() =>
    capturePlanOccurrenceCohortComparison({
      ...input,
      outcomes: [applied[0], conflict],
    })
  ).toThrow("prerequisite")
  expect(snapshot.source.entries[2].dependencies).toEqual([
    second.operation.operationId,
  ])
})
