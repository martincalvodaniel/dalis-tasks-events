import { expect, test } from "bun:test"
import { taskReferenceIdSchema } from "@/schemas/ordering"

test("ordering references preserve canonical UUID and original civil date or timed slot", () => {
  const id = "00000000-0000-4000-8000-000000000001"
  for (const valid of [
    id,
    `${id}:2026-10-11`,
    `${id}:2026-10-11T09:30`,
    `${id}:0001-01-01T00:00`,
  ])
    expect(taskReferenceIdSchema.parse(valid)).toBe(valid)
  for (const invalid of [
    `${id}:2026-02-30`,
    `${id}:2026-10-11T24:00`,
    `${id}:2026-10-11T09:61`,
    `${id}:2026-10-11T09:30Z`,
    `${id}:2026-10-11T09:30:00`,
    `${id}@2026-10-11`,
    `foreign:2026-10-11T09:30`,
  ])
    expect(taskReferenceIdSchema.safeParse(invalid).success).toBe(false)
})
