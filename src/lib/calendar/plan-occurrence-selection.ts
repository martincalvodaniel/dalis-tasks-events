import { z } from "zod"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { OccurrenceScheduleIssue } from "@/lib/calendar/occurrences"
import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { planSchema } from "@/schemas/plan-item"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  generatedPlanQuerySchema,
  type planExceptionCursorSchema,
  planExceptionQuerySchema,
} from "@/schemas/plan-occurrence-query"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import type { Plan, PlanVariant } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

const plansSchema = z.array(planSchema).max(10000)
const exceptionsSchema = z.array(planOccurrenceSchema).max(10000)

export interface PlanOccurrenceView {
  seriesId: string
  variant: PlanVariant
  title: string
  description: string
  occurrence: PlanOccurrence
}
export interface GeneratedPlanPage {
  views: PlanOccurrenceView[]
  issues: OccurrenceScheduleIssue[]
  nextAfter: string | null
}
export interface PlanExceptionPage {
  views: PlanOccurrenceView[]
  nextCursor: z.infer<typeof planExceptionCursorSchema> | null
}

function compareIdentity(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}
function occurrenceStart(occurrence: PlanOccurrence): string {
  return occurrence.schedule.mode === "all_day"
    ? occurrence.schedule.startDate
    : occurrence.schedule.localStart
}
function occurrenceDueDate(occurrence: PlanOccurrence): string {
  return occurrence.schedule.mode === "all_day"
    ? addCivilDays(occurrence.schedule.endDateExclusive, -1)
    : (occurrence.schedule.localEnd ?? occurrence.schedule.localStart).slice(
        0,
        10
      )
}
function compareOccurrences(
  left: PlanOccurrence,
  right: PlanOccurrence
): number {
  return (
    compareIdentity(occurrenceStart(left), occurrenceStart(right)) ||
    compareIdentity(left.id, right.id)
  )
}
function view(parent: Plan, input: PlanOccurrence): PlanOccurrenceView {
  const occurrence = planOccurrenceSchema.parse(input)
  return {
    seriesId: parent.id,
    variant: parent.variant,
    title: occurrence.content?.title ?? parent.title,
    description: occurrence.content?.description ?? parent.description,
    occurrence,
  }
}

// Parse complete catalogs into private snapshots; callers cannot mutate the prepared index.
export function createPlanOccurrenceIndex(
  plansInput: readonly Plan[],
  exceptionsInput: readonly PlanOccurrence[],
  userId: string
) {
  const actor = userIdSchema.parse(userId)
  const parents = new Map<string, Plan>()
  for (const parent of plansSchema.parse(plansInput)) {
    if (!parent.recurrence || parent.deletedAt || parent.ownerId !== actor)
      continue
    if (parents.has(parent.id))
      throw new Error("Duplicate plan series identity")
    parents.set(parent.id, parent)
  }
  const exceptions = new Map<string, PlanOccurrence>()
  for (const occurrence of exceptionsSchema.parse(exceptionsInput)) {
    if (!parents.has(occurrence.seriesId)) continue
    if (exceptions.has(occurrence.id))
      throw new Error("Duplicate plan occurrence identity")
    exceptions.set(occurrence.id, occurrence)
  }
  const visible = [...exceptions.values()]
    .filter((occurrence) => !occurrence.cancelled && !occurrence.deletedAt)
    .toSorted(compareOccurrences)
  return {
    seriesIds: Object.freeze([...parents.keys()].toSorted(compareIdentity)),
    generatedPage(
      seriesId: string,
      input: z.input<typeof generatedPlanQuerySchema>
    ): GeneratedPlanPage {
      const { includeCompleted, ...query } =
        generatedPlanQuerySchema.parse(input)
      const parent = parents.get(entityIdSchema.parse(seriesId))
      if (!parent) return { views: [], issues: [], nextAfter: null }
      const page = planOccurrencesPage(parent, query)
      return {
        views: page.occurrences
          .filter(
            (occurrence) =>
              !exceptions.has(occurrence.id) &&
              (includeCompleted || occurrence.status !== "completed")
          )
          .map((occurrence) => view(parent, occurrence)),
        issues: page.issues.filter((issue) => !exceptions.has(issue.id)),
        nextAfter: page.nextAfter,
      }
    },
    exceptionsPage(
      input: z.input<typeof planExceptionQuerySchema>
    ): PlanExceptionPage {
      const query = planExceptionQuerySchema.parse(input)
      const matches = visible.filter((occurrence) => {
        const start = occurrenceStart(occurrence)
        return (
          (query.includeCompleted || occurrence.status !== "completed") &&
          start.slice(0, 10) <= query.endDate &&
          occurrenceDueDate(occurrence) >= query.startDate &&
          (!query.after ||
            compareIdentity(start, query.after.start) > 0 ||
            (start === query.after.start &&
              compareIdentity(occurrence.id, query.after.id) > 0))
        )
      })
      const selected = matches.slice(0, query.limit)
      const last = selected.at(-1)
      return {
        views: selected.map((occurrence) => {
          const parent = parents.get(occurrence.seriesId)
          if (!parent) throw new Error("Prepared plan series is unavailable")
          return view(parent, occurrence)
        }),
        nextCursor:
          matches.length > query.limit && last
            ? { start: occurrenceStart(last), id: last.id }
            : null,
      }
    },
  }
}
