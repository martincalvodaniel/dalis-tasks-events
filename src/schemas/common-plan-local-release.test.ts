import { expect, test } from "bun:test"
import {
  commonPlanLocalReleaseSchema,
  commonPlanLocalResetSchema,
} from "@/schemas/common-plan-local-release"

const marker = {
  key: "common-plan-release",
  version: 4,
  userId: "test-user",
  preparedAt: "2026-10-11T01:00:00.000Z",
  operationId: null,
} as const
test("local plan readiness requires exact generation and account-scoped evidence", () => {
  expect(commonPlanLocalReleaseSchema.parse(marker)).toEqual(marker)
  for (const invalid of [
    { ...marker, version: 3 },
    { ...marker, userId: "" },
    { ...marker, preparedAt: "invalid" },
    { ...marker, operationId: "invalid" },
    { ...marker, unknown: true },
  ]) {
    expect(commonPlanLocalReleaseSchema.safeParse(invalid).success).toBe(false)
  }
  expect(
    commonPlanLocalResetSchema.safeParse({
      operationId: null,
      preparedAt: marker.preparedAt,
    }).success
  ).toBe(false)
})
