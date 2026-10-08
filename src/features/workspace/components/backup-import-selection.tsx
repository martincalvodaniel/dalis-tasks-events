"use client"

import { useState } from "react"
import { BackupImportSelectionRow } from "@/features/workspace/components/backup-import-selection-row"
import type { BackupImportPreview } from "@/types/backup-import"

const pageSize = 20

export function BackupImportSelection({
  preview,
  selected,
  busy,
  onToggle,
}: {
  preview: BackupImportPreview
  selected: string[]
  busy: boolean
  onToggle: (id: string) => void
}) {
  const [page, setPage] = useState(0)
  const rows = preview.stores.items
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const extraRecords = Object.entries(preview.stores)
    .filter(([store]) => store !== "items")
    .reduce((count, [, records]) => count + records.length, 0)
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {rows.length} elementos · {selected.length}/50 seleccionados. Se crearán
        copias nuevas; los elementos actuales se conservan.
      </p>
      {rows.length === 0 ? <p>El archivo no contiene elementos.</p> : null}
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
          <BackupImportSelectionRow
            key={row.key}
            row={row}
            checked={selected.includes(row.key)}
            disabled={
              busy || (selected.length >= 50 && !selected.includes(row.key))
            }
            onToggle={() => onToggle(row.key)}
          />
        ))}
      </ul>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={busy || page === 0}
            onClick={() => setPage(page - 1)}
            className="min-h-11 px-3 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs">
            {page + 1}/{pageCount}
          </span>
          <button
            type="button"
            disabled={busy || page + 1 === pageCount}
            onClick={() => setPage(page + 1)}
            className="min-h-11 px-3 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      ) : null}
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Solo tareas y eventos sin repetición y sin borrar. Las categorías, el
        orden y los demás datos del archivo se conservan como parte de la copia
        de seguridad, pero no se aplican ({extraRecords} registros).
      </p>
    </div>
  )
}
