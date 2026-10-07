"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { DeleteTagDialog } from "@/features/tags/components/delete-tag-dialog"
import { TagCard } from "@/features/tags/components/tag-card"
import { TagForm } from "@/features/tags/components/tag-form"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import {
  deleteLocalTag,
  saveLocalTag,
  type TagDraft,
} from "@/features/tags/local-tags"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { Tag } from "@/types/preferences"

export function TagManager({ account }: { account: LocalAccount }) {
  const { data, error, isLoading, mutate } = useLocalTags(account)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)
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
    <div className="space-y-6">
      <p className="text-zinc-600 dark:text-zinc-300">
        Crea tus categorías y elígelas en cada tarea después de guardarla.
      </p>
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
            disabled={deleting || saving}
            onSave={save}
            onCancel={() => {
              setEditing(null)
              setVersion((value) => value + 1)
            }}
          />
          <section aria-label="Categorías guardadas">
            <h2 className="mb-4 text-xl font-semibold">Tus categorías</h2>
            {data.tags.length ? (
              <ul className="space-y-4">
                {data.tags.map((tag) => (
                  <li key={tag.id}>
                    <TagCard
                      tag={tag}
                      busy={deleting || saving}
                      onEdit={() => setEditing(tag)}
                      onDelete={() => setPendingDelete(tag)}
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
