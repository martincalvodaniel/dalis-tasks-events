"use client"

import { type ReactNode, useId } from "react"

export function TaskGroup({
  title,
  children,
  orderControl,
  orderId,
}: {
  title: string
  children: ReactNode
  orderControl?: ReactNode
  orderId?: string
}) {
  const headingId = useId()
  return (
    <section
      data-order-item={orderId}
      data-order-label={title}
      aria-labelledby={headingId}
      className="space-y-3"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h3 id={headingId} className="wrap-anywhere text-lg font-semibold">
          {title}
        </h3>
        {orderControl}
      </div>
      <ul data-order-list className="space-y-4">
        {children}
      </ul>
    </section>
  )
}
