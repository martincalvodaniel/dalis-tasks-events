import { expect, test } from "bun:test"
import { longPressPhase } from "@/lib/ordering/long-press"

test("long press allows scrolling before activation and requires a deliberate hold", () => {
  expect(longPressPhase(449, 0)).toBe("waiting")
  expect(longPressPhase(450, 8)).toBe("active")
  expect(longPressPhase(80, 9)).toBe("cancelled")
  expect(longPressPhase(450, 9)).toBe("cancelled")
})
