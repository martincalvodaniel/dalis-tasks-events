export function planFormErrorFields(
  path: readonly PropertyKey[],
  allDay: boolean,
  timeReason?: unknown
): string[] {
  if (path.includes("timeZone")) return ["timeZone"]
  if (path[0] === "title" || path[0] === "description") return [String(path[0])]
  if (path[0] === "checklist") {
    const index = typeof path[1] === "number" ? path[1] : 0
    return [`checklist.${index}`]
  }
  if (path[0] === "recurrence") {
    if (path.includes("interval")) return ["interval"]
    if (path.includes("weekdays")) return ["weekdays", "frequency"]
    if (path.includes("date")) return ["untilDate", "recurrenceEnd"]
    if (path.includes("count")) return ["count", "recurrenceEnd"]
    return ["frequency"]
  }
  if (path[0] === "schedule") {
    if (path.includes("localEnd") || path.includes("endDateExclusive"))
      return ["localEndDate", "localStartDate"]
    return !allDay &&
      (timeReason === "ambiguous" || timeReason === "nonexistent")
      ? ["localStartTime", "localStartDate"]
      : ["localStartDate", "localStartTime"]
  }
  return ["title"]
}
