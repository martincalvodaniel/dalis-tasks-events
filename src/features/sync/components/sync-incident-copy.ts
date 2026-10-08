import type { TaskStatus } from "@/types/calendar-item"

export const incidentTaskStatuses: Record<TaskStatus, string> = {
  not_started: "Sin empezar",
  in_progress: "En proceso",
  completed: "Completada",
}
