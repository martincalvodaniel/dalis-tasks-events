"use client"

import { todayInTimeZone } from "@/lib/calendar/civil-date"
import type {
  TaskMoveCommand,
  TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { planRemoteTaskPlacementOperation } from "@/lib/preferences/remote-task-placement-plan"
import { placementDate } from "@/schemas/ordering"

// Local optimism retains acknowledged revisions; the remote transaction advances each CAS.
export function planLocalPlanMove(
  snapshot: TaskMoveSnapshot,
  command: TaskMoveCommand,
  userId: string,
  timestamp: string
) {
  if (command.occurrenceId !== null)
    throw new Error("Common plan movement requires a simple item")
  if (command.scope === "overdue") {
    if (
      !snapshot.settings ||
      snapshot.settings.deletedAt ||
      snapshot.settings.userId !== userId
    )
      throw new Error("Account time zone is unavailable")
    if (
      command.date !==
      todayInTimeZone(snapshot.settings.timeZone, () => new Date(timestamp))
    )
      throw new Error("Overdue movement requires the current account day")
  }
  const current =
    snapshot.placements.find(
      (record) =>
        record.occurrenceId === command.itemId &&
        record.scope === command.scope &&
        record.date === placementDate(command.scope, command.date)
    ) ?? null
  const planned = planRemoteTaskPlacementOperation(
    {
      userId,
      timestamp,
      operation: {
        operationId: crypto.randomUUID(),
        protocolVersion: 1,
        baseRevision: current?.revision ?? 0,
        command,
      },
      items: snapshot.items,
      tags: snapshot.tags,
      views: snapshot.views,
      placements: snapshot.placements,
    },
    true,
    true
  )
  if (planned.status !== "changes")
    throw new Error(
      "Common plan movement is unavailable or has stale neighbors"
    )
  const placements = planned.effects.flatMap((effect) =>
    effect.store === "taskPlacements"
      ? [{ ...effect.record, revision: effect.record.revision - 1 }]
      : []
  )
  const effect = planned.effects.find((effect) => effect.store === "itemViews")
  const view =
    effect?.store === "itemViews"
      ? { ...effect.record, revision: effect.record.revision - 1 }
      : null
  return { placements, view, current }
}
