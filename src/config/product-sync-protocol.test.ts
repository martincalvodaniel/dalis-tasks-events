import { expect, test } from "bun:test"
import {
  activeProductSyncProtocol,
  settingsSyncReleaseEnabled,
} from "@/config/common-plan-release"
import { selectProductSyncProtocol } from "@/config/product-sync-protocol"

test("settings selection requires the complete common and recurring release prerequisites", () => {
  for (const recurringPlans of [false, true])
    for (const personalSettings of [false, true])
      expect(
        selectProductSyncProtocol({
          commonPlans: false,
          recurringPlans,
          personalSettings,
        })
      ).toBe(3)
  for (const personalSettings of [false, true])
    expect(
      selectProductSyncProtocol({
        commonPlans: true,
        recurringPlans: false,
        personalSettings,
      })
    ).toBe(4)
  expect(
    selectProductSyncProtocol({
      commonPlans: true,
      recurringPlans: true,
      personalSettings: false,
    })
  ).toBe(5)
  expect(
    selectProductSyncProtocol({
      commonPlans: true,
      recurringPlans: true,
      personalSettings: true,
    })
  ).toBe(6)
})

test("the published product selects the complete settings release after compiled acceptance", () => {
  expect(settingsSyncReleaseEnabled).toBe(true)
  expect(activeProductSyncProtocol).toBe(6)
})
