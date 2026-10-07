"use client"

import { useEffect, useRef } from "react"
import { OrderIcon } from "@/components/ui/order-icon"

export function OrderControls({
  label,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
}: {
  label: string
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onMove: (direction: "up" | "down") => void
}) {
  const upButton = useRef<HTMLButtonElement>(null)
  const downButton = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<"up" | "down" | null>(null)
  useEffect(() => {
    if (busy || pendingFocus.current === null) return
    const button = pendingFocus.current === "up" ? upButton : downButton
    button.current?.focus({ preventScroll: true })
    pendingFocus.current = null
  }, [busy])
  return (
    <fieldset
      aria-label={`Orden de ${label}`}
      className="flex min-w-0 flex-wrap gap-2"
    >
      {(["up", "down"] as const).map((direction) => {
        const unavailable =
          busy || !(direction === "up" ? canMoveUp : canMoveDown)
        const action = direction === "up" ? "Subir" : "Bajar"
        return (
          <button
            ref={direction === "up" ? upButton : downButton}
            key={direction}
            type="button"
            aria-label={`${action} ${label}`}
            aria-disabled={unavailable}
            onClick={() => {
              if (!unavailable) {
                pendingFocus.current = direction
                onMove(direction)
              }
            }}
            className={`inline-flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-zinc-700 ${unavailable ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          >
            <OrderIcon direction={direction} />
            {action}
          </button>
        )
      })}
    </fieldset>
  )
}
