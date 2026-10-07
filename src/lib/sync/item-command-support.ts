import type { CalendarItem } from "@/types/calendar-item"
import type { SyncCommand } from "@/types/sync"

export function supportsRemoteItemCommand(
  command: SyncCommand,
  current: CalendarItem | null
): boolean {
  if (current && (current.kind === "birthday" || current.recurrence))
    return false
  switch (command.type) {
    case "item.create":
    case "item.update":
      return command.input.kind !== "birthday" && !command.input.recurrence
    case "item.delete":
      return true
    case "task.set-status":
    case "task.set-checklist-entry":
      return command.occurrenceId === null && current?.kind === "task"
    default:
      return false
  }
}
