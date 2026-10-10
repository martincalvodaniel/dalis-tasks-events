"use client"

import { type ReactNode, useId } from "react"

export function TaskGroup({
  title,
  children,
  orderControl,
  orderId,
  color,
}: {
  title: string
  children: ReactNode
  orderControl?: ReactNode
  color?: string | null
  orderId?: string
}) {
  const headingId = useId()
  return (
    <section
      data-order-item={orderId}
      data-order-label={title}
      aria-labelledby={headingId}
      className="space-y-1"
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
      </ul>
    </section>
  )
}
