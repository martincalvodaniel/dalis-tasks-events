"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Task } from "@/types/calendar-item"

export function DeleteTaskDialog({
  task,
  busy,
  onConfirm,
  onClose,
}: {
  task: Task
  busy: boolean
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <ConfirmationDialog
      heading="¿Eliminar esta tarea?"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Eliminar tarea"
      pendingLabel="Eliminando…"
      cancelLabel="Conservar tarea"
      failureMessage="No se pudo eliminar. Si la tarea cambió en otra pestaña, cierra este diálogo y vuelve a abrirla."
    >
      <p className="mt-4 font-semibold">{task.title}</p>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Se retirará de tus tareas. El borrado quedará guardado en este
        dispositivo para sincronizarlo cuando haya conexión.
      </p>
    </ConfirmationDialog>
  )
}
