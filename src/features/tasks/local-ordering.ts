"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import type { LocalPreferenceCommand } from "@/types/local-sync"

export type TaskMoveCommand = Extract<
  LocalPreferenceCommand,
  { type: "task.move" }
>

export async function readLocalTaskPlacements(account: LocalAccount) {
  await requireActiveAccount(account)
  const repository = await LocalRepository.open(account.userId)
  try {
    const placements = await repository.list("taskPlacements")
    await requireActiveAccount(account)
    return placements
  } finally {
    repository.close()
  }
}

export async function changeLocalTaskOrder(
  account: LocalAccount,
  command: TaskMoveCommand,
  operationId: string
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitPreferenceCommand(command, { operationId })
  } finally {
    outbox.close()
  }
}
