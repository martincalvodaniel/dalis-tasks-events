"use client"

import { useMemo, useState } from "react"
import type { z } from "zod"
import type { readLocalPlans } from "@/features/plans/local-plans"
import type { OccurrenceScheduleIssue } from "@/lib/calendar/occurrences"
import { readPlanAppearancePage } from "@/lib/calendar/plan-appearance-page"
import type { PlanOccurrenceView } from "@/lib/calendar/plan-occurrence-selection"
import type {
  PlanAppearanceCursor,
  planAppearanceQuerySchema,
} from "@/schemas/plan-appearance-query"

const maximumPages = 50

export function usePlanAppearances(
  data: Awaited<ReturnType<typeof readLocalPlans>> | undefined,
  userId: string,
  epoch: string,
  query: z.input<typeof planAppearanceQuerySchema> | null
) {
  const key = JSON.stringify([userId, epoch, query])
  const [request, setRequest] = useState({ key, pages: 1 })
  const pages = request.key === key ? request.pages : 1
  const selection = useMemo(() => {
    const views: PlanOccurrenceView[] = []
    const issues: OccurrenceScheduleIssue[] = []
    let nextCursor: PlanAppearanceCursor | null = null
    if (!data || !query) return { views, issues, nextCursor }
    for (let page = 0; page < pages; page++) {
      const result = readPlanAppearancePage(
        data.plans,
        data.occurrences,
        userId,
        query,
        nextCursor
      )
      views.push(...result.views)
      issues.push(...result.issues)
      nextCursor = result.nextCursor
      if (!nextCursor) break
    }
    return { views, issues, nextCursor }
  }, [data, userId, query, pages])
  return {
    ...selection,
    limited: selection.nextCursor !== null && pages >= maximumPages,
    canLoadMore: selection.nextCursor !== null && pages < maximumPages,
    loadMore: () =>
      setRequest({ key, pages: Math.min(pages + 1, maximumPages) }),
  }
}
