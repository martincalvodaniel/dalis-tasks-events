import type { z } from "zod"
import {
  createPlanAppearanceReader,
  type PlanAppearancePage,
} from "@/lib/calendar/plan-appearance-page"
import { planAppearanceQuerySchema } from "@/schemas/plan-appearance-query"
import type { Plan } from "@/types/plan-item"
import type { PlanOccurrence } from "@/types/plan-occurrence"

export function readPlanAppearanceSelection(
  plans: readonly Plan[],
  occurrences: readonly PlanOccurrence[],
  userId: string,
  queryInput: z.input<typeof planAppearanceQuerySchema>,
  pages: number | "all"
): PlanAppearancePage {
  const query = planAppearanceQuerySchema.parse(queryInput)
  const readPage = createPlanAppearanceReader(plans, occurrences, userId)
  const completeDay = query.startDate === query.endDate
  const selection: PlanAppearancePage = {
    views: [],
    issues: [],
    nextCursor: null,
  }
  const seen = new Set<string>()
  for (let page = 0; completeDay || pages === "all" || page < pages; page++) {
    const result = readPage(query, selection.nextCursor)
    selection.views.push(...result.views)
    selection.issues.push(...result.issues)
    selection.nextCursor = result.nextCursor
    if (!result.nextCursor) break
    const key = JSON.stringify(result.nextCursor)
    if (seen.has(key))
      throw new Error("Plan appearance pagination did not advance")
    seen.add(key)
  }
  return selection
}
