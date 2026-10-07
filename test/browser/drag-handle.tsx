import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import type { RankNeighbors } from "@/lib/ordering/rank"
import { DragFixture } from "./drag-fixture"

let operations: RankNeighbors[] = []

export async function runTouchDragChecks(host: HTMLElement) {
  operations = []
  const root = createRoot(host)
  root.render(
    <StrictMode>
      <DragFixture onDrop={(neighbors) => operations.push(neighbors)} />
    </StrictMode>
  )
  const settle = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  await settle()
  const source = host.querySelector<HTMLButtonElement>(
    'button[aria-label="Arrastrar c"]'
  )
  const destination = host.querySelector<HTMLElement>('[data-order-item="a"]')
  if (!source || !destination) throw new Error("Drag fixture markup missing")
  const originalCapture = source.setPointerCapture
  source.setPointerCapture = () => undefined
  const origin = source.getBoundingClientRect()
  const target = destination.getBoundingClientRect()
  const point = { x: origin.left + 10, y: origin.top + 10 }
  const dispatch = (type: string, x = point.x, y = point.y) =>
    source.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 42,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
        clientX: x,
        clientY: y,
      })
    )
  const start = () => {
    dispatch("pointerdown")
    dispatch("pointermove", target.left + 20, target.top + 5)
  }
  const unchanged = () => {
    if (operations.length)
      throw new Error("Canceled touch gesture wrote an operation")
  }
  try {
    dispatch("pointerdown")
    dispatch("pointerup")
    unchanged()
    dispatch("pointerdown")
    dispatch("pointermove", point.x + 2, point.y + 2)
    dispatch("pointerup", point.x + 2, point.y + 2)
    unchanged()
    start()
    await settle()
    dispatch("pointercancel")
    dispatch("pointerup", target.left + 20, target.top + 5)
    unchanged()
    start()
    await settle()
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    dispatch("pointerup", target.left + 20, target.top + 5)
    unchanged()
    start()
    await settle()
    window.dispatchEvent(new Event("blur"))
    dispatch("pointerup", target.left + 20, target.top + 5)
    unchanged()
    start()
    dispatch("pointerup", target.left - 100, target.top + 5)
    unchanged()
    start()
    const previousScroll = window.scrollY
    dispatch("pointermove", target.left + 20, window.innerHeight - 10)
    for (let frame = 0; frame < 4; frame++) await settle()
    if (window.scrollY <= previousScroll)
      throw new Error("Touch edge did not scroll the page")
    dispatch("pointercancel")
    window.scrollTo({ top: 0, behavior: "instant" })
    await settle()
    unchanged()
    start()
    await settle()
    dispatch("pointerup", target.left + 20, target.top + 5)
    dispatch("pointerup", target.left + 20, target.top + 5)
    await settle()
    if (
      operations.length !== 1 ||
      operations[0].beforeId !== "a" ||
      operations[0].afterId !== null ||
      [...host.querySelectorAll<HTMLElement>("[data-order-item]")]
        .map((row) => row.dataset.orderItem)
        .join() !== "c,a,b"
    )
      throw new Error("Touch drop did not commit exactly once")
    const status = document.getElementById("status")
    if (status)
      status.textContent =
        "Gesto táctil comprobado: clic, umbral, cancelación, Escape, foco, fuera de lista, scroll y una sola entrega al soltar."
  } finally {
    source.setPointerCapture = originalCapture
  }
}
