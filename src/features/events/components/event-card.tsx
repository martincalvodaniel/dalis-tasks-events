"use client"

import { EventActions } from "@/features/events/components/event-actions"
import { ItemCategorySelect } from "@/features/tags/components/item-category-select"
import type { CalendarEvent } from "@/types/calendar-item"
import type { Tag } from "@/types/preferences"

export function EventCard({
  event,
  summary,
  timeZone,
  tags,
  selectedTagId,
  busy,
  onCategoryChange,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent
  summary: string
  timeZone: string
  tags?: Tag[]
  selectedTagId: string | null
  busy: boolean
  onCategoryChange: (tagId: string | null) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const tag = tags?.find((entry) => entry.id === selectedTagId)
  return (
    <details className="min-w-0 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary
        aria-label={`Detalles de ${event.title}`}
        className="min-h-11 cursor-pointer list-none px-3 py-2 focus-visible:outline-2 focus-visible:outline-emerald-700"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-sm font-semibold wrap-anywhere">
            {event.title}
          </span>
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4 shrink-0"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <span className="block text-xs text-zinc-600 dark:text-zinc-400">
          {summary}
          {tag ? ` · ${tag.name}` : ""}
        </span>
      </summary>
      <div className="border-t border-zinc-200 px-3 pb-3 text-sm dark:border-zinc-800">
        {event.description ? (
          <p className="mt-3 whitespace-pre-wrap wrap-anywhere">
            {event.description}
          </p>
        ) : null}
        {event.schedule.mode === "timed" ? (
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Horas mostradas en {timeZone}.
            {event.schedule.timeZone !== timeZone
              ? ` Zona del evento: ${event.schedule.timeZone}.`
              : ""}
          </p>
        ) : null}
        {tags ? (
          <ItemCategorySelect
            itemId={event.id}
            title={event.title}
            tags={tags}
            selectedId={selectedTagId}
            busy={busy}
            onChange={onCategoryChange}
          />
        ) : (
          <p role="status" className="mt-3">
            Las categorías no están disponibles.
          </p>
        )}
        <EventActions
          title={event.title}
          busy={busy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </details>
  )
}
