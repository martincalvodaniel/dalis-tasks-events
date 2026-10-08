import { planRankMove } from "@/lib/ordering/rank"
import { itemViewSchema, tagSchema } from "@/schemas/preferences"
import type { CalendarItem } from "@/types/calendar-item"
import type { LocalPreferenceCommand } from "@/types/local-sync"
import type { ItemView, Tag } from "@/types/preferences"

export function applyTagCommand(
  tags: Tag[],
  command: Extract<LocalPreferenceCommand, { type: "tag.save" | "tag.delete" }>,
  userId: string,
  timestamp: string
): Tag {
  if (tags.some((tag) => tag.userId !== userId))
    throw new Error("Personal record belongs to another account")
  const current = tags.find((tag) => tag.id === command.tagId)
  if (current?.deletedAt)
    throw new Error("Deleted categories cannot be restored")
  if (command.type === "tag.delete") {
    if (!current) throw new Error("Category does not exist")
    return tagSchema.parse({
      ...current,
      deletedAt: timestamp,
      updatedAt: timestamp,
    })
  }
  const normalizedName = command.input.name.normalize("NFKC").toLowerCase()
  if (
    tags.some(
      (tag) =>
        !tag.deletedAt &&
        tag.id !== command.tagId &&
        tag.normalizedName === normalizedName
    )
  )
    throw new Error("An active category has the same name")
  return tagSchema.parse({
    ...command.input,
    id: command.tagId,
    userId,
    normalizedName,
    revision: current?.revision ?? 0,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
}

export function applyItemViewCommand(
  current: ItemView | null,
  item: CalendarItem | null,
  tag: Tag | null,
  command: Extract<LocalPreferenceCommand, { type: "item-view.set" }>,
  userId: string,
  timestamp: string
): ItemView {
  if (!item || item.deletedAt || item.id !== command.itemId)
    throw new Error("Active item does not exist")
  if (
    current &&
    (current.userId !== userId ||
      current.itemId !== command.itemId ||
      current.deletedAt)
  )
    throw new Error("Personal view is unavailable")
  if (
    command.primaryTagId &&
    (!tag ||
      tag.id !== command.primaryTagId ||
      tag.userId !== userId ||
      tag.deletedAt)
  )
    throw new Error("Active category does not exist in this account")
  return itemViewSchema.parse({
    userId,
    itemId: command.itemId,
    primaryTagId: command.primaryTagId,
    revision: current?.revision ?? 0,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
}

export function applyTagMoveCommand(
  tags: Tag[],
  command: Extract<LocalPreferenceCommand, { type: "tag.move" }>,
  userId: string,
  timestamp: string
): Tag[] {
  if (tags.some((tag) => tag.userId !== userId))
    throw new Error("Personal record belongs to another account")
  const positions = planRankMove(
    tags.filter((tag) => !tag.deletedAt),
    command.tagId,
    command
  )
  return tags
    .filter((tag) => positions.has(tag.id))
    .map((tag) =>
      tagSchema.parse({
        ...tag,
        position: positions.get(tag.id),
        updatedAt: timestamp,
      })
    )
}
