"use client"

import { useRef, useState } from "react"

export function useLocalIntent<Command>(
  execute: (command: Command, operationId: string) => Promise<unknown>,
  revalidate: () => Promise<unknown>
) {
  const lock = useRef(false)
  const intent = useRef<{ serialized: string; operationId: string } | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function change(command: Command) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(false)
    const serialized = JSON.stringify(command)
    const active =
      intent.current?.serialized === serialized
        ? intent.current
        : { serialized, operationId: crypto.randomUUID() }
    intent.current = active
    try {
      await execute(command, active.operationId)
      await revalidate()
      intent.current = null
    } catch {
      setError(true)
      void revalidate().catch(() => undefined)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, error, change }
}
