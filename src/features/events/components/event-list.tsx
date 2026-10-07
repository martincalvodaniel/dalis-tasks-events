"use client"

import { useMemo, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import type { EventCalendarIssue } from "@/features/events/calendar-events"
import { DeleteEventDialog } from "@/features/events/components/delete-event-dialog"
import { EventActions } from "@/features/events/components/event-actions"
import { EventCard } from "@/features/events/components/event-card"
import { EventComposer } from "@/features/events/components/event-composer"
import { createEventSummary } from "@/features/events/event-summary"
import { useLocalEvents } from "@/features/events/hooks/use-local-events"
import { deleteLocalEvent } from "@/features/events/local-events"
import { useItemCategory } from "@/features/tags/hooks/use-item-category"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { CalendarEvent } from "@/types/calendar-item"

export function EventList({
  account,
  events,
  timeZone,
  issues,
  heading,
  hideEmpty = false,
}: {
  account: LocalAccount
  events: readonly CalendarEvent[]
  timeZone: string
  issues: readonly EventCalendarIssue[]
  heading: string
  hideEmpty?: boolean
}) {
  const { mutate } = useLocalEvents(account)
  const { refresh } = useLocalAccount()
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CalendarEvent | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteLock = useRef(false)
  const categories = useLocalTags(account)
  const category = useItemCategory(account)
  const summarize = useMemo(() => createEventSummary(timeZone), [timeZone])
  async function remove(event: CalendarEvent, operationId: string) {
    if (deleteLock.current) return
    deleteLock.current = true
    setDeleting(true)
    try {
      await deleteLocalEvent(account, event, operationId)
      void mutate().catch(() => undefined)
      void refresh().catch(() => undefined)
      setPendingDelete(null)
    } catch (error) {
      await mutate().catch(() => undefined)
      throw error
    } finally {
      deleteLock.current = false
      setDeleting(false)
    }
  }
  if (
    hideEmpty &&
    !events.length &&
    !issues.length &&
    !editing &&
    !pendingDelete
  )
    return null
  return (
    <section aria-label={heading} className="mt-5">
      {editing ? (
        <EventComposer
          key={editing.id}
          account={account}
          event={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refresh().catch(() => undefined)
          }}
        />
      ) : null}
      {pendingDelete ? (
        <DeleteEventDialog
          event={pendingDelete}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={(operationId) => remove(pendingDelete, operationId)}
        />
      ) : null}
      <h2 className="mb-2 text-base font-semibold">{heading}</h2>
      {category.error ? (
        <ErrorBanner>
          No se pudo cambiar la categoría. Revisa la selección y vuelve a
          intentarlo.
        </ErrorBanner>
      ) : null}
      {events.length ? (
        <ul className="space-y-2">
          {events.map((event) => {
            const selectedTagId = categories.data?.views[event.id] ?? null
            return (
              <li key={event.id}>
                <EventCard
                  event={event}
                  summary={summarize(event)}
                  timeZone={timeZone}
                  tags={categories.error ? undefined : categories.data?.tags}
                  selectedTagId={selectedTagId}
                  busy={category.busy || deleting}
                  onEdit={() => setEditing(event)}
                  onDelete={() => setPendingDelete(event)}
                  onCategoryChange={(tagId) => {
                    if (tagId !== selectedTagId)
                      void category.change({ itemId: event.id, tagId })
                  }}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No hay eventos este día.
        </p>
      )}
      {issues.length ? (
        <details className="mt-2 rounded-lg border border-amber-500 px-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-3">
            {issues.length}{" "}
            {issues.length === 1
              ? "evento con hora o fecha pendiente de revisión"
              : "eventos con hora o fecha pendientes de revisión"}
          </summary>
          <p className="mb-2">
            Estos eventos no se pueden situar en el calendario con sus datos
            actuales.
          </p>
          <ul className="mb-3 space-y-1">
            {issues.map(({ event, reason }) => (
              <li key={event.id}>
                {event.title}:{" "}
                {reason === "ambiguous"
                  ? "hora repetida"
                  : reason === "nonexistent"
                    ? "hora inexistente"
                    : "fecha u hora inválida"}
                .
                <EventActions
                  title={event.title}
                  busy={category.busy || deleting}
                  onEdit={() => setEditing(event)}
                  onDelete={() => setPendingDelete(event)}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}
