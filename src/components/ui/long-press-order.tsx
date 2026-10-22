"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { OrderDragPreview } from "@/components/ui/order-drag-preview"
import {
  groupDropNeighbors,
  type OrderDropGroup,
} from "@/lib/ordering/group-drop"
import { longPressDelay, longPressPhase } from "@/lib/ordering/long-press"
import {
  adjacentMoveNeighbors,
  dropMoveNeighbors,
} from "@/lib/ordering/move-neighbors"
import type { RankNeighbors } from "@/lib/ordering/rank"

type Gesture = {
  input: "pointer" | "touch"
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
  date?: string
  groupId?: string
  neighbors?: RankNeighbors
  height?: number
}

export function LongPressOrder({
  itemId,
  label,
  peers,
  busy,
  onDrop,
  dropScope,
  version,
  onDateDrop,
  groupDrop,
}: {
  itemId: string
  label: string
  peers: readonly string[]
  busy: boolean
  onDrop: (neighbors: RankNeighbors) => void
  dropScope?: string
  version?: string
  onDateDrop?: (date: string) => void
  groupDrop?: {
    scope: string
    sourceId: string
    targets: readonly OrderDropGroup[]
    note?: string
    onDrop: (groupId: string, neighbors: RankNeighbors) => void
  }
}) {
  const anchor = useRef<HTMLSpanElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const cancelGesture = useRef<() => void>(() => undefined)
  const [dragging, setDragging] = useState(false)
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [target, setTarget] = useState<DropTarget | null>(null)
  const fingerprint = JSON.stringify({
    peers,
    dropScope,
    version,
    groups: groupDrop
      ? {
          scope: groupDrop.scope,
          sourceId: groupDrop.sourceId,
          targets: groupDrop.targets,
          note: groupDrop.note,
        }
      : null,
  })
  const canChangeGroup = groupDrop?.targets.some(
    (group) => group.id !== groupDrop.sourceId
  )
  const unavailable =
    busy || (peers.length < 2 && !onDateDrop && !canChangeGroup)
  const canStart = useEffectEvent(() => !unavailable && peers.includes(itemId))
  const drop = useEffectEvent((neighbors: RankNeighbors) => {
    if (!unavailable) onDrop(neighbors)
  })
  const locate = useEffectEvent(
    (root: HTMLElement, point: Gesture): DropTarget | null => {
      if (point.fingerprint !== fingerprint || unavailable) return null
      if (
        groupDrop &&
        Math.hypot(point.x - point.startX, point.y - point.startY) <= 12
      )
        return null
      if (onDateDrop && dropScope) {
        const cell = document
          .elementFromPoint(point.x, point.y)
          ?.closest<HTMLElement>("[data-order-drop-date]")
        if (
          cell?.closest<HTMLElement>("[data-order-drop-scope]")?.dataset
            .orderDropScope === dropScope
        ) {
          const date = cell.dataset.orderDropDate
          if (date) {
            const rect = cell.getBoundingClientRect()
            return {
              id: date,
              date,
              label: cell.getAttribute("aria-label") ?? date,
              side: "before",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }
          }
        }
      }
      if (groupDrop) {
        const element = document.elementFromPoint(point.x, point.y)
        const section = element?.closest<HTMLElement>("[data-order-category]")
        const groupId = section?.dataset.orderCategory
        if (
          section?.closest<HTMLElement>("[data-order-category-scope]")?.dataset
            .orderCategoryScope === groupDrop.scope &&
          groupId &&
          groupId !== groupDrop.sourceId
        ) {
          const group = groupDrop.targets.find(
            (target) => target.id === groupId
          )
          if (!group) return null
          const row = element?.closest<HTMLElement>("li[data-order-item]")
          const rect = (row ?? section).getBoundingClientRect()
          const side =
            row && point.y < rect.top + rect.height / 2 ? "before" : "after"
          const neighbors = groupDropNeighbors(
            group,
            groupDrop.sourceId,
            itemId,
            row?.dataset.orderItem ?? null,
            side
          )
          if (!neighbors) return null
          return {
            id: row?.dataset.orderItem ?? groupId,
            groupId,
            neighbors,
            label: row
              ? `${row.dataset.orderLabel ?? "plan"} (${group.label})`
              : group.label,
            side,
            top: side === "before" ? rect.top : rect.bottom,
            left: rect.left,
            width: rect.width,
          }
        }
      }
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
  const finish = useEffectEvent((destination: DropTarget | null) => {
    if (destination?.date) {
      if (!unavailable) onDateDrop?.(destination.date)
      return
    }
    if (destination?.groupId && destination.neighbors) {
      if (!unavailable)
        groupDrop?.onDrop(destination.groupId, destination.neighbors)
      return
    }
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
    const hadOrderClass = root.classList.contains("dalis-orderable")
    root.classList.add("dalis-orderable")
    root.tabIndex = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let clickTimer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let suppressClick = false
    const isOwnTarget = (event: Event) =>
      event.target instanceof Element &&
      event.target.closest("[data-order-item]") === root
    const isInteractiveTarget = (event: Event) =>
      event.target instanceof Element &&
      Boolean(
        event.target.closest("button,input,select,textarea,a,[contenteditable]")
      )
    function cancel() {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      const current = gesture.current
      gesture.current = null
      if (current?.active) {
        root?.classList.remove("ring-2", "ring-emerald-500", "select-none")
        root?.removeAttribute("data-order-dragging")
        clickTimer = setTimeout(() => {
          suppressClick = false
        }, 500)
      }
      if (
        current?.input === "pointer" &&
        root?.hasPointerCapture(current.pointerId)
      )
        root.releasePointerCapture(current.pointerId)
      setDragging(false)
      setPoint(null)
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
      const moved =
        Math.hypot(current.x - current.startX, current.y - current.startY) > 12
      const delta = moved
        ? current.y < 72
          ? -12
          : current.y > bottom - 72
            ? 12
            : 0
        : 0
      if (delta) window.scrollBy({ top: delta, behavior: "instant" })
      const previewX = Math.max(80, Math.min(window.innerWidth - 80, current.x))
      const previewY = Math.max(72, current.y)
      setPoint((previous) =>
        previous?.x === previewX && previous.y === previewY
          ? previous
          : { x: previewX, y: previewY }
      )
      const next = locate(root, current)
      setTarget((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      )
      frame = requestAnimationFrame(animate)
    }
    function start(
      input: "pointer" | "touch",
      id: number,
      x: number,
      y: number
    ) {
      clearTimeout(clickTimer)
      suppressClick = false
      gesture.current = {
        input,
        pointerId: id,
        startX: x,
        startY: y,
        x,
        y,
        active: false,
        fingerprint,
      }
      timer = setTimeout(() => {
        const current = gesture.current
        if (
          !root ||
          !current ||
          !canStart() ||
          current.fingerprint !== fingerprint ||
          longPressPhase(
            longPressDelay,
            Math.hypot(current.x - current.startX, current.y - current.startY)
          ) !== "active"
        )
          return
        current.active = true
        if (current.input === "pointer")
          root.setPointerCapture(current.pointerId)
        root.focus({ preventScroll: true })
        const selection = window.getSelection()
        if (selection?.anchorNode && root.contains(selection.anchorNode))
          selection.removeAllRanges()
        root.classList.add("ring-2", "ring-emerald-500", "select-none")
        root.dataset.orderDragging = "true"
        suppressClick = true
        setDragging(true)
        frame = requestAnimationFrame(animate)
      }, longPressDelay)
    }
    function update(x: number, y: number) {
      const current = gesture.current
      if (!current) return
      current.x = x
      current.y = y
      if (
        !current.active &&
        longPressPhase(
          0,
          Math.hypot(x - current.startX, y - current.startY)
        ) === "cancelled"
      )
        cancel()
    }
    function end(x: number, y: number) {
      const current = gesture.current
      if (!root || !current) return
      current.x = x
      current.y = y
      const destination = current.active ? locate(root, current) : null
      cancel()
      finish(destination)
    }
    function down(event: PointerEvent) {
      if (event.pointerType === "touch") return
      if (
        !root ||
        !canStart() ||
        !isOwnTarget(event) ||
        !event.isPrimary ||
        event.button !== 0 ||
        gesture.current
      )
        return
      if (isInteractiveTarget(event)) return
      start("pointer", event.pointerId, event.clientX, event.clientY)
    }
    function move(event: PointerEvent) {
      const current = gesture.current
      if (current?.input !== "pointer" || current.pointerId !== event.pointerId)
        return
      update(event.clientX, event.clientY)
    }
    function up(event: PointerEvent) {
      const current = gesture.current
      if (current?.input !== "pointer" || current.pointerId !== event.pointerId)
        return
      end(event.clientX, event.clientY)
    }
    function cancelPointer(event: PointerEvent) {
      if (
        gesture.current?.input === "pointer" &&
        gesture.current.pointerId === event.pointerId
      )
        cancel()
    }
    function touchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        cancel()
        return
      }
      if (
        !canStart() ||
        !isOwnTarget(event) ||
        isInteractiveTarget(event) ||
        gesture.current
      )
        return
      const touch = event.changedTouches[0]
      if (touch) start("touch", touch.identifier, touch.clientX, touch.clientY)
    }
    function touchMove(event: TouchEvent) {
      const current = gesture.current
      if (current?.input !== "touch") return
      if (event.touches.length !== 1) {
        cancel()
        return
      }
      const touch = [...event.changedTouches].find(
        (value) => value.identifier === current.pointerId
      )
      if (!touch) return
      if (current.active) {
        if (!event.cancelable) {
          cancel()
          return
        }
        event.preventDefault()
      }
      update(touch.clientX, touch.clientY)
    }
    function touchEnd(event: TouchEvent) {
      const current = gesture.current
      if (current?.input !== "touch") return
      const touch = [...event.changedTouches].find(
        (value) => value.identifier === current.pointerId
      )
      if (touch) end(touch.clientX, touch.clientY)
    }

    function click(event: MouseEvent) {
      if (suppressClick && isOwnTarget(event)) {
        event.preventDefault()
        event.stopPropagation()
        suppressClick = false
      }
    }
    function context(event: MouseEvent) {
      if (gesture.current && isOwnTarget(event) && !isInteractiveTarget(event))
        event.preventDefault()
    }
    function select(event: Event) {
      if (isOwnTarget(event) && !isInteractiveTarget(event))
        event.preventDefault()
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
    root.addEventListener("pointercancel", cancelPointer)
    root.addEventListener("lostpointercapture", cancelPointer)
    root.addEventListener("click", click, true)
    root.addEventListener("touchstart", touchStart, { passive: true })
    root.addEventListener("touchmove", touchMove, { passive: false })
    root.addEventListener("touchend", touchEnd)
    root.addEventListener("touchcancel", cancel)
    root.addEventListener("contextmenu", context)
    root.addEventListener("selectstart", select)
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
      root.removeEventListener("pointercancel", cancelPointer)
      root.removeEventListener("lostpointercapture", cancelPointer)
      root.removeEventListener("click", click, true)
      root.removeEventListener("touchstart", touchStart)
      root.removeEventListener("touchmove", touchMove)
      root.removeEventListener("touchend", touchEnd)
      root.removeEventListener("touchcancel", cancel)
      root.removeEventListener("contextmenu", context)
      root.removeEventListener("selectstart", select)
      root.removeEventListener("keydown", key)
      window.removeEventListener("blur", cancel)
      window.removeEventListener("pagehide", cancel)
      document.removeEventListener("visibilitychange", visibility)
      if (previousTabIndex === null) root.removeAttribute("tabindex")
      else root.setAttribute("tabindex", previousTabIndex)
      if (!hadOrderClass) root.classList.remove("dalis-orderable")
    }
  }, [fingerprint])
  useEffect(() => {
    if (unavailable) cancelGesture.current()
  }, [unavailable])
  return (
    <>
      <span ref={anchor} className="sr-only">
        Mantén pulsado para ordenar {label}
        {onDateDrop ? " o moverlo a un día del calendario" : ""}
        {groupDrop ? " o cambiarlo de categoría" : ""}. Con teclado, usa Alt y
        flechas arriba o abajo.
      </span>
      <span role="status" className="sr-only">
        {dragging
          ? target
            ? target.date
              ? `Mover a ${target.label}. Escape cancela.`
              : `Soltar ${target.side === "before" ? "antes" : "después"} de ${target.label}. ${target.groupId ? (groupDrop?.note ?? "") : ""} Escape cancela.`
            : "Arrastrando. Busca un destino. Escape cancela."
          : ""}
      </span>
      {dragging && point ? (
        <OrderDragPreview
          label={label}
          x={point.x}
          y={point.y}
          destination={
            target?.date
              ? `Mover al ${target.date}`
              : target
                ? `Soltar ${target.side === "before" ? "antes" : "después"} de ${target.label}${target.groupId && groupDrop?.note ? `. ${groupDrop.note}` : ""}`
                : undefined
          }
        />
      ) : null}
      {dragging && target ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed z-50 rounded ${target.date ? "border-2 border-emerald-500 bg-emerald-500/20" : "h-1 bg-emerald-600"}`}
          style={{
            top: target.date ? target.top : target.top - 2,
            height: target.height,
            left: target.left,
            width: target.width,
          }}
        />
      ) : null}
    </>
  )
}
