export function selectProductSyncProtocol({
  commonPlans,
  recurringPlans,
  personalSettings,
}: {
  commonPlans: boolean
  recurringPlans: boolean
  personalSettings: boolean
}): 3 | 4 | 5 | 6 {
  if (!commonPlans) return 3
  if (!recurringPlans) return 4
  return personalSettings ? 6 : 5
}
