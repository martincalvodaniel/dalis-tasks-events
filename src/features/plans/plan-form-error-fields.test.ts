import { expect, test } from "bun:test"
import { planFormErrorFields } from "@/features/plans/plan-form-error-fields"
import { parsePlanForm } from "@/features/plans/plan-form-input"

function validFields() {
  const fields = new FormData()
  for (const [name, value] of Object.entries({
    variant: "task",
    title: "Accessible plan",
    description: "",
    status: "not_started",
    localStartDate: "2026-10-21",
    localStartTime: "09:00",
    localEndDate: "",
    localEndTime: "",
    timeZone: "Europe/Madrid",
    frequency: "none",
    interval: "1",
    recurrenceEnd: "never",
  }))
    fields.set(name, value)
  return fields
}

function destination(fields: FormData) {
  const parsed = parsePlanForm(fields, [])
  if (parsed.success) throw new Error("Expected a form validation error")
  const issue = parsed.error.issues[0]
  return planFormErrorFields(
    issue.path,
    false,
    issue.code === "custom" ? issue.params?.timeReason : null
  )
}

test("actual title, time-zone and recurrence errors identify their controls", () => {
  const title = validFields()
  title.set("title", "   ")
  expect(destination(title)[0]).toBe("title")
  const zone = validFields()
  zone.set("timeZone", "Invalid/Zone")
  expect(destination(zone)[0]).toBe("timeZone")
  const recurrence = validFields()
  recurrence.set("frequency", "daily")
  recurrence.set("interval", "0")
  expect(destination(recurrence)[0]).toBe("interval")
})

test("invalid date and ambiguous civil time choose different visible controls", () => {
  const date = validFields()
  date.set("localStartDate", "")
  expect(destination(date)[0]).toBe("localStartDate")
  const ambiguous = validFields()
  ambiguous.set("localStartDate", "2026-10-25")
  ambiguous.set("localStartTime", "02:30")
  expect(destination(ambiguous)[0]).toBe("localStartTime")
})

test("a real empty checklist error identifies the correct row", () => {
  const parsed = parsePlanForm(validFields(), [
    {
      id: "00000000-0000-4000-8000-000000000001",
      text: "Ready",
      completed: false,
    },
    { id: "00000000-0000-4000-8000-000000000002", text: "", completed: false },
  ])
  if (parsed.success) throw new Error("Expected an empty checklist error")
  expect(planFormErrorFields(parsed.error.issues[0].path, false)).toEqual([
    "checklist.1",
  ])
})
