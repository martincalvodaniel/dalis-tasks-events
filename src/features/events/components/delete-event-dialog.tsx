"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { CalendarEvent } from "@/types/calendar-item"

export function DeleteEventDialog({
  event,
  busy,
  onConfirm,
  onClose,
}: {
  event: CalendarEvent
  busy: boolean
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <ConfirmationDialog
      heading="¿Eliminar este evento?"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Eliminar evento"
      pendingLabel="Eliminando…"
      cancelLabel="Conservar evento"
      failureMessage="No se pudo eliminar. Si el evento cambió en otra pestaña, cierra este diálogo y vuelve a abrirlo."
    >
      <p className="mt-3 font-semibold">{event.title}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Se retirará de la agenda y el calendario. El borrado se guardará en este
        dispositivo para sincronizarlo cuando haya conexión.
      </p>
    </ConfirmationDialog>
  )
}
