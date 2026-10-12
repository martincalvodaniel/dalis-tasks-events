import { expect, test } from "bun:test"
import { longPressPhase } from "@/lib/ordering/long-press"

test("long press allows scrolling before activation and requires a deliberate hold", () => {
  expect(longPressPhase(349, 0)).toBe("waiting")
  expect(longPressPhase(350, 12)).toBe("active")
  expect(longPressPhase(80, 13)).toBe("cancelled")
  expect(longPressPhase(350, 13)).toBe("cancelled")
})
