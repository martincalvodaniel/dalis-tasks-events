import { BackupItemContent } from "@/features/workspace/components/backup-item-content"
import type { BackupImportRow } from "@/types/backup-import"

const classifications = {
  new: "No está en este dispositivo",
  identical: "Ya existe aquí; la copia será adicional",
  changed: "Contenido distinto aquí",
  source_deleted: "Borrado en el archivo",
  current_deleted: "Original borrado aquí; se creará otro",
  both_deleted: "Borrado en ambos",
} as const

export function BackupImportSelectionRow({
  row,
  checked,
  disabled,
  onToggle,
}: {
  row: BackupImportRow
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  if (!("kind" in row.source && "title" in row.source)) return null
  const item = row.source
  const supported = row.support === "simple_item" && item.deletedAt === null
  return (
    <li className="grid grid-cols-[1fr_auto] items-start gap-x-2 py-1">
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled || !supported}
          onChange={onToggle}
          className="size-5 shrink-0 accent-emerald-700"
        />
        <span className="min-w-0 break-words">
          <span className="block font-medium">{item.title}</span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400">
            {classifications[row.classification]}
            {!supported && item.deletedAt === null
              ? " · Tipo todavía no admitido"
              : ""}
          </span>
        </span>
      </label>
      <details className="contents">
        <summary
          aria-label={`Ver contenido y comparación de ${item.title}`}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-xs"
        >
          Ver
        </summary>
        <div className="col-span-2 ml-8 space-y-2 pb-2">
          <div>
            <p className="text-xs font-medium">En el archivo: {item.title}</p>
            <BackupItemContent item={item} />
          </div>
          {row.current && "kind" in row.current && "title" in row.current ? (
            <div>
              <p className="text-xs font-medium">Aquí: {row.current.title}</p>
              <BackupItemContent item={row.current} />
            </div>
          ) : null}
        </div>
      </details>
    </li>
  )
}
