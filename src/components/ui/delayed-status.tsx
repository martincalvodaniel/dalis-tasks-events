"use client"

import { type ReactNode, useEffect, useState } from "react"

export function DelayedStatus({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300)
    return () => window.clearTimeout(timer)
  }, [])
  return visible ? (
    <p role="status" className="mt-4 text-sm">
      {children}
    </p>
  ) : null
}
