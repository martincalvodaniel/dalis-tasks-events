"use client"

import { useId } from "react"
import type { Tag } from "@/types/preferences"

export function ItemCategorySelect({
  title,
  tags,
  selectedId,
  busy,
  onChange,
  itemId,
}: {
  itemId?: string
  title: string
  tags: Tag[]
  selectedId: string | null
  busy: boolean
  onChange: (tagId: string | null) => void
}) {
  const id = useId()
  const active = tags.some((tag) => tag.id === selectedId) ? selectedId : ""
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Categoría
      </label>
      <select
        id={id}
        data-item-id={itemId}
        value={active ?? ""}
        disabled={busy}
        onChange={(event) => onChange(event.target.value || null)}
        aria-label={`Categoría de ${title}`}
        className="min-h-12 w-full max-w-full rounded-xl border border-zinc-300 bg-transparent px-3 py-2 disabled:opacity-50 dark:border-zinc-700"
      >
        <option value="">Sin categoría</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  )
}
