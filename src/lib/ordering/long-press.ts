export function longPressPhase(elapsed: number, distance: number) {
  if (distance > 8) return "cancelled"
  return elapsed >= 450 ? "active" : "waiting"
}
