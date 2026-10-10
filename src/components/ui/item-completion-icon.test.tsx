import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  ItemCompletionIcon,
  type ItemCompletionVariant,
} from "@/components/ui/item-completion-icon"
import { TaskCard } from "@/features/tasks/components/task-card"
import type { Task } from "@/types/calendar-item"

const variants: ItemCompletionVariant[] = [
  "task",
  "event",
  "appointment",
  "note",
]

test("each variant retains its category color and adds a completion mark", () => {
  const shapes = new Set<string>()
  for (const variant of variants) {
    const open = renderToStaticMarkup(
      <ItemCompletionIcon variant={variant} completed={false} color="#c2410c" />
    )
    const completed = renderToStaticMarkup(
      <ItemCompletionIcon variant={variant} completed color="#c2410c" />
    )
    expect(open).toContain('stroke="#c2410c"')
    expect(completed).toContain('stroke="#c2410c"')
    expect(completed).toContain('fill="#c2410c"')
    expect(completed).toContain(
      variant === "appointment" ? 'd="m7 15 3 3 7-6"' : 'd="m7 12 3 3 7-7"'
    )
    expect(open).not.toContain('fill="#c2410c"')
    expect(open).toContain('aria-hidden="true"')
    shapes.add(open)
  }
  expect(shapes.size).toBe(4)
})

test("uncategorized icons inherit their neutral parent color", () => {
  const html = renderToStaticMarkup(
    <ItemCompletionIcon variant="task" completed={false} />
  )
  expect(html).toContain('stroke="currentColor"')
})

test("task rows pass category color to their accessible completion control", () => {
  const task: Task = {
    id: "00000000-0000-4000-8000-000000000001",
    ownerId: "test-owner",
    kind: "task",
    title: "Comprar pan",
    description: "",
    scheduledDate: "2026-10-10",
    status: "completed",
    checklist: [],
    recurrence: null,
    completedAt: "2026-10-10T08:00:00.000Z",
    createdAt: "2026-10-10T08:00:00.000Z",
    updatedAt: "2026-10-10T08:00:00.000Z",
    revision: 1,
    deletedAt: null,
  }
  const html = renderToStaticMarkup(
    <TaskCard
      task={task}
      categoryColor="#2563eb"
      onStatusChange={() => undefined}
    />
  )
  const control = html.match(
    /<button[^>]*aria-label="Reabrir Comprar pan"[^>]*>[\s\S]*?<\/button>/
  )?.[0]
  expect(control).toContain('stroke="#2563eb"')
  expect(control).toContain('fill="#2563eb"')
  expect(control).toContain("size-11")
  expect(control).toContain('aria-pressed="true"')
  for (const status of ["not_started", "in_progress"] as const) {
    const open = renderToStaticMarkup(
      <TaskCard
        task={{ ...task, status, completedAt: null }}
        categoryColor="#2563eb"
        onStatusChange={() => undefined}
      />
    )
    expect(open).toContain('aria-pressed="false"')
    expect(open).toContain('aria-label="Completar Comprar pan"')
    expect(open).toContain('stroke="#2563eb"')
  }
})
