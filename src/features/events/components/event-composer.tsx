"use client"

import { useEffect, useId, useRef } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { EventForm } from "@/features/events/components/event-form"
import { useLocalEvents } from "@/features/events/hooks/use-local-events"
import {
  type EventDraft,
  updateLocalEvent,
} from "@/features/events/local-events"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { CalendarEvent } from "@/types/calendar-item"

export function EventComposer({
  account,
  event,
  onClose,
  onSaved,
}: {
  account: LocalAccount
  event: CalendarEvent
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const intent = useRef<{ serialized: string; operationId: string } | null>(
    null
  )
  const headingId = useId()
  const { data, error, mutate } = useLocalEvents(account)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  async function save(draft: EventDraft) {
    if (saving.current) return
    const serialized = JSON.stringify(draft)
    const active =
      intent.current?.serialized === serialized
        ? intent.current
        : { serialized, operationId: crypto.randomUUID() }
    intent.current = active
    saving.current = true
    try {
      await updateLocalEvent(account, event, draft, active.operationId)
    } catch (error) {
      await mutate().catch(() => undefined)
      throw error
    } finally {
      saving.current = false
    }
    onSaved()
    void mutate().catch(() => undefined)
    onClose()
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={() => {
        if (!dialog.current?.open) onClose()
      }}
      onCancel={(action) => {
        if (saving.current) action.preventDefault()
      }}
      className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] min-w-0 max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-3 wrap-anywhere text-zinc-900 shadow-xl backdrop:bg-black/40 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <h2 id={headingId} className="mb-3 text-lg font-semibold">
        Editar evento
      </h2>
      {error ? (
        <>
          <ErrorBanner>
            No se pudo abrir la cuenta local. Tus cambios se conservan.
          </ErrorBanner>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 min-h-11 rounded-lg border px-3"
          >
            Cerrar
          </button>
        </>
      ) : data ? (
        <EventForm
          initialEvent={event}
          scheduledDate={
            event.schedule.mode === "all_day"
              ? event.schedule.startDate
              : event.schedule.localStart.slice(0, 10)
          }
          timeZone={data.timeZone}
          onSave={save}
          onCancel={onClose}
        />
      ) : (
        <p role="status">Preparando formulario…</p>
      )}
    </dialog>
  )
}
