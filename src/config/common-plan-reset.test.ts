import { expect, test } from "bun:test"
import { allowsCommonPlanLocalReset } from "@/config/common-plan-reset"

const preview =
  "https://dalis-tasks-events-git-int-martincalvodaniels-projects.vercel.app"
test("local content reset is confined to Preview and explicit loopback development origins", () => {
  expect(allowsCommonPlanLocalReset(preview)).toBe(true)
  expect(allowsCommonPlanLocalReset("http://127.0.0.1:4241")).toBe(true)
  expect(allowsCommonPlanLocalReset("http://localhost:3000")).toBe(true)
  for (const origin of [
    "https://dalis-tasks-events.vercel.app",
    `${preview}.evil.example`,
    `${preview}/workspace`,
    "http://192.168.1.12:3000",
    "https://localhost:3000",
    "http://localhost:3000/path",
    "http://user:secret@localhost:3000",
    "null",
  ])
    expect(allowsCommonPlanLocalReset(origin)).toBe(false)
})
