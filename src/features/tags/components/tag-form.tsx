"use client"

import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import type { TagDraft } from "@/features/tags/local-tags"
import { tagDraftSchema } from "@/schemas/preferences"
import type { Tag } from "@/types/preferences"

export function TagForm({
  initialTag,
  newPosition,
  disabled,
  onSave,
  onCancel,
}: {
  initialTag?: Tag
  newPosition: number
  disabled: boolean
  onSave: (tagId: string, draft: TagDraft, operationId: string) => Promise<void>
  onCancel: () => void
}) {
  const nameId = useId()
  const nameInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (initialTag) nameInput.current?.focus()
  }, [initialTag])
  const colorId = useId()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const lock = useRef(false)
  const intent = useRef<{ tagId: string; operationId: string } | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const fields = new FormData(event.currentTarget)
    const parsed = tagDraftSchema.safeParse({
      name: fields.get("name"),
      color: fields.get("color"),
      position: initialTag?.position ?? newPosition,
    })
    if (!parsed.success) {
      setError(
        "Escribe un nombre de entre 1 y 60 caracteres y elige un color válido."
      )
      return
    }
    intent.current ??= {
      tagId: initialTag?.id ?? crypto.randomUUID(),
      operationId: crypto.randomUUID(),
    }
    lock.current = true
    setSaving(true)
    setError("")
    try {
      await onSave(
        intent.current.tagId,
        parsed.data,
        intent.current.operationId
      )
    } catch (failure) {
      setError(
        failure instanceof Error &&
          failure.message === "An active category has the same name"
          ? "Ya existe una categoría con ese nombre."
          : "No se pudo guardar. Conservamos tus datos. Si cambió en otra pestaña, cancela y vuelve a abrirla."
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-xl font-semibold">
        {initialTag ? "Editar categoría" : "Nueva categoría"}
      </h2>
      <div>
        <label htmlFor={nameId} className="mb-2 block font-medium">
          Nombre de categoría
        </label>
        <input
          id={nameId}
          ref={nameInput}
          name="name"
          defaultValue={initialTag?.name ?? ""}
          required
          maxLength={60}
          disabled={disabled || saving}
          className="min-h-12 w-full min-w-0 rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
        />
      </div>
      <div>
        <label htmlFor={colorId} className="mb-2 block font-medium">
          Color de categoría
        </label>
        <input
          id={colorId}
          type="color"
          name="color"
          defaultValue={initialTag?.color ?? "#059669"}
          disabled={disabled || saving}
          className="h-12 w-20 cursor-pointer rounded-xl border border-zinc-300 bg-transparent p-1 dark:border-zinc-700"
        />
      </div>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={disabled || saving}
          className="min-h-12 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving
            ? "Guardando…"
            : initialTag
              ? "Guardar cambios"
              : "Crear categoría"}
        </button>
        {initialTag ? (
          <button
            type="button"
            disabled={disabled || saving}
            onClick={onCancel}
            className="min-h-12 rounded-xl border border-zinc-300 px-4 py-3 disabled:opacity-50 dark:border-zinc-700"
          >
            Cancelar edición
          </button>
        ) : null}
      </div>
    </form>
  )
}
