// Preview content reset is complete; the local boundary requires device confirmation.
// One build-time choice connects transport, retirement, provider, and all plan screens.
export const commonPlanReleaseEnabled: boolean = true
// Keep every recurring product port on the same build-time selection until Preview readiness is verified.
export const recurringSyncReleaseEnabled: boolean =
  commonPlanReleaseEnabled && false
export const activeProductSyncProtocol = commonPlanReleaseEnabled
  ? recurringSyncReleaseEnabled
    ? 5
    : 4
  : 3
