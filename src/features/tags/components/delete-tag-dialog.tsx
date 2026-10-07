"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Tag } from "@/types/preferences"

export function DeleteTagDialog({
  tag,
  busy,
  onConfirm,
  onClose,
}: {
  tag: Tag
  busy: boolean
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <ConfirmationDialog
      heading="¿Eliminar esta categoría?"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Eliminar categoría"
      pendingLabel="Eliminando…"
      cancelLabel="Conservar categoría"
      failureMessage="No se pudo eliminar. Si la categoría cambió en otra pestaña, cierra este diálogo y vuelve a abrirla."
    >
      <p className="mt-4 font-semibold">{tag.name}</p>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        Las tareas se conservarán y aparecerán sin categoría.
      </p>
    </ConfirmationDialog>
  )
}
