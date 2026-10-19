"use client"

import { useMemo, useState } from "react"
import type { z } from "zod"
import type { readLocalPlans } from "@/features/plans/local-plans"
import { readPlanAppearanceSelection } from "@/lib/calendar/plan-appearance-selection"
import type { planAppearanceQuerySchema } from "@/schemas/plan-appearance-query"

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
  const selection = useMemo(
    () =>
      data && query
        ? readPlanAppearanceSelection(
            data.plans,
            data.occurrences,
            userId,
            query,
            pages
          )
        : { views: [], issues: [], nextCursor: null },
    [data, userId, query, pages]
  )
  return {
    ...selection,
    limited: selection.nextCursor !== null && pages >= maximumPages,
    canLoadMore: selection.nextCursor !== null && pages < maximumPages,
    loadMore: () =>
      setRequest({ key, pages: Math.min(pages + 1, maximumPages) }),
  }
}
