"use client"

import { Children, type ReactNode, useId } from "react"

export function TaskGroup({
  title,
  children,
  orderControl,
  orderId,
  color,
  headingVisible = true,
  categoryDropId,
}: {
  title: string
  categoryDropId?: string
  headingVisible?: boolean
  children: ReactNode
  orderControl?: ReactNode
  color?: string | null
  orderId?: string
}) {
  const headingId = useId()
  const emptyDropTarget =
    categoryDropId !== undefined && Children.count(children) === 0
  if (!headingVisible)
    return (
      <ul data-order-list className="space-y-1.5">
        {children}
      </ul>
    )
  return (
    <section
      data-order-category={categoryDropId}
      data-order-item={orderId}
      data-order-label={title}
      aria-labelledby={headingId}
      className={
        emptyDropTarget
          ? "hidden space-y-1 group-has-[[data-order-dragging]]/plan-order:block"
          : "space-y-1"
      }
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
        <h3
          id={headingId}
          className="wrap-anywhere text-sm sm:text-base font-semibold"
        >
          {color ? (
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          ) : null}
          {title}
        </h3>
        {orderControl}
      </div>
      <ul data-order-list className="space-y-1.5">
        {children}
        {emptyDropTarget ? (
          <li className="min-h-11 rounded-lg border border-dashed border-zinc-400 p-2 text-xs text-zinc-500">
            Suelta aquí
          </li>
        ) : null}
      </ul>
    </section>
  )
}
