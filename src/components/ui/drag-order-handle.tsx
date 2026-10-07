"use client"

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { DragIcon } from "@/components/ui/drag-icon"
import { dropMoveNeighbors } from "@/lib/ordering/move-neighbors"
import type { RankNeighbors } from "@/lib/ordering/rank"

type DropTarget = {
  id: string
  label: string
  side: "before" | "after"
  top: number
  left: number
  width: number
}
type Gesture = {
  fingerprint: string
  pointerId: number
  x: number
  y: number
  startX: number
  startY: number
  active: boolean
}

export function DragOrderHandle({
  itemId,
  label,
  peers,
  busy,
  onDrop,
}: {
  itemId: string
  label: string
  peers: readonly string[]
  busy: boolean
  onDrop: (neighbors: RankNeighbors) => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const pendingFocus = useRef(false)
  const [dragging, setDragging] = useState(false)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const fingerprint = JSON.stringify(peers)
  const unavailable = busy || peers.length < 2
  const cancel = useCallback(() => {
    const current = gesture.current
    gesture.current = null
    if (current && button.current?.hasPointerCapture(current.pointerId))
      button.current.releasePointerCapture(current.pointerId)
    setDragging(false)
    setTarget(null)
  }, [])

  function findTarget(point: Gesture): DropTarget | null {
    const list = button.current?.closest<HTMLElement>("[data-order-list]")
    if (!list) return null
    const bounds = list.getBoundingClientRect()
    if (
      point.x < bounds.left ||
      point.x > bounds.right ||
      point.y < bounds.top ||
      point.y > bounds.bottom
    )
      return null
    const rows = [
      ...list.querySelectorAll<HTMLElement>(":scope > [data-order-item]"),
    ].filter((row) => peers.includes(row.dataset.orderItem ?? ""))
    const row =
      rows.find((record) => point.y <= record.getBoundingClientRect().bottom) ??
      rows.at(-1)
    const id = row?.dataset.orderItem
    if (!row || !id) return null
    const rect = row.getBoundingClientRect()
    const side = point.y < rect.top + rect.height / 2 ? "before" : "after"
    if (!dropMoveNeighbors(peers, itemId, id, side)) return null
    return {
      id,
      label: row.dataset.orderLabel ?? "elemento",
      side,
      top: side === "before" ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
    }
  }

  const tick = useEffectEvent(() => {
    const current = gesture.current
    if (!current?.active) return
    const fixedBar = [...document.querySelectorAll<HTMLElement>("nav")].find(
      (nav) =>
        getComputedStyle(nav).position === "fixed" &&
        nav.getBoundingClientRect().height > 0
    )
    const bottom = fixedBar?.getBoundingClientRect().top ?? window.innerHeight
    const delta = current.y < 72 ? -12 : current.y > bottom - 72 ? 12 : 0
    if (delta) window.scrollBy({ top: delta, behavior: "instant" })
    const next = findTarget(current)
    setTarget((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next
    )
  })
  useEffect(() => {
    if (!dragging) return
    let frame = 0
    function animate() {
      tick()
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        cancel()
      }
    }
    const visibility = () => {
      if (document.hidden) cancel()
    }
    window.addEventListener("keydown", cancelWithEscape)
    window.addEventListener("blur", cancel)
    window.addEventListener("pagehide", cancel)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("keydown", cancelWithEscape)
      window.removeEventListener("blur", cancel)
      window.removeEventListener("pagehide", cancel)
      document.removeEventListener("visibilitychange", visibility)
    }
  }, [dragging, cancel])
  useEffect(() => {
    if (
      busy ||
      (gesture.current && gesture.current.fingerprint !== fingerprint)
    )
      cancel()
  }, [fingerprint, busy, cancel])
  useEffect(() => {
    if (!busy && pendingFocus.current) {
      button.current?.focus({ preventScroll: true })
      pendingFocus.current = false
    }
  }, [busy])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`Arrastrar ${label}`}
        aria-disabled={unavailable}
        title="Arrastra para cambiar el orden. También puedes usar Subir y Bajar."
        className={`inline-flex min-h-12 touch-none select-none items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-700 ${unavailable ? "cursor-not-allowed opacity-50" : dragging ? "cursor-grabbing bg-emerald-100 dark:bg-emerald-950" : "cursor-grab hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
        onPointerDown={(event) => {
          if (
            unavailable ||
            !event.isPrimary ||
            event.button !== 0 ||
            gesture.current
          )
            return
          event.currentTarget.focus({ preventScroll: true })
          event.currentTarget.setPointerCapture(event.pointerId)
          gesture.current = {
            fingerprint,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            active: false,
          }
        }}
        onPointerMove={(event) => {
          const current = gesture.current
          if (!current || current.pointerId !== event.pointerId) return
          current.x = event.clientX
          current.y = event.clientY
          if (
            !current.active &&
            Math.hypot(
              current.x - current.startX,
              current.y - current.startY
            ) >= 6
          ) {
            current.active = true
            setDragging(true)
          }
          if (current.active) setTarget(findTarget(current))
        }}
        onPointerUp={(event) => {
          const current = gesture.current
          if (!current || current.pointerId !== event.pointerId) return
          current.x = event.clientX
          current.y = event.clientY
          const destination = current.active ? findTarget(current) : null
          const neighbors = destination
            ? dropMoveNeighbors(peers, itemId, destination.id, destination.side)
            : null
          cancel()
          if (neighbors && !unavailable) {
            pendingFocus.current = true
            onDrop(neighbors)
          }
        }}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      >
        <DragIcon />
        Arrastrar
      </button>
      <span role="status" className="sr-only">
        {dragging
          ? target
            ? `Soltar ${target.side === "before" ? "antes" : "después"} de ${target.label}. Escape cancela.`
            : "Arrastrando. Busca un destino en esta lista. Escape cancela."
          : ""}
      </span>
      {dragging && target ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 h-1 rounded bg-emerald-600"
          style={{
            top: target.top - 2,
            left: target.left,
            width: target.width,
          }}
        />
      ) : null}
    </>
  )
}
