import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { TagCard } from "@/features/tags/components/tag-card"
import { tagSchema } from "@/schemas/preferences"

const tag = tagSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  userId: "tag-card-test",
  name: "Trabajo",
  normalizedName: "trabajo",
  color: "#2563eb",
  position: 0,
  revision: 0,
  createdAt: "2026-10-23T10:00:00.000Z",
  updatedAt: "2026-10-23T10:00:00.000Z",
  deletedAt: null,
})

test("category actions are direct accessible SVG buttons and preserve color and order control", () => {
  const html = renderToStaticMarkup(
    <TagCard
      tag={tag}
      busy={false}
      onEdit={() => undefined}
      onDelete={() => undefined}
      orderControl={<span>Ordenar categoría</span>}
    />
  )
  expect(html).not.toContain("<details")
  expect(html).not.toContain("<summary")
  expect(html).toContain('aria-label="Editar categoría Trabajo"')
  expect(html).toContain('aria-label="Eliminar categoría Trabajo"')
  expect(html).toContain("text-red-600")
  expect(html).toContain("background-color:#2563eb")
  expect(html.match(/<svg/g)).toHaveLength(2)
  expect(html).toContain("Ordenar categoría")
  expect(html).not.toContain(">Editar</button>")
  expect(html).not.toContain(">Eliminar</button>")
})

test("busy categories disable both actions and long names retain a flexible heading", () => {
  const long = {
    ...tag,
    name: "Categoría con un nombre largo que necesita varias líneas",
  }
  const html = renderToStaticMarkup(
    <TagCard
      tag={long}
      busy
      onEdit={() => undefined}
      onDelete={() => undefined}
    />
  )
  expect(html.match(/disabled=""/g)).toHaveLength(2)
  expect(html).toContain(long.name)
  expect(html).toContain("min-w-0 flex-1")
  expect(html).toContain("shrink-0")
})
