"use client"

import { useEffect, useRef, useState } from "react"
import { DragOrderHandle } from "@/components/ui/drag-order-handle"
import { ErrorBanner } from "@/components/ui/error-banner"
import { OrderControls } from "@/components/ui/order-controls"
import { ItemCategorySelect } from "@/features/tags/components/item-category-select"
import { useItemCategory } from "@/features/tags/hooks/use-item-category"
import { useLocalTags } from "@/features/tags/hooks/use-local-tags"
import { useTagOrder } from "@/features/tags/hooks/use-tag-order"
import {
  type AgendaSelection,
  groupAgendaTasks,
  selectAgendaTasks,
} from "@/features/tasks/agenda-selection"
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog"
import { TaskCard } from "@/features/tasks/components/task-card"
import { TaskComposer } from "@/features/tasks/components/task-composer"
import { TaskGroup } from "@/features/tasks/components/task-group"
import { useLocalTaskPlacements } from "@/features/tasks/hooks/use-local-task-placements"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import { useTaskOrder } from "@/features/tasks/hooks/use-task-order"
import { useTaskProgress } from "@/features/tasks/hooks/use-task-progress"
import { deleteLocalTask } from "@/features/tasks/local-tasks"
import {
  orderAgendaGroupTasks,
  taskOrderContext,
  taskOrderPeers,
} from "@/features/tasks/task-order-selection"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import type { LocalAccount } from "@/features/workspace/local-account"
import {
  adjacentMoveNeighbors,
  visibleMoveNeighbors,
} from "@/lib/ordering/move-neighbors"
import type { Task } from "@/types/calendar-item"

const allTasksSelection = { kind: "all" } as const

export function TaskList({
  account,
  selection = allTasksSelection,
  heading = "Tus tareas",
}: {
  account: LocalAccount
  selection?: AgendaSelection
  heading?: string
}) {
  const { data, error, isLoading, mutate } = useLocalTasks(account)
  const { refresh } = useLocalAccount()
  const progress = useTaskProgress(account)
  const { data: categories, error: categoryReadError } = useLocalTags(account)
  const ordering = useTaskOrder(account)
  const category = useItemCategory(account)
  const groupOrdering = useTagOrder(account)
  const { data: placements, error: placementReadError } =
    useLocalTaskPlacements(account)
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
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const tasks = data ? selectAgendaTasks(data.tasks, selection) : []
  const groups = groupAgendaTasks(
    tasks,
    categoryReadError ? undefined : categories
  ).map((group) => ({
    ...group,
    tasks:
      placements && !placementReadError
        ? orderAgendaGroupTasks(
            group.tasks,
            placements,
            selection,
            group.id === "uncategorized" ? null : group.id
          )
        : group.tasks,
  }))
  const visibleTagIds = groups
    .filter((group) => categories?.tags.some((tag) => tag.id === group.id))
    .map((group) => group.id)
  const busy =
    deleting ||
    progress.busy ||
    ordering.busy ||
    category.busy ||
    groupOrdering.busy
  const canOrder = Boolean(
    categories && !categoryReadError && placements && !placementReadError
  )
  async function remove(task: Task, operationId: string) {
    setDeleting(true)
    try {
      await deleteLocalTask(account, task, operationId)
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
          ? "Tareas del día"
          : selection.kind === "overdue"
            ? "Atrasadas"
            : selection.kind === "upcoming"
              ? "Hoy y próximas"
              : "Tareas guardadas"
      }
      className="mt-4 space-y-2 sm:mt-6"
    >
      <h2 className="text-base sm:text-xl font-semibold first-letter:uppercase">
        {heading}
      </h2>
      {progress.error ? (
        <ErrorBanner>
          No se pudo cambiar el progreso. Vuelve a intentarlo; si la tarea
          cambió en otra pestaña, comprueba su contenido actualizado.
        </ErrorBanner>
      ) : null}
      {progress.busy ? <p role="status">Guardando progreso…</p> : null}
      {categoryReadError ||
      ordering.error ||
      category.error ||
      placementReadError ||
      groupOrdering.error ? (
        <ErrorBanner>
          No se pudo leer o guardar el orden o la categoría. Vuelve a
          intentarlo; tus tareas se conservan.
        </ErrorBanner>
      ) : null}
      {ordering.busy || groupOrdering.busy ? (
        <p role="status">Guardando orden…</p>
      ) : null}
      {category.busy ? <p role="status">Guardando categoría…</p> : null}
      {pendingDelete ? (
        <DeleteTaskDialog
          task={pendingDelete}
          busy={deleting}
          onClose={() => setPendingDelete(null)}
          onConfirm={(operationId) => remove(pendingDelete, operationId)}
        />
      ) : null}
      {editing ? (
        <TaskComposer
          key={editing.id}
          account={account}
          initialTask={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void refresh()
          }}
        />
      ) : null}
      {error ? (
        <ErrorBanner>
          No se pudieron leer las tareas locales. Vuelve a abrir este espacio;
          tus cambios se conservan.
        </ErrorBanner>
      ) : isLoading ? (
        <p role="status">Cargando tareas…</p>
      ) : tasks?.length ? (
        <div data-order-list className="space-y-3 sm:space-y-4">
          {groups.map((group) => (
            <TaskGroup
              key={group.id}
              title={group.title}
              orderId={group.id}
              orderControl={
                canOrder &&
                visibleTagIds.length > 1 &&
                visibleTagIds.includes(group.id) ? (
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <DragOrderHandle
                      itemId={group.id}
                      label={`grupo ${group.title}`}
                      peers={categories?.tags.map((tag) => tag.id) ?? []}
                      busy={busy}
                      onDrop={(neighbors) => {
                        void groupOrdering.change({
                          type: "tag.move",
                          tagId: group.id,
                          ...neighbors,
                        })
                      }}
                    />
                    <OrderControls
                      label={`grupo ${group.title}`}
                      busy={busy}
                      canMoveUp={visibleTagIds.indexOf(group.id) > 0}
                      canMoveDown={
                        visibleTagIds.indexOf(group.id) <
                        visibleTagIds.length - 1
                      }
                      onMove={(direction) => {
                        const neighbors = visibleMoveNeighbors(
                          categories?.tags.map((tag) => tag.id) ?? [],
                          visibleTagIds,
                          group.id,
                          direction
                        )
                        if (neighbors)
                          void groupOrdering.change({
                            type: "tag.move",
                            tagId: group.id,
                            ...neighbors,
                          })
                      }}
                    />
                  </div>
                ) : undefined
              }
            >
              {group.tasks.map((task) => (
                <li
                  key={task.id}
                  data-order-item={task.id}
                  data-order-label={task.title}
                >
                  <TaskCard
                    task={task}
                    expanded={expandedIds.has(task.id)}
                    onExpandedChange={(expanded) => {
                      setExpandedIds((current) => {
                        if (current.has(task.id) === expanded) return current
                        const next = new Set(current)
                        if (expanded) next.add(task.id)
                        else next.delete(task.id)
                        return next
                      })
                    }}
                    onEdit={() => setEditing(task)}
                    onDelete={() => setPendingDelete(task)}
                    busy={busy}
                    categoryControl={
                      categories && !categoryReadError ? (
                        <ItemCategorySelect
                          title={task.title}
                          itemId={task.id}
                          tags={categories.tags}
                          selectedId={categories.views[task.id] ?? null}
                          busy={busy}
                          onChange={(tagId) => {
                            const currentTagId =
                              group.id === "uncategorized" ? null : group.id
                            if (tagId === currentTagId) return
                            categoryFocus.current = task.id
                            void category.change({
                              itemId: task.id,
                              tagId,
                            })
                          }}
                        />
                      ) : undefined
                    }
                    orderControl={
                      canOrder ? (
                        <>
                          <DragOrderHandle
                            itemId={task.id}
                            label={`tarea ${task.title}`}
                            peers={taskOrderPeers(
                              group.tasks,
                              selection,
                              task
                            ).map((record) => record.id)}
                            busy={busy}
                            onDrop={(neighbors) => {
                              void ordering.change({
                                type: "task.move",
                                itemId: task.id,
                                occurrenceId: null,
                                tagId:
                                  group.id === "uncategorized"
                                    ? null
                                    : group.id,
                                ...taskOrderContext(selection, task),
                                ...neighbors,
                              })
                            }}
                          />
                          <OrderControls
                            label={`tarea ${task.title}`}
                            busy={busy}
                            canMoveUp={
                              taskOrderPeers(
                                group.tasks,
                                selection,
                                task
                              ).findIndex((record) => record.id === task.id) > 0
                            }
                            canMoveDown={
                              taskOrderPeers(
                                group.tasks,
                                selection,
                                task
                              ).findIndex((record) => record.id === task.id) <
                              taskOrderPeers(group.tasks, selection, task)
                                .length -
                                1
                            }
                            onMove={(direction) => {
                              const peers = taskOrderPeers(
                                group.tasks,
                                selection,
                                task
                              )
                              const neighbors = adjacentMoveNeighbors(
                                peers.map((record) => record.id),
                                task.id,
                                direction
                              )
                              if (neighbors)
                                void ordering.change({
                                  type: "task.move",
                                  itemId: task.id,
                                  occurrenceId: null,
                                  tagId:
                                    group.id === "uncategorized"
                                      ? null
                                      : group.id,
                                  ...taskOrderContext(selection, task),
                                  ...neighbors,
                                })
                            }}
                          />
                        </>
                      ) : undefined
                    }
                    onStatusChange={
                      task.recurrence
                        ? undefined
                        : (status) => {
                            void progress.change({
                              type: "task.set-status",
                              itemId: task.id,
                              occurrenceId: null,
                              status,
                            })
                          }
                    }
                    onChecklistChange={
                      task.recurrence
                        ? undefined
                        : (entryId, completed) => {
                            void progress.change({
                              type: "task.set-checklist-entry",
                              itemId: task.id,
                              occurrenceId: null,
                              entryId,
                              completed,
                            })
                          }
                    }
                  />
                </li>
              ))}
            </TaskGroup>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          {selection.kind === "day"
            ? "No hay tareas para este día. Pulsa + para añadir una."
            : selection.kind === "overdue"
              ? "No tienes tareas atrasadas."
              : selection.kind === "upcoming"
                ? "No hay tareas para hoy o próximas fechas. Pulsa + para añadir una."
                : "Pulsa + para añadir tu primera tarea."}
        </p>
      )}
    </section>
  )
}
