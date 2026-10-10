"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { LongPressOrder } from "@/components/ui/long-press-order"
import type { PlanAgendaSelection } from "@/features/plans/agenda-selection"
import { CancelPlanOccurrenceDialog } from "@/features/plans/components/cancel-plan-occurrence-dialog"
import { DeletePlanDialog } from "@/features/plans/components/delete-plan-dialog"
import { PlanCard } from "@/features/plans/components/plan-card"
import { PlanComposer } from "@/features/plans/components/plan-composer"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { usePlanAppearances } from "@/features/plans/hooks/use-plan-appearances"
import { usePlanOccurrenceProgress } from "@/features/plans/hooks/use-plan-occurrence-progress"
import { usePlanOrder } from "@/features/plans/hooks/use-plan-order"
import { usePlanProgress } from "@/features/plans/hooks/use-plan-progress"
import {
  changeLocalPlanOccurrence,
  deleteLocalPlan,
} from "@/features/plans/local-plans"
import {
  createPlanAgendaRows,
  groupPlanAgendaRows,
  orderPlanAgendaRows,
  type PlanAgendaRow,
  planAppearanceRange,
} from "@/features/plans/plan-agenda-rows"
import {
  planOrderContext,
  planOrderPeers,
} from "@/features/plans/plan-order-selection"
import { ItemCategorySelect } from "@/features/tags/components/item-category-select"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import {
  assignLocalCategory,
  changeLocalTagOrder,
} from "@/features/tags/local-tags"
import { TaskGroup } from "@/features/tasks/components/task-group"
import { useLocalTaskPlacements } from "@/features/tasks/hooks/use-local-task-placements"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import { useLocalIntent } from "@/features/workspace/hooks/use-local-intent"
import type { LocalAccount } from "@/features/workspace/local-account"
import { addCivilDays } from "@/lib/calendar/civil-date"
import type { LocalPreferenceCommand } from "@/types/local-sync"
import type { Plan } from "@/types/plan-item"
import type { ItemView } from "@/types/preferences"

const allPlansSelection = { kind: "all" } as const

export function PlanList({
  account,
  selection = allPlansSelection,
  heading = "Tus planes",
}: {
  account: LocalAccount
  selection?: PlanAgendaSelection
  heading?: string
}) {
  const { data, error, isLoading, mutate } = useLocalPlans(account)
  const { refresh } = useLocalAccount()
  const { mutate: refreshTags } = useLocalTags(account)
  const progress = usePlanProgress(account)
  const occurrenceProgress = usePlanOccurrenceProgress(account)
  const ordering = usePlanOrder(account)
  const { data: placements, error: placementReadError } =
    useLocalTaskPlacements(account)
  const category = useLocalIntent<{ itemId: string; tagId: string | null }>(
    (command, operationId) =>
      assignLocalCategory(account, command.itemId, command.tagId, operationId),
    () => Promise.all([mutate(), refreshTags()])
  )
  const groupOrdering = useLocalIntent<
    Extract<LocalPreferenceCommand, { type: "tag.move" }>
  >(
    (command, operationId) =>
      changeLocalTagOrder(account, command, operationId),
    () => Promise.all([mutate(), refreshTags()])
  )
  const section = useRef<HTMLElement>(null)
  const categoryFocus = useRef<string | null>(null)
  useEffect(() => {
    if (category.busy || categoryFocus.current === null) return
    section.current
      ?.querySelector<HTMLSelectElement>(
        `select[data-item-id="${categoryFocus.current}"]`
      )
      ?.focus({ preventScroll: true })
    categoryFocus.current = null
  }, [category.busy])
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [editing, setEditing] = useState<{
    plan: Plan
    view: ItemView | null
  } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<PlanAgendaRow | null>(null)
  const [horizonDays, setHorizonDays] = useState(30)
  const horizonEnd = useMemo(() => {
    if (selection.kind !== "upcoming") return "9999-12-31"
    try {
      return addCivilDays(selection.date, horizonDays)
    } catch {
      return "9999-12-31"
    }
  }, [selection, horizonDays])
  const appearanceRange = useMemo(
    () =>
      data
        ? planAppearanceRange(
            data.plans,
            data.occurrences,
            selection,
            horizonEnd
          )
        : null,
    [data, selection, horizonEnd]
  )
  const appearances = usePlanAppearances(
    data,
    account.userId,
    account.epoch,
    appearanceRange
  )
  const rows = data
    ? createPlanAgendaRows(data.plans, appearances.views, selection)
    : []
  const groups = data
    ? groupPlanAgendaRows(rows, data.tags, data.views).map((group) => ({
        ...group,
        rows:
          placements && !placementReadError
            ? orderPlanAgendaRows(
                group.rows,
                placements,
                selection,
                group.id === "uncategorized" ? null : group.id
              )
            : group.rows,
      }))
    : []
  const busy =
    deleting ||
    progress.busy ||
    occurrenceProgress.busy ||
    ordering.busy ||
    category.busy ||
    groupOrdering.busy
  const canOrderRows = Boolean(
    data &&
      placements &&
      !placementReadError &&
      !appearances.nextCursor &&
      (selection.kind === "day" || selection.kind === "overdue")
  )
  const tagIds = data?.tags.map((tag) => tag.id) ?? []
  const visibleTagIds = groups
    .filter((group) => tagIds.includes(group.id))
    .map((group) => group.id)
  async function remove(plan: Plan, operationId: string) {
    setDeleting(true)
    try {
      await deleteLocalPlan(account, plan, operationId)
      void mutate()
      void refresh()
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }
  return (
    <section
      ref={section}
      aria-label={
        selection.kind === "day"
          ? "Planes del día"
          : selection.kind === "overdue"
            ? "Atrasadas"
            : selection.kind === "upcoming"
              ? "Hoy y próximas"
              : "Planes guardados"
      }
      className="mt-4 space-y-2 sm:mt-6"
    >
      <h2 className="text-base font-semibold first-letter:uppercase sm:text-xl">
        {heading}
      </h2>
      {progress.error || occurrenceProgress.error ? (
        <ErrorBanner>
          No se pudo cambiar el progreso. Vuelve a intentarlo; si el plan cambió
          en otra pestaña, comprueba su contenido actualizado.
        </ErrorBanner>
      ) : null}
      {placementReadError ||
      ordering.error ||
      category.error ||
      groupOrdering.error ? (
        <ErrorBanner>
          No se pudo leer o guardar el orden o la categoría. Vuelve a
          intentarlo; tus planes se conservan.
        </ErrorBanner>
      ) : null}
      {busy ? (
        <p role="status" className="text-xs">
          Guardando…
        </p>
      ) : null}
      {pendingCancel?.occurrence ? (
        <CancelPlanOccurrenceDialog
          plan={pendingCancel.plan}
          busy={deleting}
          onClose={() => setPendingCancel(null)}
          onConfirm={async (operationId) => {
            if (!pendingCancel.occurrence) return
            setDeleting(true)
            try {
              await changeLocalPlanOccurrence(
                account,
                {
                  type: "plan.cancel-occurrence",
                  itemId: pendingCancel.series.id,
                  occurrenceId: pendingCancel.occurrence.id,
                },
                {
                  operationId,
                  expectedItem: pendingCancel.series,
                  expectedOccurrence: pendingCancel.occurrence,
                }
              )
              await mutate()
              setPendingCancel(null)
            } finally {
              setDeleting(false)
            }
          }}
        />
      ) : null}
      {pendingDelete ? (
        <DeletePlanDialog
          plan={pendingDelete}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={(operationId) => remove(pendingDelete, operationId)}
        />
      ) : null}
      {editing ? (
        <PlanComposer
          key={editing.plan.id}
          account={account}
          initialPlan={editing.plan}
          initialView={editing.view}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refresh()
          }}
        />
      ) : null}
      {error ? (
        <ErrorBanner>
          No se pudieron leer los planes locales. Vuelve a abrir este espacio;
          tus cambios se conservan.
        </ErrorBanner>
      ) : isLoading ? (
        <p role="status">Cargando planes…</p>
      ) : rows.length ? (
        <div data-order-list className="space-y-3">
          {groups.map((group) => (
            <TaskGroup
              key={group.id}
              title={group.title}
              color={group.color}
              orderId={group.id}
              orderControl={
                visibleTagIds.length > 1 && visibleTagIds.includes(group.id) ? (
                  <LongPressOrder
                    itemId={group.id}
                    label={`grupo ${group.title}`}
                    peers={tagIds}
                    busy={busy}
                    onDrop={(neighbors) => {
                      void groupOrdering.change({
                        type: "tag.move",
                        tagId: group.id,
                        ...neighbors,
                      })
                    }}
                  />
                ) : undefined
              }
            >
              {group.rows.map((row) => (
                <li
                  key={row.key}
                  data-order-item={row.key}
                  data-order-label={row.plan.title}
                >
                  <PlanCard
                    plan={row.plan}
                    categoryColor={group.color}
                    busy={busy}
                    expanded={expandedIds.has(row.key)}
                    onExpandedChange={(expanded) =>
                      setExpandedIds((current) => {
                        if (current.has(row.key) === expanded) return current
                        const next = new Set(current)
                        if (expanded) next.add(row.key)
                        else next.delete(row.key)
                        return next
                      })
                    }
                    onEdit={() =>
                      setEditing({
                        plan: row.series,
                        view:
                          data?.views.find(
                            (view) => view.itemId === row.series.id
                          ) ?? null,
                      })
                    }
                    editLabel={
                      row.occurrence || row.series.recurrence
                        ? "Editar serie"
                        : "Editar"
                    }
                    deleteLabel={
                      row.occurrence
                        ? "Cancelar aparición"
                        : row.series.recurrence
                          ? "Eliminar serie"
                          : "Eliminar"
                    }
                    contextLabel={
                      row.occurrence
                        ? "El progreso afecta sólo a esta aparición; la categoría y la edición afectan a la serie."
                        : undefined
                    }
                    onDelete={() =>
                      row.occurrence
                        ? setPendingCancel(row)
                        : setPendingDelete(row.series)
                    }
                    onStatusChange={
                      row.plan.recurrence
                        ? undefined
                        : (status) => {
                            if (row.occurrence)
                              void occurrenceProgress.change({
                                command: {
                                  type: "plan.set-occurrence-status",
                                  itemId: row.series.id,
                                  occurrenceId: row.occurrence.id,
                                  status,
                                },
                                expectedItem: row.series,
                                expectedOccurrence: row.occurrence,
                              })
                            else
                              void progress.change({
                                type: "plan.set-status",
                                itemId: row.series.id,
                                status,
                              })
                          }
                    }
                    onChecklistChange={
                      row.plan.recurrence
                        ? undefined
                        : (entryId, completed) => {
                            if (row.occurrence)
                              void occurrenceProgress.change({
                                command: {
                                  type: "plan.set-occurrence-checklist-entry",
                                  itemId: row.series.id,
                                  occurrenceId: row.occurrence.id,
                                  entryId,
                                  completed,
                                },
                                expectedItem: row.series,
                                expectedOccurrence: row.occurrence,
                              })
                            else
                              void progress.change({
                                type: "plan.set-checklist-entry",
                                itemId: row.series.id,
                                entryId,
                                completed,
                              })
                          }
                    }
                    categoryControl={
                      data ? (
                        <ItemCategorySelect
                          title={row.plan.title}
                          itemId={row.series.id}
                          tags={data.tags}
                          selectedId={
                            group.id === "uncategorized" ? null : group.id
                          }
                          busy={busy}
                          onChange={(tagId) => {
                            const currentTagId =
                              group.id === "uncategorized" ? null : group.id
                            if (tagId === currentTagId) return
                            categoryFocus.current = row.series.id
                            void category.change({
                              itemId: row.series.id,
                              tagId,
                            })
                          }}
                        />
                      ) : undefined
                    }
                    orderControl={
                      canOrderRows &&
                      !row.series.recurrence &&
                      group.rows.every((record) => !record.occurrence) ? (
                        <LongPressOrder
                          itemId={row.series.id}
                          label={`plan ${row.plan.title}`}
                          peers={planOrderPeers(
                            group.rows.map((record) => record.series),
                            selection,
                            row.series
                          ).map((record) => record.id)}
                          busy={busy}
                          onDrop={(neighbors) => {
                            void ordering.change({
                              type: "task.move",
                              itemId: row.series.id,
                              occurrenceId: null,
                              tagId:
                                group.id === "uncategorized" ? null : group.id,
                              ...planOrderContext(selection, row.series),
                              ...neighbors,
                            })
                          }}
                        />
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </TaskGroup>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {selection.kind === "day"
            ? "No hay planes para este día. Pulsa + para añadir uno."
            : selection.kind === "overdue"
              ? "No tienes planes atrasados."
              : selection.kind === "upcoming"
                ? "No hay planes para hoy o próximas fechas. Pulsa + para añadir uno."
                : "Pulsa + para añadir tu primer plan."}
        </p>
      )}

      {appearances.issues.length ? (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          Hay apariciones con una hora no válida por el cambio de horario.
          Revisa la fecha y la zona de la serie.
        </p>
      ) : null}
      {appearances.canLoadMore ? (
        <button
          type="button"
          disabled={busy}
          onClick={appearances.loadMore}
          className="min-h-11 rounded-lg border px-3 text-sm"
        >
          Cargar más apariciones
        </button>
      ) : null}
      {appearances.limited ? (
        <p role="status" className="text-xs text-zinc-500">
          Quedan apariciones fuera de esta página. Abre un día concreto en el
          calendario para limitar el intervalo.
        </p>
      ) : null}
      {selection.kind === "upcoming" &&
      data?.plans.some((plan) => plan.recurrence) ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span>Repeticiones hasta {horizonEnd}</span>
          {horizonEnd < "9999-12-31" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setHorizonDays((days) => days + 30)}
              className="min-h-11 rounded-lg border px-3 text-sm"
            >
              Ampliar 30 días
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
