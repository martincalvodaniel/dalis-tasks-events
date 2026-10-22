import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TaskGroup } from "@/features/tasks/components/task-group"

test("continuous lists omit category sections and controls without changing row colors", () => {
  const html = renderToStaticMarkup(
    <TaskGroup
      title="Atrasadas"
      headingVisible={false}
      orderControl={<button type="button">Ordenar categoría</button>}
    >
      <li>
        <span style={{ color: "#ff0000" }}>First</span>
      </li>
      <li>
        <span style={{ color: "#0000ff" }}>Second</span>
      </li>
    </TaskGroup>
  )
  expect(html).toContain("<ul")
  expect(html).toContain("data-order-list")
  expect(html).not.toContain("<section")
  expect(html).not.toContain("<h3")
  expect(html).not.toContain("Ordenar categoría")
  expect(html).toContain("color:#ff0000")
  expect(html).toContain("color:#0000ff")
})

test("today and calendar retain category headings and group controls by default", () => {
  const html = renderToStaticMarkup(
    <TaskGroup
      title="Trabajo"
      color="#ff0000"
      orderControl={<button type="button">Ordenar categoría</button>}
    >
      <li>Plan</li>
    </TaskGroup>
  )
  expect(html).toContain("<section")
  expect(html).toContain("<h3")
  expect(html).toContain("Trabajo")
  expect(html).toContain("Ordenar categoría")
  expect(html).toContain("background-color:#ff0000")
})

test("empty category destinations appear only during a plan drag and retain their drop identity", () => {
  const html = renderToStaticMarkup(
    <TaskGroup title="Vacía" categoryDropId="empty">
      {[]}
    </TaskGroup>
  )
  expect(html).toContain('data-order-category="empty"')
  expect(html).toContain("hidden space-y-1")
  expect(html).toContain("group-has-[[data-order-dragging]]/plan-order:block")
  expect(html).toContain("Suelta aquí")
})
