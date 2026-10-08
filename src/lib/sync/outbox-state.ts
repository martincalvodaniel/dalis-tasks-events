import type { OutboxEntry } from "@/types/local-sync"

export function isUnresolvedOutboxEntry(
  entry: Pick<OutboxEntry, "state">
): boolean {
  return entry.state !== "acknowledged" && entry.state !== "superseded"
}
