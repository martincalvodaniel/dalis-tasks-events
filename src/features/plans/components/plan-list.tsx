"use client"

import { useId, useMemo, useState } from "react"
import { DelayedStatus } from "@/components/ui/delayed-status"
import { ErrorBanner } from "@/components/ui/error-banner"
import { LongPressOrder } from "@/components/ui/long-press-order"
import type { PlanAgendaSelection } from "@/features/plans/agenda-selection"
import { CancelPlanOccurrenceDialog } from "@/features/plans/components/cancel-plan-occurrence-dialog"
import { DeletePlanDialog } from "@/features/plans/components/delete-plan-dialog"
import { PlanCard } from "@/features/plans/components/plan-card"
import { PlanComposer } from "@/features/plans/components/plan-composer"
import { PlanListHeading } from "@/features/plans/components/plan-list-heading"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { usePlanAppearances } from "@/features/plans/hooks/use-plan-appearances"
import { usePlanOccurrenceProgress } from "@/features/plans/hooks/use-plan-occurrence-progress"
import { usePlanOrder } from "@/features/plans/hooks/use-plan-order"
import { usePlanProgress } from "@/features/plans/hooks/use-plan-progress"
import { usePlanReschedule } from "@/features/plans/hooks/use-plan-reschedule"
import {
  changeLocalPlanOccurrence,
  deleteLocalPlan,
} from "@/features/plans/local-plans"
import {
  chronologicalPlanAgendaRows,
  createPlanAgendaRows,
  groupPlanAgendaRows,
  orderPlanAgendaRows,
  type PlanAgendaRow,
  planAppearanceRange,
} from "@/features/plans/plan-agenda-rows"
import {
  planRowCategoryDropGroups,
  planRowMoveCommand,
  planRowOrderPeers,
} from "@/features/plans/plan-order-selection"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { changeLocalTagOrder } from "@/features/tags/local-tags"
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
  calendarDropScope,
  collapsible = false,
  groupByCategory = true,
}: {
  account: LocalAccount
  selection?: PlanAgendaSelection
  calendarDropScope?: string
  heading?: string
  groupByCategory?: boolean
  collapsible?: boolean
}) {
  const contentId = useId()
  const categoryDropScope = useId()
  const [collapsed, setCollapsed] = useState(false)
  const { data, error, isLoading, mutate } = useLocalPlans(account)
  const { refresh } = useLocalAccount()
  const { mutate: refreshTags } = useLocalTags(account)
  const progress = usePlanProgress(account)
  const occurrenceProgress = usePlanOccurrenceProgress(account)
  const ordering = usePlanOrder(account)
  const rescheduling = usePlanReschedule(account)
  const { data: placements, error: placementReadError } =
    useLocalTaskPlacements(account)
  const groupOrdering = useLocalIntent<
    Extract<LocalPreferenceCommand, { type: "tag.move" }>
  >(
    (command, operationId) =>
      changeLocalTagOrder(account, command, operationId),
    () => Promise.all([mutate(), refreshTags()])
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
  const allowCategoryDrop = Boolean(
    groupByCategory &&
      selection.kind === "day" &&
      data &&
      placements &&
      !placementReadError &&
      !appearances.nextCursor
  )
  const groups = data
    ? groupPlanAgendaRows(rows, data.tags, data.views, allowCategoryDrop).map(
        (group) => ({
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
        })
      )
    : []
  const categoryByRow = new Map(
    groups.flatMap((group) =>
      group.rows.map((row) => [row.key, group] as const)
    )
  )
  const displayGroups = groupByCategory
    ? groups
    : [
        {
          id: "chronological",
          title: heading,
          color: null,
          rows: chronologicalPlanAgendaRows(groups),
        },
      ]
  const busy =
    deleting ||
    progress.busy ||
    occurrenceProgress.busy ||
    ordering.busy ||
    rescheduling.busy ||
    groupOrdering.busy
  const canOrderRows = Boolean(
    data && placements && !placementReadError && !appearances.nextCursor
  )
  const tagIds = data?.tags.map((tag) => tag.id) ?? []
  const visibleTagIds = groups
    .filter((group) => group.rows.length && tagIds.includes(group.id))
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
      aria-label={
        selection.kind === "day"
          ? "Planes del día"
          : selection.kind === "overdue"
            ? "Atrasadas"
            : selection.kind === "upcoming"
              ? selection.excludeDate
                ? "Próximas"
                : "Hoy y próximas"
              : "Planes guardados"
      }
      className="mt-4 space-y-2 sm:mt-6"
    >
      <PlanListHeading
        heading={heading}
        contentId={contentId}
        expanded={!collapsed}
        count={data ? rows.length : null}
        partial={
          Boolean(appearances.nextCursor) ||
          (selection.kind === "upcoming" &&
            horizonEnd < "9999-12-31" &&
            Boolean(
              data?.plans.some((plan) => plan.recurrence && !plan.deletedAt)
            ))
        }
        onToggle={
          collapsible ? () => setCollapsed((current) => !current) : undefined
        }
      />
      <div
        id={contentId}
        hidden={collapsible && collapsed}
        className="space-y-2"
      >
        {rescheduling.error ? (
          <ErrorBanner>
            No se pudo mover el plan. Puede haber cambiado o la hora no existir
            ese día por el cambio de horario; revisa su fecha en el editor.
          </ErrorBanner>
        ) : null}
        {progress.error || occurrenceProgress.error ? (
          <ErrorBanner>
            No se pudo cambiar el progreso. Vuelve a intentarlo; si el plan
            cambió en otra pestaña, comprueba su contenido actualizado.
          </ErrorBanner>
        ) : null}
        {placementReadError || ordering.error || groupOrdering.error ? (
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
          <DelayedStatus>Cargando planes…</DelayedStatus>
        ) : rows.length ? (
          <div
            data-order-list
            data-order-category-scope={
              allowCategoryDrop ? categoryDropScope : undefined
            }
            className="group/plan-order space-y-3"
          >
            {displayGroups.map((displayGroup) => (
              <TaskGroup
                key={displayGroup.id}
                title={displayGroup.title}
                color={displayGroup.color}
                headingVisible={groupByCategory}
                categoryDropId={allowCategoryDrop ? displayGroup.id : undefined}
                orderId={displayGroup.id}
                orderControl={
                  groupByCategory &&
                  displayGroup.rows.length > 0 &&
                  visibleTagIds.length > 1 &&
                  visibleTagIds.includes(displayGroup.id) ? (
                    <LongPressOrder
                      itemId={displayGroup.id}
                      label={`grupo ${displayGroup.title}`}
                      peers={tagIds}
                      busy={busy}
                      onDrop={(neighbors) => {
                        void groupOrdering.change({
                          type: "tag.move",
                          tagId: displayGroup.id,
                          ...neighbors,
                        })
                      }}
                    />
                  ) : undefined
                }
              >
                {displayGroup.rows.map((row) => {
                  const group = categoryByRow.get(row.key)
                  if (!group) return null
                  const peers = canOrderRows
                    ? planRowOrderPeers(group.rows, selection, row).map(
                        (peer) => peer.key
                      )
                    : []
                  return (
                    <li
                      key={row.key}
                      data-order-item={row.key}
                      data-order-label={row.plan.title}
                    >
                      <PlanCard
                        plan={row.plan}
                        categoryColor={group.color}
                        busy={busy}
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
                        orderControl={
                          (calendarDropScope && !row.plan.recurrence) ||
                          peers.length > 1 ||
                          allowCategoryDrop ? (
                            <LongPressOrder
                              itemId={row.key}
                              dropScope={calendarDropScope}
                              version={
                                calendarDropScope || allowCategoryDrop
                                  ? JSON.stringify(row)
                                  : undefined
                              }
                              onDateDrop={
                                calendarDropScope
                                  ? (date) => {
                                      void rescheduling.change({ row, date })
                                    }
                                  : undefined
                              }
                              groupDrop={
                                allowCategoryDrop && placements
                                  ? {
                                      scope: categoryDropScope,
                                      sourceId: group.id,
                                      targets: planRowCategoryDropGroups(
                                        groups,
                                        selection,
                                        row,
                                        placements
                                      ),
                                      note: row.occurrence
                                        ? "La categoría cambia para toda la serie."
                                        : undefined,
                                      onDrop: (groupId, neighbors) => {
                                        void ordering.change(
                                          planRowMoveCommand(
                                            selection,
                                            row,
                                            groupId === "uncategorized"
                                              ? null
                                              : groupId,
                                            neighbors
                                          )
                                        )
                                      },
                                    }
                                  : undefined
                              }
                              label={`plan ${row.plan.title}`}
                              peers={peers.length > 1 ? peers : [row.key]}
                              busy={busy}
                              onDrop={(neighbors) => {
                                void ordering.change(
                                  planRowMoveCommand(
                                    selection,
                                    row,
                                    group.id === "uncategorized"
                                      ? null
                                      : group.id,
                                    neighbors
                                  )
                                )
                              }}
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  )
                })}
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
                  ? selection.excludeDate
                    ? "No hay planes para próximas fechas. Pulsa + para añadir uno."
                    : "No hay planes para hoy o próximas fechas. Pulsa + para añadir uno."
                  : "Pulsa + para añadir tu primer plan."}
          </p>
        )}

        {appearances.issues.length ? (
          <p
            role="status"
            className="text-xs text-amber-700 dark:text-amber-300"
          >
            Hay apariciones con una hora no válida por el cambio de horario.
            Revisa la fecha y la zona de la serie.
          </p>
        ) : null}
        {appearances.canLoadMore ? (
          <button
            type="button"
            disabled={busy}
            onClick={appearances.loadMore}
            aria-label={`Cargar más apariciones de ${heading}`}
            className="min-h-8 rounded px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            Ver más
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
                className="min-h-8 rounded px-2 text-xs hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-zinc-800"
              >
                Ampliar 30 días
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
