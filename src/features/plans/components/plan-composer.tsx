"use client"

import { useEffect, useId, useRef } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { itemEditorDialogClass } from "@/config/item-editor"
import { PlanForm } from "@/features/plans/components/plan-form"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { saveLocalPlan } from "@/features/plans/local-plans"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import type { LocalAccount } from "@/features/workspace/local-account"
import { todayInTimeZone } from "@/lib/calendar/civil-date"
import type { PlanSaveRequest } from "@/schemas/plan-save"
import type { Plan, PlanDraft } from "@/types/plan-item"
import type { ItemView } from "@/types/preferences"

export function PlanComposer({
  account,
  initialPlan,
  initialView,
  initialDate,
  onClose,
  onSaved,
}: {
  account: LocalAccount
  initialPlan?: Plan
  initialView?: ItemView | null
  initialDate?: string
  onClose: () => void
  onSaved: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const saving = useRef(false)
  const intent = useRef<{
    serialized: string
    request: PlanSaveRequest
  } | null>(null)
  const viewSnapshot = useRef<{ view: ItemView | null } | null>(null)
  const { data, error, mutate } = useLocalPlans(account)
  const { mutate: refreshTags } = useLocalTags(account)
  if (data && viewSnapshot.current === null)
    viewSnapshot.current = {
      view:
        initialView !== undefined
          ? initialView
          : initialPlan
            ? (data.views.find((view) => view.itemId === initialPlan.id) ??
              null)
            : null,
    }
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  async function save(draft: {
    input: PlanDraft
    primaryTagId: string | null
  }) {
    if (saving.current) return
    const serialized = JSON.stringify(draft)
    if (intent.current?.serialized !== serialized) {
      const common = {
        itemId:
          initialPlan?.id ??
          intent.current?.request.itemId ??
          crypto.randomUUID(),
        contentOperationId: crypto.randomUUID(),
        viewOperationId: crypto.randomUUID(),
        now: new Date().toISOString(),
        ...draft,
      }
      intent.current = {
        serialized,
        request: initialPlan
          ? {
              ...common,
              mode: "update",
              expectedPlan: initialPlan,
              expectedView: viewSnapshot.current?.view ?? null,
            }
          : { ...common, mode: "create" },
      }
    }
    saving.current = true
    try {
      await saveLocalPlan(account, intent.current.request)
    } finally {
      saving.current = false
    }
    onSaved()
    void Promise.all([mutate(), refreshTags()]).catch(() => undefined)
    onClose()
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      className={itemEditorDialogClass}
      onClose={() => {
        if (!dialog.current?.open) onClose()
      }}
      onCancel={(event) => {
        if (saving.current) event.preventDefault()
      }}
    >
      <h2 id={headingId} className="sr-only">
        {initialPlan ? "Editar plan" : "Nuevo plan"}
      </h2>
      {error ? (
        <>
          <ErrorBanner>
            No se pudo abrir la cuenta local. Cierra el formulario y vuelve a
            intentarlo.
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
        <PlanForm
          scheduledDate={initialDate ?? todayInTimeZone(data.timeZone)}
          timeZone={data.timeZone}
          initialPlan={initialPlan}
          initialTagId={viewSnapshot.current?.view?.primaryTagId ?? null}
          tags={data.tags}
          onSave={save}
          onCancel={onClose}
        />
      ) : (
        <p role="status">Preparando formulario…</p>
      )}
    </dialog>
  )
}
