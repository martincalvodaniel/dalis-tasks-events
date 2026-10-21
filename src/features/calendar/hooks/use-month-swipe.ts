"use client"

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react"
import { useRef } from "react"
import {
  adjacentMonth,
  calendarHref,
  monthSwipeOffset,
} from "@/features/calendar/month-view"
import { navigateWorkspace } from "@/features/workspace/navigation"

export function useMonthSwipe(selectedDate: string) {
  const gesture = useRef<{
    id: number
    x: number
    y: number
    horizontal: boolean
  } | null>(null)
  const suppressClickUntil = useRef(0)

  function changeMonth(offset: -1 | 1) {
    const date = adjacentMonth(selectedDate, offset)
    if (date) navigateWorkspace(calendarHref(date))
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const start = gesture.current
    if (!start || start.id !== event.pointerId) return
    const dx = Math.abs(event.clientX - start.x)
    const dy = Math.abs(event.clientY - start.y)
    if (!start.horizontal && dy > 12 && dy >= dx) {
      gesture.current = null
      return
    }
    if (dx > 12 && dx > dy * 1.5) {
      start.horizontal = true
      suppressClickUntil.current = Date.now() + 500
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!event.isPrimary || event.button !== 0) {
        gesture.current = null
        return
      }
      if (
        (event.target as Element).closest(
          "button, input, textarea, select, [contenteditable], [data-calendar-control]"
        )
      )
        return
      gesture.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        horizontal: false,
      }
    },
    onPointerMove,
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const start = gesture.current
      gesture.current = null
      if (!start || start.id !== event.pointerId || !start.horizontal) return
      suppressClickUntil.current = Date.now() + 500
      const offset = monthSwipeOffset(
        event.clientX - start.x,
        event.clientY - start.y
      )
      if (offset) changeMonth(offset)
    },
    onPointerCancel() {
      gesture.current = null
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (Date.now() < suppressClickUntil.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (event.key !== "PageUp" && event.key !== "PageDown") return
      if (
        event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return
      event.preventDefault()
      event.currentTarget.focus({ preventScroll: true })
      changeMonth(event.key === "PageUp" ? -1 : 1)
    },
  }
}
