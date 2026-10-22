import { expect, test } from "bun:test"
import {
  createPlanAgendaRows,
  orderPlanAgendaRows,
  type PlanAgendaRow,
} from "@/features/plans/plan-agenda-rows"
import {
  planRowMoveCommand,
  planRowOrderPeers,
} from "@/features/plans/plan-order-selection"
import { readPlanAppearancePage } from "@/lib/calendar/plan-appearance-page"
import { applyPlanCommand } from "@/lib/calendar/plan-command"
import { planLocalRecurringPlanMove } from "@/lib/local-db/recurring-plan-move"
import { planSchema } from "@/schemas/plan-item"
import { syncCommandSchema } from "@/schemas/sync"
import type { PlanVariant } from "@/types/plan-item"

const date = "2026-10-11"
const now = `${date}T09:00:00.000Z`
function row(index: number, scheduledDate = date): PlanAgendaRow {
  const plan = applyPlanCommand(
    null,
    {
      type: "item.create",
      itemId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      input: {
        kind: "plan",
        variant: "task",
        title: `Plan ${index}`,
        description: "",
        schedule: {
          mode: "timed",
          localStart: `${scheduledDate}T14:30`,
          localEnd: null,
          timeZone: "Europe/Madrid",
        },
        status: "not_started",
        checklist: [],
        recurrence: null,
      },
    },
    "owner",
    now
  )
  return { key: plan.id, plan, series: plan, occurrence: null }
}
function fixture(variant: PlanVariant = "task") {
  const first = row(1),
    second = row(2)
  const parent = planSchema.parse({
    ...row(3).plan,
    variant,
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: date,
      timeZone: "Europe/Madrid",
      end: { type: "count", count: 3 },
    },
  })
  const parents = [first.plan, second.plan, parent]
  const views = readPlanAppearancePage([parent], [], "owner", {
    startDate: date,
    endDate: "2026-10-13",
    includeCompleted: true,
  }).views
  const rows = createPlanAgendaRows(parents, views, { kind: "day", date })
  return { first, second, parent, parents, views, rows }
}

test("two simple plans and a three-day repetition can all be reordered today", () => {
  for (const variant of ["task", "event", "appointment", "note"] as const) {
    const f = fixture(variant)
    expect(f.rows).toHaveLength(3)
    for (const selected of f.rows) {
      const peers = planRowOrderPeers(f.rows, { kind: "day", date }, selected)
      expect(peers.map((peer) => peer.key)).toEqual(
        f.rows.map((peer) => peer.key)
      )
      const command = planRowMoveCommand(
        { kind: "day", date },
        selected,
        null,
        { afterId: null, beforeId: null }
      )
      expect(syncCommandSchema.parse(command)).toEqual(command)
      expect(command.itemId).toBe(selected.series.id)
      expect(command.occurrenceId).toBe(selected.occurrence?.id ?? null)
    }
  }
})

test("real recurring planner orders the occurrence and simple plans without changing other days", () => {
  const f = fixture()
  const selection = { kind: "day", date } as const
  const appearance = f.rows.find((record) => record.occurrence)
  if (!appearance) throw new Error("Missing generated appearance")
  const snapshot = {
    items: f.parents,
    occurrences: [],
    views: [],
    tags: [],
    placements: [],
    settings: null,
  }
  const before = JSON.stringify(snapshot)
  const command = planRowMoveCommand(selection, appearance, null, {
    afterId: null,
    beforeId: f.first.key,
  })
  const result = planLocalRecurringPlanMove(snapshot, command, "owner", now)
  expect(JSON.stringify(snapshot)).toBe(before)
  expect(result.placements.every((placement) => placement.date === date)).toBe(
    true
  )
  expect(
    orderPlanAgendaRows(f.rows, result.placements, selection, null).map(
      (record) => record.key
    )
  ).toEqual([appearance.key, f.first.key, f.second.key])
  const reverse = planRowMoveCommand(selection, f.second, null, {
    afterId: null,
    beforeId: appearance.key,
  })
  const reversed = planLocalRecurringPlanMove(
    { ...snapshot, placements: result.placements },
    reverse,
    "owner",
    now
  )
  expect(
    orderPlanAgendaRows(
      f.rows,
      [
        ...new Map(
          [...result.placements, ...reversed.placements].map((placement) => [
            placement.occurrenceId,
            placement,
          ])
        ).values(),
      ],
      selection,
      null
    ).map((record) => record.key)
  ).toEqual([f.second.key, appearance.key, f.first.key])
  const tomorrow = { kind: "day", date: "2026-10-12" } as const
  const nextRows = createPlanAgendaRows(f.parents, f.views, tomorrow)
  expect(
    orderPlanAgendaRows(nextRows, reversed.placements, tomorrow, null)
  ).toEqual(nextRows)
  expect(nextRows[0].occurrence?.id).toBe(`${f.parent.id}:2026-10-12T14:30`)
})

test("upcoming rows keep same-day peers using each occurrence's effective date", () => {
  const f = fixture()
  const rows = createPlanAgendaRows(f.parents, f.views, {
    kind: "upcoming",
    date,
  })
  for (const selected of rows) {
    const peers = planRowOrderPeers(rows, { kind: "upcoming", date }, selected)
    const selectedDate =
      selected.plan.schedule.mode === "timed"
        ? selected.plan.schedule.localStart.slice(0, 10)
        : selected.plan.schedule.startDate
    expect(peers.map((record) => record.key)).toEqual(
      rows
        .filter(
          (record) =>
            record.plan.schedule.mode === "timed" &&
            record.plan.schedule.localStart.startsWith(selectedDate)
        )
        .map((record) => record.key)
    )
    expect(
      planRowMoveCommand({ kind: "upcoming", date }, selected, null, {
        afterId: null,
        beforeId: null,
      }).date
    ).toBe(selectedDate)
  }
  expect(
    planRowOrderPeers(rows, { kind: "upcoming", date: "2026-10-12" }, f.first)
  ).toEqual([])
})

test("moved appearance preserves original slot while ordering on its new day", () => {
  const f = fixture()
  const original = f.views[0].occurrence
  const moved = {
    ...original,
    schedule: {
      ...original.schedule,
      mode: "timed" as const,
      localStart: "2026-10-12T18:00",
      localEnd: null,
      timeZone: "Europe/Madrid",
    },
  }
  const views = readPlanAppearancePage([f.parent], [moved], "owner", {
    startDate: "2026-10-12",
    endDate: "2026-10-12",
    includeCompleted: true,
  }).views
  const simple = row(4, "2026-10-12")
  const selection = { kind: "day", date: "2026-10-12" } as const
  const rows = createPlanAgendaRows([f.parent, simple.plan], views, selection)
  const selected = rows.find((record) => record.key === original.id)
  if (!selected) throw new Error("Moved appearance is missing")
  expect(planRowOrderPeers(rows, selection, selected)).toHaveLength(3)
  const command = planRowMoveCommand(selection, selected, null, {
    afterId: null,
    beforeId: rows[0].key,
  })
  expect(command.occurrenceId).toBe(original.id)
  expect(command.date).toBe("2026-10-12")
  const result = planLocalRecurringPlanMove(
    {
      items: [f.parent, simple.plan],
      occurrences: [moved],
      views: [],
      tags: [],
      placements: [],
      settings: null,
    },
    command,
    "owner",
    now
  )
  expect(
    orderPlanAgendaRows(rows, result.placements, selection, null)[0].key
  ).toBe(original.id)
})

test("overdue mixes dates and appearances while excluding completed or future rows", () => {
  const f = fixture()
  const selection = { kind: "overdue", date: "2026-10-13" } as const
  const rows = createPlanAgendaRows(f.parents, f.views, selection)
  const future = row(7, "2026-10-15")
  const completed = {
    ...row(8),
    plan: { ...row(8).plan, status: "completed" as const, completedAt: now },
  }
  for (const selected of rows) {
    expect(
      planRowOrderPeers([...rows, future, completed], selection, selected).map(
        (record) => record.key
      )
    ).toEqual(rows.map((record) => record.key))
    expect(
      planRowMoveCommand(selection, selected, null, {
        afterId: null,
        beforeId: null,
      })
    ).toMatchObject({ scope: "overdue", date: selection.date })
  }
})

test("a multi-day visible plan can be ordered on the selected day, not only its start day", () => {
  const f = fixture()
  const simple = row(4, "2026-10-10")
  const spanning = {
    ...simple,
    plan: {
      ...simple.plan,
      schedule: {
        ...simple.plan.schedule,
        mode: "timed" as const,
        localStart: "2026-10-10T14:30",
        localEnd: "2026-10-12T14:30",
        timeZone: "Europe/Madrid",
      },
    },
  }
  const selection = { kind: "day", date } as const
  expect(
    planRowOrderPeers([...f.rows, spanning], selection, spanning)
  ).toHaveLength(4)
  const command = planRowMoveCommand(selection, spanning, null, {
    afterId: null,
    beforeId: f.first.key,
  })
  expect(command.date).toBe(date)
  expect(
    planLocalRecurringPlanMove(
      {
        items: [...f.parents, spanning.plan],
        occurrences: [],
        views: [],
        tags: [],
        placements: [],
        settings: null,
      },
      command,
      "owner",
      now
    ).placements
  ).toHaveLength(4)
})

test("deleted and cancelled rows and raw series are protected without blocking valid neighbors", () => {
  const f = fixture()
  const occurrence = f.rows.find((record) => record.occurrence)
  if (!occurrence?.occurrence) throw new Error("Missing occurrence")
  const deleted = { ...f.first, series: { ...f.first.series, deletedAt: now } }
  const cancelled = {
    ...occurrence,
    occurrence: { ...occurrence.occurrence, cancelled: true },
  }
  const parent = {
    ...occurrence,
    key: f.parent.id,
    plan: f.parent,
    occurrence: null,
  }
  const rows = [deleted, cancelled, parent, f.first, f.second]
  for (const invalid of [deleted, cancelled, parent]) {
    expect(planRowOrderPeers(rows, { kind: "day", date }, invalid)).toEqual([])
    expect(() =>
      planRowMoveCommand({ kind: "day", date }, invalid, null, {
        afterId: null,
        beforeId: null,
      })
    ).toThrow()
  }
  expect(
    planRowOrderPeers(rows, { kind: "day", date }, f.first).map(
      (record) => record.key
    )
  ).toEqual([f.first.key, f.second.key])
})
