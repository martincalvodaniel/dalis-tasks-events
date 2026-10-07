"use client"

import { syncWakeMessageSchema } from "@/schemas/sync-queue"

const eventName = "dalis:outbox-changed"
const channelName = "dalis-sync-intents"
export function notifyLocalOutboxChange(userId: string): void {
  const message = { type: "OUTBOX_CHANGED", userId }
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: message }))
  } catch {
    /* Notifications cannot invalidate a committed outbox operation. */
  }
  try {
    const channel = new BroadcastChannel(channelName)
    try {
      channel.postMessage(message)
    } finally {
      channel.close()
    }
  } catch {
    /* The local event and periodic passes cover unavailable channels. */
  }
}

export function subscribeLocalOutboxChanges(
  userId: string,
  onChange: () => void
): () => void {
  const receive = (input: unknown) => {
    const message = syncWakeMessageSchema.safeParse(input)
    if (message.success && message.data.userId === userId) onChange()
  }
  const local = (event: Event) => {
    if (event instanceof CustomEvent) receive(event.detail)
  }
  window.addEventListener(eventName, local)
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(channelName)
    channel.onmessage = (event) => receive(event.data)
  } catch {
    /* Local notifications and periodic passes remain available. */
  }
  return () => {
    window.removeEventListener(eventName, local)
    channel?.close()
  }
}
