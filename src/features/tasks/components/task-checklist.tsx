"use client"

import type { ChecklistEntry } from "@/types/calendar-item"

export function TaskChecklist({
  entries,
  busy,
  onChange,
}: {
  entries: ChecklistEntry[]
  busy: boolean
  onChange?: (entryId: string, completed: boolean) => void
}) {
  return (
    <ul aria-label="Checklist" className="mt-4 space-y-2 text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="wrap-anywhere">
          {onChange ? (
            <label className="flex min-h-12 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={entry.completed}
                disabled={busy}
                onChange={(event) => onChange(entry.id, event.target.checked)}
                aria-label={`Completar paso: ${entry.text}`}
                className="h-5 w-5 shrink-0 accent-emerald-700"
              />
              <span className={entry.completed ? "line-through" : undefined}>
                {entry.text}
              </span>
            </label>
          ) : (
            <span>
              {entry.completed ? "✓ " : "○ "}
              {entry.text}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
