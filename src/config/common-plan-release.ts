import { selectProductSyncProtocol } from "@/config/product-sync-protocol"

// Preview content reset is complete; the local boundary requires device confirmation.
// One build-time choice connects transport, retirement, provider, and all plan screens.
export const commonPlanReleaseEnabled: boolean = true
// Select recurring ports together; server readiness still gates every write.
export const recurringSyncReleaseEnabled: boolean =
  commonPlanReleaseEnabled && true
// Compiled action, durable transition, two-partition and offline editor acceptance are complete.
export const settingsSyncReleaseEnabled: boolean = true

export const activeProductSyncProtocol = selectProductSyncProtocol({
  commonPlans: commonPlanReleaseEnabled,
  recurringPlans: recurringSyncReleaseEnabled,
  personalSettings: settingsSyncReleaseEnabled,
})
