import "server-only"
import type { RetiredSyncPushPorts } from "@/features/sync/retired-sync-push"
import { rejectRetiredSyncPushV4 } from "@/features/sync/retired-sync-push-v4"
// Retirement validates the unchanged envelope; it cannot reach readiness or any executor.
// Connect only when the complete settings generation is selected together.
export function rejectRetiredSyncPushV5(
  input: unknown,
  headers: Headers,
  ports?: RetiredSyncPushPorts
) {
  return rejectRetiredSyncPushV4(input, headers, ports)
}
