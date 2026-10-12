import { useState } from "react"
import { createRoot } from "react-dom/client"
import { TagForm } from "@/features/tags/components/tag-form"
import type { TagDraft } from "@/features/tags/local-tags"
import type { Tag } from "@/types/preferences"

if (location.hostname !== "127.0.0.1" || location.port !== "4267")
  throw new Error("Tag color proof requires its isolated loopback origin")
const query = new URLSearchParams(location.search)
const initialTag: Tag = {
  id: "00000000-0000-4000-8000-000000000001",
  userId: "owned-color-fixture",
  name: "Categoría de prueba",
  normalizedName: "categoría de prueba",
  color: "#2563eb",
  position: 0,
  revision: 0,
  createdAt: "2026-10-12T12:00:00.000Z",
  updatedAt: "2026-10-12T12:00:00.000Z",
  deletedAt: null,
}
export function TagColorFixture() {
  const [saved, setSaved] = useState<TagDraft | null>(null)
  function changeColor() {
    const input = document.querySelector<HTMLInputElement>(
      'input[type="color"]'
    )
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set
    if (!input || !setter || input.disabled)
      throw new Error("Color fixture input unavailable")
    setter.call(input, "#e85d04")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  }
  return (
    <main className="mx-auto max-w-sm">
      <TagForm
        initialTag={query.has("edit") ? initialTag : undefined}
        newPosition={0}
        disabled={query.has("disabled")}
        onCancel={() => setSaved(null)}
        onSave={async (_id, draft) => {
          setSaved(draft)
        }}
      />
      <button
        type="button"
        disabled={query.has("disabled")}
        onClick={changeColor}
        className="mt-4 min-h-11 rounded border px-3"
      >
        Probar otro color
      </button>
      <pre role="status" className="mt-3 whitespace-pre-wrap text-xs">
        {saved ? JSON.stringify(saved) : "Prueba aislada sin base de datos."}
      </pre>
    </main>
  )
}
const root = document.getElementById("root")
if (!root) throw new Error("Color fixture root is missing")
createRoot(root).render(<TagColorFixture />)
