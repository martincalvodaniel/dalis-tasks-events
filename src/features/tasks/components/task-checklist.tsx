"use client"

import {
  ItemCompletionIcon,
  type ItemCompletionVariant,
} from "@/components/ui/item-completion-icon"
import type { ChecklistEntry } from "@/types/calendar-item"

export function TaskChecklist({
  entries,
  busy,
  onChange,
  variant = "task",
  categoryColor,
}: {
  variant?: ItemCompletionVariant
  categoryColor?: string | null
  entries: ChecklistEntry[]
  busy: boolean
  onChange?: (entryId: string, completed: boolean) => void
}) {
  return (
    <ul aria-label="Checklist" className="my-1 space-y-0 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="wrap-anywhere">
          {onChange ? (
            <label className="relative flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={entry.completed}
                disabled={busy}
                onChange={(event) => onChange(entry.id, event.target.checked)}
                aria-label={`Completar paso: ${entry.text}`}
                className="peer absolute top-1/2 left-0 size-5 -translate-y-1/2 opacity-0"
              />
              <span className="pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-700 peer-disabled:opacity-50">
                <ItemCompletionIcon
                  variant={variant}
                  completed={entry.completed}
                  color={categoryColor}
                />
              </span>
              <span className={entry.completed ? "line-through" : undefined}>
                {entry.text}
              </span>
            </label>
          ) : (
            <span className="flex items-center gap-2">
              <ItemCompletionIcon
                variant={variant}
                completed={entry.completed}
                color={categoryColor}
                className="size-5 shrink-0"
              />
              <span className={entry.completed ? "line-through" : undefined}>
                {entry.text}
              </span>
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
