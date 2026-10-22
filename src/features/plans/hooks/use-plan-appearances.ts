"use client"

import { useMemo } from "react"
import type { z } from "zod"
import type { readLocalPlans } from "@/features/plans/local-plans"
import { readPlanAppearanceSelection } from "@/lib/calendar/plan-appearance-selection"
import type { planAppearanceQuerySchema } from "@/schemas/plan-appearance-query"

export function usePlanAppearances(
  data: Awaited<ReturnType<typeof readLocalPlans>> | undefined,
  userId: string,
  _epoch: string,
  query: z.input<typeof planAppearanceQuerySchema> | null
) {
  const selection = useMemo(
    () =>
      data && query
        ? readPlanAppearanceSelection(
            data.plans,
            data.occurrences,
            userId,
            { ...query, limit: 500 },
            "all"
          )
        : { views: [], issues: [], nextCursor: null },
    [data, userId, query]
  )
  return selection
}
