"use client"

import { useEffect, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { LongPressOrder } from "@/components/ui/long-press-order"
import {
  groupAgendaPlans,
  type PlanAgendaSelection,
  selectAgendaPlans,
} from "@/features/plans/agenda-selection"
import { DeletePlanDialog } from "@/features/plans/components/delete-plan-dialog"
import { PlanCard } from "@/features/plans/components/plan-card"
import { PlanComposer } from "@/features/plans/components/plan-composer"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import { usePlanOrder } from "@/features/plans/hooks/use-plan-order"
import { usePlanProgress } from "@/features/plans/hooks/use-plan-progress"
import { deleteLocalPlan } from "@/features/plans/local-plans"
import {
  orderAgendaGroupPlans,
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
  const plans = data ? selectAgendaPlans(data.plans, selection) : []
  const groups = data
    ? groupAgendaPlans(plans, data.tags, data.views).map((group) => ({
        ...group,
        plans:
          placements && !placementReadError
            ? orderAgendaGroupPlans(
                group.plans,
                placements,
                selection,
                group.id === "uncategorized" ? null : group.id
              )
            : group.plans,
      }))
    : []
  const busy =
    deleting ||
    progress.busy ||
    ordering.busy ||
    category.busy ||
    groupOrdering.busy
  const canOrderRows = Boolean(
    data &&
      placements &&
      !placementReadError &&
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
      {progress.error ? (
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
      ) : plans.length ? (
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
              {group.plans.map((plan) => (
                <li
                  key={plan.id}
                  data-order-item={plan.id}
                  data-order-label={plan.title}
                >
                  <PlanCard
                    plan={plan}
                    categoryColor={group.color}
                    busy={busy}
                    expanded={expandedIds.has(plan.id)}
                    onExpandedChange={(expanded) =>
                      setExpandedIds((current) => {
                        if (current.has(plan.id) === expanded) return current
                        const next = new Set(current)
                        if (expanded) next.add(plan.id)
                        else next.delete(plan.id)
                        return next
                      })
                    }
                    onEdit={() =>
                      setEditing({
                        plan,
                        view:
                          data?.views.find((view) => view.itemId === plan.id) ??
                          null,
                      })
                    }
                    onDelete={() => setPendingDelete(plan)}
                    onStatusChange={
                      plan.recurrence
                        ? undefined
                        : (status) => {
                            void progress.change({
                              type: "plan.set-status",
                              itemId: plan.id,
                              status,
                            })
                          }
                    }
                    onChecklistChange={
                      plan.recurrence
                        ? undefined
                        : (entryId, completed) => {
                            void progress.change({
                              type: "plan.set-checklist-entry",
                              itemId: plan.id,
                              entryId,
                              completed,
                            })
                          }
                    }
                    categoryControl={
                      data ? (
                        <ItemCategorySelect
                          title={plan.title}
                          itemId={plan.id}
                          tags={data.tags}
                          selectedId={
                            group.id === "uncategorized" ? null : group.id
                          }
                          busy={busy}
                          onChange={(tagId) => {
                            const currentTagId =
                              group.id === "uncategorized" ? null : group.id
                            if (tagId === currentTagId) return
                            categoryFocus.current = plan.id
                            void category.change({ itemId: plan.id, tagId })
                          }}
                        />
                      ) : undefined
                    }
                    orderControl={
                      canOrderRows && !plan.recurrence ? (
                        <LongPressOrder
                          itemId={plan.id}
                          label={`plan ${plan.title}`}
                          peers={planOrderPeers(
                            group.plans,
                            selection,
                            plan
                          ).map((record) => record.id)}
                          busy={busy}
                          onDrop={(neighbors) => {
                            void ordering.change({
                              type: "task.move",
                              itemId: plan.id,
                              occurrenceId: null,
                              tagId:
                                group.id === "uncategorized" ? null : group.id,
                              ...planOrderContext(selection, plan),
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
    </section>
  )
}
