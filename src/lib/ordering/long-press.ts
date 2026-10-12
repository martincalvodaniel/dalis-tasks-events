export const longPressDelay = 350
export const longPressTolerance = 12

export function longPressPhase(elapsed: number, distance: number) {
  if (distance > longPressTolerance) return "cancelled"
  return elapsed >= longPressDelay ? "active" : "waiting"
}
