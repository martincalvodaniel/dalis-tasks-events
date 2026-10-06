"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { readAccountControl } from "@/lib/local-db/account-control"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { taskDraftSchema } from "@/schemas/calendar-item"
import type { CalendarItemDraft, Task } from "@/types/calendar-item"

export type TaskDraft = Extract<CalendarItemDraft, { kind: "task" }>

async function requireActiveAccount(account: LocalAccount) {
  const current = await readAccountControl()
  if (
    current.userId !== account.userId ||
    current.epoch !== account.epoch ||
    current.logoutPending
  )
    throw new Error("Local account changed during the operation")
}

export async function readLocalTasks(account: LocalAccount) {
  await requireActiveAccount(account)
  const repository = await LocalRepository.open(account.userId)
  try {
    const [items, settings] = await Promise.all([
      repository.list("items"),
      repository.get("settings", account.userId),
    ])
    if (!settings || settings.deletedAt)
      throw new Error("Local settings are unavailable")
    await requireActiveAccount(account)
    return {
      tasks: items
        .filter((item): item is Task => item.kind === "task")
        .sort(
          (a, b) =>
            a.scheduledDate.localeCompare(b.scheduledDate) ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id)
        ),
      timeZone: settings.timeZone,
    }
  } finally {
    repository.close()
  }
}

export async function createLocalTask(
  account: LocalAccount,
  input: TaskDraft,
  itemId: string,
  operationId: string
) {
  const draft = taskDraftSchema.parse(input)
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitItemCommand(
      { type: "item.create", itemId, input: draft },
      { operationId }
    )
  } finally {
    outbox.close()
  }
}
