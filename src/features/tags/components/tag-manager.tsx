"use client"

import { useState } from "react"
import { DragOrderHandle } from "@/components/ui/drag-order-handle"
import { ErrorBanner } from "@/components/ui/error-banner"
import { OrderControls } from "@/components/ui/order-controls"
import { DeleteTagDialog } from "@/features/tags/components/delete-tag-dialog"
import { TagCard } from "@/features/tags/components/tag-card"
import { TagForm } from "@/features/tags/components/tag-form"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useTagOrder } from "@/features/tags/hooks/use-tag-order"
import {
  deleteLocalTag,
  saveLocalTag,
  type TagDraft,
} from "@/features/tags/local-tags"
import type { LocalAccount } from "@/features/workspace/local-account"
import { adjacentMoveNeighbors } from "@/lib/ordering/move-neighbors"
import type { Tag } from "@/types/preferences"

export function TagManager({ account }: { account: LocalAccount }) {
  const { data, error, isLoading, mutate } = useLocalTags(account)
  const ordering = useTagOrder(account)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)
  const busy = deleting || saving || ordering.busy
  async function save(tagId: string, draft: TagDraft, operationId: string) {
    setSaving(true)
    try {
      await saveLocalTag(
        account,
        tagId,
        draft,
        operationId,
        editing ?? undefined
      )
      await mutate()
      setEditing(null)
      setVersion((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }
  async function remove(tag: Tag, operationId: string) {
    setDeleting(true)
    try {
      await deleteLocalTag(account, tag, operationId)
      await mutate()
      if (editing?.id === tag.id) {
        setEditing(null)
        setVersion((value) => value + 1)
      }
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }
  return (
    <div className="space-y-4">
      <p className="hidden md:block text-sm text-zinc-600 dark:text-zinc-300">
        Crea tus categorías y elígelas en cada tarea después de guardarla.
      </p>
      {ordering.error ? (
        <ErrorBanner>
          No se pudo cambiar el orden. La lista se ha actualizado; vuelve a
          intentarlo.
        </ErrorBanner>
      ) : null}
      {ordering.busy ? <p role="status">Guardando orden…</p> : null}
      {pendingDelete ? (
        <DeleteTagDialog
          tag={pendingDelete}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={(operationId) => remove(pendingDelete, operationId)}
        />
      ) : null}
      {error ? (
        <ErrorBanner>
          No se pudieron leer las categorías. Vuelve a abrir tu espacio; tus
          cambios se conservan.
        </ErrorBanner>
      ) : isLoading ? (
        <p role="status">Leyendo categorías…</p>
      ) : data ? (
        <>
          <TagForm
            key={editing?.id ?? version}
            initialTag={editing ?? undefined}
            newPosition={(data.tags.at(-1)?.position ?? -1) + 1}
            disabled={busy}
            onSave={save}
            onCancel={() => {
              setEditing(null)
              setVersion((value) => value + 1)
            }}
          />
          <section aria-label="Categorías guardadas">
            <h2 className="mb-2 text-base font-semibold">Tus categorías</h2>
            {data.tags.length ? (
              <ul data-order-list className="space-y-1.5">
                {data.tags.map((tag, index) => (
                  <li
                    key={tag.id}
                    data-order-item={tag.id}
                    data-order-label={tag.name}
                  >
                    <TagCard
                      tag={tag}
                      busy={busy}
                      onEdit={() => setEditing(tag)}
                      onDelete={() => setPendingDelete(tag)}
                      orderControl={
                        <>
                          <DragOrderHandle
                            itemId={tag.id}
                            label={`categoría ${tag.name}`}
                            peers={data.tags.map((record) => record.id)}
                            busy={busy}
                            onDrop={(neighbors) => {
                              void ordering.change({
                                type: "tag.move",
                                tagId: tag.id,
                                ...neighbors,
                              })
                            }}
                          />
                          <OrderControls
                            label={`categoría ${tag.name}`}
                            busy={busy}
                            canMoveUp={index > 0}
                            canMoveDown={index < data.tags.length - 1}
                            onMove={(direction) => {
                              const neighbors = adjacentMoveNeighbors(
                                data.tags.map((record) => record.id),
                                tag.id,
                                direction
                              )
                              if (neighbors)
                                void ordering.change({
                                  type: "tag.move",
                                  tagId: tag.id,
                                  ...neighbors,
                                })
                            }}
                          />
                        </>
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Todavía no tienes categorías. Las tareas siguen disponibles como
                «Sin categoría».
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
