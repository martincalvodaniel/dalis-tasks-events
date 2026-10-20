import { expect, test } from "bun:test"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import {
  availableCategoryPlacementResolutionChoices,
  planCategoryPlacementIncidentResolution,
  previewCategoryPlacementResolutionChoice,
  validateCategoryPlacementResolutionRecord,
} from "@/lib/sync/category-placement-decision"
import { categoryPlacementResolutionFixture } from "@/lib/sync/category-placement-resolution-fixture"
import {
  captureCategoryPlacementResolutionSnapshot,
  captureMixedPlacementResolutionSnapshot,
  capturePlacementResolutionSnapshot,
  captureRecurringPlacementResolutionSnapshot,
  validateCategoryPlacementResolutionSnapshot,
} from "@/lib/sync/placement-resolution"
import { categoryPlacementResolutionRequestSchema } from "@/schemas/category-placement-resolution"
import { taskPlacementEntityKey } from "@/schemas/ordering"

for (const primary of ["simple", "moved", "implicit"] as const)
  for (const scope of ["day", "overdue"] as const)
    for (const choice of ["adopt_remote", "retry_latest_move"] as const)
      test(`category ${primary} ${scope} ${choice} decision preserves history and independent revisions`, () => {
        const f = categoryPlacementResolutionFixture(primary, scope),
          before = JSON.stringify(f.snapshot),
          request = {
            ...f.request,
            choice,
            operationId:
              choice === "retry_latest_move" ? f.request.operationId : null,
          },
          record = planCategoryPlacementIncidentResolution(request, f.snapshot)
        expect(
          availableCategoryPlacementResolutionChoices(f.snapshot, f.actor)
        ).toEqual(["adopt_remote", "retry_latest_move"])
        expect(
          validateCategoryPlacementResolutionRecord(record, f.actor)
        ).toEqual(record)
        expect(record.supersededOperationIds).toEqual([
          f.entry.operation.operationId,
          f.child.operation.operationId,
        ])
        expect(record.expected.incident.outcome).toEqual(f.outcome)
        const view = f.snapshot.observed.views.find(
          (view) => view.itemId === f.parentId
        )
        if (!view) throw new Error("Known parent view missing")
        expect(record.view.revision).toBe(view.revision)
        if (choice === "adopt_remote") {
          expect(record.replacement).toBeNull()
          expect(record.placements).toEqual(f.snapshot.observed.placements)
          expect(record.view).toEqual(view)
        } else {
          expect(record.replacement?.command).toEqual(f.child.operation.command)
          expect(record.replacement?.operationId).not.toBe(
            f.child.operation.operationId
          )
          const primary = f.snapshot.observed.placements.find(
            (position) =>
              taskPlacementEntityKey(
                position.occurrenceId,
                position.scope,
                position.date
              ) === f.entry.entityKey
          )
          expect(record.replacement?.baseRevision).toBe(primary?.revision)
          expect(record.view.primaryTagId).toBe(f.destinationId)
          const planned = planRemoteRecurringTaskPlacementOperation({
            userId: f.actor,
            timestamp: request.createdAt,
            operation: record.replacement,
            ...f.snapshot.observed,
          })
          expect(planned.status).toBe("changes")
          if (planned.status !== "changes")
            throw new Error("Category retry oracle failed")
          for (const effect of planned.effects) {
            if (effect.store === "itemViews")
              expect(record.view).toEqual({
                ...effect.record,
                revision: view.revision,
              })
            else if (effect.store === "taskPlacements") {
              const old = f.snapshot.observed.placements.find(
                (position) =>
                  position.occurrenceId === effect.record.occurrenceId &&
                  position.scope === effect.record.scope &&
                  position.date === effect.record.date
              )
              if (!old)
                throw new Error("Category retry oracle position missing")
              expect(
                record.placements.find(
                  (position) =>
                    taskPlacementEntityKey(
                      position.occurrenceId,
                      position.scope,
                      position.date
                    ) ===
                    taskPlacementEntityKey(
                      effect.record.occurrenceId,
                      effect.record.scope,
                      effect.record.date
                    )
                )
              ).toEqual({ ...effect.record, revision: old.revision })
            } else throw new Error("Category retry changed an unrelated domain")
          }
        }
        expect(
          previewCategoryPlacementResolutionChoice(
            f.snapshot,
            f.actor,
            choice
          ).placements.map((value) => ({ ...value, updatedAt: "preview" }))
        ).toEqual(
          record.placements.map((value) => ({ ...value, updatedAt: "preview" }))
        )
        expect(JSON.stringify(f.snapshot)).toBe(before)
        for (const capture of [
          capturePlacementResolutionSnapshot,
          captureMixedPlacementResolutionSnapshot,
          captureRecurringPlacementResolutionSnapshot,
        ])
          expect(() => capture(f.capture)).toThrow()
      })
test("unknown derived peer position keeps only adoption available", () => {
  const f = categoryPlacementResolutionFixture("moved", "day", false)
  expect(
    availableCategoryPlacementResolutionChoices(f.snapshot, f.actor)
  ).toEqual(["adopt_remote"])
  expect(() =>
    planCategoryPlacementIncidentResolution(f.request, f.snapshot)
  ).toThrow()
})
test("known primary tombstone is adoptable without resurrecting a placement", () => {
  const f = categoryPlacementResolutionFixture("implicit"),
    capture = structuredClone(f.capture),
    remote = capture.observed.placements.find(
      (record) => record.occurrenceId === f.targetId
    )
  if (!remote) throw new Error("Tombstone fixture position missing")
  remote.deletedAt = f.now
  remote.revision++
  capture.incident.remote = [
    {
      entityKey: f.entry.entityKey,
      record: { store: "taskPlacements", record: remote },
    },
  ]
  const snapshot = captureCategoryPlacementResolutionSnapshot(capture)
  expect(
    availableCategoryPlacementResolutionChoices(snapshot, f.actor)
  ).toEqual(["adopt_remote"])
  const decision = planCategoryPlacementIncidentResolution(
    {
      ...f.request,
      choice: "adopt_remote",
      operationId: null,
      expected: snapshot,
    },
    snapshot
  )
  expect(
    decision.placements.find((record) => record.occurrenceId === f.targetId)
      ?.deletedAt
  ).toBe(f.now)
  expect(decision.replacement).toBeNull()
})
test("category snapshot protects exact chains, frozen outcome and current context", () => {
  const f = categoryPlacementResolutionFixture("moved")
  const mutations: ((value: typeof f.capture) => void)[] = [
    (value) => {
      value.incident.outcome.operation.operationId = crypto.randomUUID()
    },
    (value) => {
      value.incident.local = []
    },
    (value) => {
      value.incident.blockedByRelatedIntentions = true
    },
    (value) => {
      value.entries.pop()
    },
    (value) => {
      value.entries[1].attempts = 1
    },
    (value) => {
      value.entries[1].dependencies = []
    },
    (value) => {
      value.entries[0].dependencies = [crypto.randomUUID()]
    },
    (value) => {
      const cmd = value.entries[1].operation.command
      if (cmd.type === "task.move") cmd.tagId = f.sourceId
    },
    (value) => {
      value.entries.push({
        ...value.entries[1],
        entityKey: `item:${f.parentId}`,
        operation: {
          ...value.entries[1].operation,
          operationId: crypto.randomUUID(),
        },
        sequence: 3,
      })
    },
    (value) => {
      value.incident.shadowAtOutcome = []
    },
    (value) => {
      value.observed.items[0].revision++
    },
  ]
  for (const mutate of mutations) {
    const input = structuredClone(f.capture)
    mutate(input)
    expect(() => captureCategoryPlacementResolutionSnapshot(input)).toThrow()
  }
  expect(() =>
    validateCategoryPlacementResolutionSnapshot(f.snapshot, "foreign")
  ).toThrow()
  const stale = structuredClone(f.snapshot)
  stale.observed.views[0].revision++
  expect(() =>
    planCategoryPlacementIncidentResolution(f.request, stale)
  ).toThrow()
})
test("category decision schema, global identities and exact chosen evidence remain strict", () => {
  const f = categoryPlacementResolutionFixture(),
    record = planCategoryPlacementIncidentResolution(f.request, f.snapshot)
  for (const request of [
    { ...f.request, reviewKind: "mixed_group" },
    { ...f.request, operationId: null },
    { ...f.request, userId: "foreign" },
    { ...f.request, resolutionId: f.entry.operation.operationId },
    { ...f.request, operationId: f.request.resolutionId },
    { ...f.request, resolutionId: f.child.operation.operationId },
  ])
    expect(() =>
      planCategoryPlacementIncidentResolution(request, f.snapshot)
    ).toThrow()
  for (const changed of [
    { ...record, view: { ...record.view, revision: record.view.revision + 1 } },
    { ...record, reviewKind: "recurring_primary" },
    { ...record, placements: record.placements.slice(1) },
    { ...record, supersededOperationIds: [f.entry.operation.operationId] },
  ])
    expect(() =>
      validateCategoryPlacementResolutionRecord(changed, f.actor)
    ).toThrow()
  expect(() =>
    categoryPlacementResolutionRequestSchema.parse({
      ...f.request,
      confirmed: true,
    })
  ).toThrow()
})
