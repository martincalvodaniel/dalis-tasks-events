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
      className="space-y-1"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
        <h3
          id={headingId}
          className="wrap-anywhere text-sm sm:text-base font-semibold"
        >
          {title}
        </h3>
        {orderControl ? (
          <details className="min-w-0 max-w-full">
            <summary
              aria-label={`Ordenar grupo ${title}`}
              className="flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              Ordenar
            </summary>
            <div className="pb-2">{orderControl}</div>
          </details>
        ) : null}
      </div>
      <ul data-order-list className="space-y-1.5">
        {children}
      </ul>
    </section>
  )
}
