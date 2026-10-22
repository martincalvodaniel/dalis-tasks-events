"use client"

import { useEffect, useRef } from "react"
import { type WorkspaceView, workspaceDestinations } from "@/config/navigation"

export function WorkspaceHeading({ view }: { view: WorkspaceView }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const previousView = useRef(view)
  const label = (
    workspaceDestinations.find((entry) => entry.id === view) ??
    workspaceDestinations[0]
  ).label
  useEffect(() => {
    document.title = `${label} · Dalis`
    if (previousView.current !== view) heading.current?.focus()
    previousView.current = view
  }, [view, label])
  return (
    <h1
      ref={heading}
      tabIndex={-1}
      className="sr-only font-semibold tracking-tight md:not-sr-only md:mt-3 md:mb-3 md:text-3xl"
    >
      {label}
    </h1>
  )
}
