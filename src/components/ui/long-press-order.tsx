"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { longPressPhase } from "@/lib/ordering/long-press"
import {
  adjacentMoveNeighbors,
  dropMoveNeighbors,
} from "@/lib/ordering/move-neighbors"
import type { RankNeighbors } from "@/lib/ordering/rank"

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
  fingerprint: string
}
type DropTarget = {
  id: string
  label: string
  side: "before" | "after"
  top: number
  left: number
  width: number
}

export function LongPressOrder({
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
  const anchor = useRef<HTMLSpanElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const cancelGesture = useRef<() => void>(() => undefined)
  const [dragging, setDragging] = useState(false)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const fingerprint = JSON.stringify(peers)
  const unavailable = busy || peers.length < 2
  const canStart = useEffectEvent(() => !unavailable && peers.includes(itemId))
  const drop = useEffectEvent((neighbors: RankNeighbors) => {
    if (!unavailable) onDrop(neighbors)
  })
  const locate = useEffectEvent(
    (root: HTMLElement, point: Gesture): DropTarget | null => {
      if (point.fingerprint !== fingerprint || unavailable) return null
      const list = root.parentElement?.closest<HTMLElement>("[data-order-list]")
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
      ]
      const row =
        rows.find((entry) => point.y <= entry.getBoundingClientRect().bottom) ??
        rows.at(-1)
      const id = row?.dataset.orderItem
      if (!row || !id || !peers.includes(id)) return null
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
  )
  const finish = useEffectEvent((root: HTMLElement, point: Gesture) => {
    const destination = point.active ? locate(root, point) : null
    const neighbors = destination
      ? dropMoveNeighbors(peers, itemId, destination.id, destination.side)
      : null
    if (neighbors) drop(neighbors)
  })
  const keyMove = useEffectEvent((direction: "up" | "down") => {
    if (unavailable) return
    const neighbors = adjacentMoveNeighbors(peers, itemId, direction)
    if (neighbors) drop(neighbors)
  })

  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>("[data-order-item]")
    if (!root) return
    const previousTabIndex = root.getAttribute("tabindex")
    root.tabIndex = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let clickTimer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let suppressClick = false
    const isOwnTarget = (event: Event) =>
      event.target instanceof Element &&
      event.target.closest("[data-order-item]") === root
    function cancel() {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      const current = gesture.current
      gesture.current = null
      if (current?.active) {
        root?.classList.remove("ring-2", "ring-emerald-500", "select-none")
        clickTimer = setTimeout(() => {
          suppressClick = false
        }, 500)
      }
      if (current && root?.hasPointerCapture(current.pointerId))
        root.releasePointerCapture(current.pointerId)
      setDragging(false)
      setTarget(null)
    }
    cancelGesture.current = cancel
    function animate() {
      const current = gesture.current
      if (!current?.active || !root) return
      const fixedNav = [...document.querySelectorAll<HTMLElement>("nav")].find(
        (nav) =>
          getComputedStyle(nav).position === "fixed" &&
          nav.getBoundingClientRect().height > 0
      )
      const bottom = fixedNav?.getBoundingClientRect().top ?? window.innerHeight
      const delta = current.y < 72 ? -12 : current.y > bottom - 72 ? 12 : 0
      if (delta) window.scrollBy({ top: delta, behavior: "instant" })
      const next = locate(root, current)
      setTarget((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      )
      frame = requestAnimationFrame(animate)
    }
    function down(event: PointerEvent) {
      if (
        !root ||
        !canStart() ||
        !isOwnTarget(event) ||
        !event.isPrimary ||
        event.button !== 0 ||
        gesture.current
      )
        return
      if ((event.target as Element).closest("button,input,select,textarea,a"))
        return
      clearTimeout(clickTimer)
      suppressClick = false
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        active: false,
        fingerprint,
      }
      timer = setTimeout(() => {
        const current = gesture.current
        if (
          !current ||
          !canStart() ||
          current.fingerprint !== fingerprint ||
          longPressPhase(
            450,
            Math.hypot(current.x - current.startX, current.y - current.startY)
          ) !== "active"
        )
          return
        current.active = true
        root.setPointerCapture(current.pointerId)
        root.focus({ preventScroll: true })
        root.classList.add("ring-2", "ring-emerald-500", "select-none")
        suppressClick = true
        setDragging(true)
        frame = requestAnimationFrame(animate)
      }, 450)
    }
    function move(event: PointerEvent) {
      const current = gesture.current
      if (!current || current.pointerId !== event.pointerId) return
      current.x = event.clientX
      current.y = event.clientY
      if (
        !current.active &&
        longPressPhase(
          0,
          Math.hypot(current.x - current.startX, current.y - current.startY)
        ) === "cancelled"
      )
        cancel()
    }
    function up(event: PointerEvent) {
      const current = gesture.current
      if (!root || !current || current.pointerId !== event.pointerId) return
      current.x = event.clientX
      current.y = event.clientY
      cancel()
      finish(root, current)
    }
    function click(event: MouseEvent) {
      if (suppressClick && isOwnTarget(event)) {
        event.preventDefault()
        event.stopPropagation()
        suppressClick = false
      }
    }
    function touchMove(event: TouchEvent) {
      if (gesture.current?.active && event.cancelable) event.preventDefault()
    }
    function context(event: MouseEvent) {
      if (gesture.current?.active && isOwnTarget(event)) event.preventDefault()
    }
    function key(event: KeyboardEvent) {
      if (!root || event.target !== root) return
      if (event.key === "Escape") cancel()
      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault()
        keyMove(event.key === "ArrowUp" ? "up" : "down")
      }
    }
    const visibility = () => {
      if (document.hidden) cancel()
    }
    root.addEventListener("pointerdown", down)
    root.addEventListener("pointermove", move)
    root.addEventListener("pointerup", up)
    root.addEventListener("pointercancel", cancel)
    root.addEventListener("lostpointercapture", cancel)
    root.addEventListener("click", click, true)
    root.addEventListener("touchmove", touchMove, { passive: false })
    root.addEventListener("contextmenu", context)
    root.addEventListener("keydown", key)
    window.addEventListener("blur", cancel)
    window.addEventListener("pagehide", cancel)
    document.addEventListener("visibilitychange", visibility)
    return () => {
      cancel()
      clearTimeout(clickTimer)
      root.removeEventListener("pointerdown", down)
      root.removeEventListener("pointermove", move)
      root.removeEventListener("pointerup", up)
      root.removeEventListener("pointercancel", cancel)
      root.removeEventListener("lostpointercapture", cancel)
      root.removeEventListener("click", click, true)
      root.removeEventListener("touchmove", touchMove)
      root.removeEventListener("contextmenu", context)
      root.removeEventListener("keydown", key)
      window.removeEventListener("blur", cancel)
      window.removeEventListener("pagehide", cancel)
      document.removeEventListener("visibilitychange", visibility)
      if (previousTabIndex === null) root.removeAttribute("tabindex")
      else root.setAttribute("tabindex", previousTabIndex)
    }
  }, [fingerprint])
  useEffect(() => {
    if (unavailable) cancelGesture.current()
  }, [unavailable])
  return (
    <>
      <span ref={anchor} className="sr-only">
        Mantén pulsado para ordenar {label}. Con teclado, usa Alt y flechas
        arriba o abajo.
      </span>
      <span role="status" className="sr-only">
        {dragging
          ? target
            ? `Soltar ${target.side === "before" ? "antes" : "después"} de ${target.label}. Escape cancela.`
            : "Arrastrando. Busca un destino. Escape cancela."
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
