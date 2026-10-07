import { z } from "zod"
import {
  civilDateSchema,
  entityIdSchema,
  occurrenceIdSchema,
} from "@/schemas/primitives"

export const taskReferenceIdSchema = z.union([
  entityIdSchema,
  occurrenceIdSchema.refine((value) => {
    const separator = value.indexOf(":")
    return (
      separator > 0 &&
      entityIdSchema.safeParse(value.slice(0, separator)).success &&
      civilDateSchema.safeParse(value.slice(separator + 1)).success
    )
  }, "Invalid task occurrence reference"),
])

export const overduePlacementDate = "0001-01-01"
const placementKeyTupleSchema = z.tuple([
  occurrenceIdSchema,
  z.enum(["day", "overdue"]),
  civilDateSchema,
])

export function placementDate(scope: "day" | "overdue", date: string): string {
  return scope === "overdue" ? overduePlacementDate : date
}

export function taskPlacementEntityKey(
  occurrenceId: string,
  scope: "day" | "overdue",
  date: string
): string {
  return `task-placement:${JSON.stringify([occurrenceId, scope, placementDate(scope, date)])}`
}

export const taskPlacementEntityKeySchema = z.string().refine((value) => {
  if (!value.startsWith("task-placement:")) return false
  try {
    const tuple = placementKeyTupleSchema.parse(JSON.parse(value.slice(15)))
    return value === taskPlacementEntityKey(...tuple)
  } catch {
    return false
  }
}, "Invalid task placement entity key")
