import type { ChecklistEntry } from "@/types/calendar-item"

export function ChecklistFields({
  entries,
  onChange,
  disabled,
}: {
  entries: ChecklistEntry[]
  onChange: (entries: ChecklistEntry[]) => void
  disabled: boolean
}) {
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-3 font-semibold">Checklist</legend>
      {entries.map((entry, index) => (
        <div key={entry.id} className="flex items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            Paso {index + 1}
            <input
              value={entry.text}
              onChange={(event) =>
                onChange(
                  entries.map((current) =>
                    current.id === entry.id
                      ? { ...current, text: event.target.value }
                      : current
                  )
                )
              }
              maxLength={500}
              className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
            />
          </label>
          <button
            type="button"
            aria-label={`Eliminar paso ${index + 1}`}
            onClick={() =>
              onChange(entries.filter((current) => current.id !== entry.id))
            }
            className="min-h-12 rounded-xl border border-zinc-300 px-3 text-sm dark:border-zinc-700"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={entries.length >= 100}
        onClick={() =>
          onChange([
            ...entries,
            { id: crypto.randomUUID(), text: "", completed: false },
          ])
        }
        className="min-h-12 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
      >
        Añadir paso
      </button>
    </fieldset>
  )
}
