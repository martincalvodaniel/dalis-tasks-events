"use client"

import { z } from "zod"
import { todayInTimeZone } from "@/lib/calendar/civil-date"
import type {
  TaskMoveCommand,
  TaskMoveSnapshot,
} from "@/lib/local-db/task-move-mutation"
import { planRemoteRecurringTaskPlacementOperation } from "@/lib/preferences/remote-recurring-task-placement-plan"
import { itemOccurrenceSchema } from "@/schemas/occurrence"
import { placementDate } from "@/schemas/ordering"
import { userSettingsSchema } from "@/schemas/preferences"

// Local optimism retains confirmed revisions. Only a remote commit advances placement CAS.
export function planLocalRecurringPlanMove(
  snapshot: TaskMoveSnapshot,
  command: TaskMoveCommand,
  userId: string,
  timestamp: string
) {
  const settings = userSettingsSchema.nullable().parse(snapshot.settings)
  if (settings && settings.userId !== userId)
    throw new Error("Movement settings belong to another account")
  if (
    command.scope === "overdue" &&
    (!settings ||
      settings.deletedAt ||
      command.date !==
        todayInTimeZone(settings.timeZone, () => new Date(timestamp)))
  )
    throw new Error("Overdue movement requires the current account day")
  const occurrences = z
    .array(itemOccurrenceSchema)
    .max(10000)
    .parse(snapshot.occurrences ?? [])
  const parents = new Map(snapshot.items.map((item) => [item.id, item]))
  if (
    new Set(occurrences.map((record) => record.id)).size !== occurrences.length
  )
    throw new Error("Movement occurrences contain duplicate identities")
  for (const occurrence of occurrences) {
    const parent = parents.get(occurrence.seriesId)
    if (!parent || parent.ownerId !== userId || parent.kind !== occurrence.kind)
      throw new Error("Movement occurrence requires its owned parent")
  }
  const current =
    snapshot.placements.find(
      (record) =>
        record.occurrenceId === (command.occurrenceId ?? command.itemId) &&
        record.scope === command.scope &&
        record.date === placementDate(command.scope, command.date)
    ) ?? null
  const planned = planRemoteRecurringTaskPlacementOperation(
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
      occurrences: occurrences.filter((record) => record.kind === "plan"),
      tags: snapshot.tags,
      views: snapshot.views,
      placements: snapshot.placements,
    },
    true
  )
  if (planned.status !== "changes")
    throw new Error("Recurring movement is unavailable or has stale neighbors")
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
