"use client"

import { type ReactNode, useId } from "react"

export function TaskGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h3 id={headingId} className="text-lg font-semibold">
        {title}
      </h3>
      <ul className="space-y-4">{children}</ul>
    </section>
  )
}
