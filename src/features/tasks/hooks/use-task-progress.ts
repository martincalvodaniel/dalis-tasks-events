"use client"

import { useRef, useState } from "react"
import { useLocalTasks } from "@/features/tasks/hooks/use-local-tasks"
import {
  changeLocalTaskProgress,
  type TaskProgressCommand,
} from "@/features/tasks/local-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"

export function useTaskProgress(account: LocalAccount) {
  const { mutate } = useLocalTasks(account)
  const lock = useRef(false)
  const intent = useRef<{
    command: TaskProgressCommand
    operationId: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function change(command: TaskProgressCommand) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(false)
    if (JSON.stringify(intent.current?.command) !== JSON.stringify(command))
      intent.current = { command, operationId: crypto.randomUUID() }
    const activeIntent = intent.current ?? {
      command,
      operationId: crypto.randomUUID(),
    }
    intent.current = activeIntent
    try {
      await changeLocalTaskProgress(account, command, activeIntent.operationId)
      await mutate()
      intent.current = null
    } catch {
      setError(true)
      void mutate()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, error, change }
}
