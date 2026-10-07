"use client"

import type { SyncPassResult } from "@/features/sync/coordinator"
import type { LocalSyncRuntime } from "@/features/sync/local-runtime"

const stoppedResult: SyncPassResult = {
  status: "stopped",
  uploaded: 0,
  downloaded: 0,
}
export class SyncAttempt {
  private stopped = false
  private runtime: LocalSyncRuntime | null = null
  private closing: Promise<void> | null = null
  private running: Promise<SyncPassResult> | null = null
  constructor(
    private readonly open: () => Promise<LocalSyncRuntime>,
    private readonly refresh: () => Promise<unknown>
  ) {}
  run(): Promise<SyncPassResult> {
    this.running ??= this.execute()
    return this.running
  }
  stop() {
    this.stopped = true
    void this.closeRuntime()?.catch(() => undefined)
  }
  private closeRuntime(): Promise<void> | null {
    if (this.runtime) this.closing ??= this.runtime.close()
    return this.closing
  }
  private async execute(): Promise<SyncPassResult> {
    try {
      if (this.stopped) return stoppedResult
      this.runtime = await this.open()
      if (this.stopped) return stoppedResult
      const result = await this.runtime.run()
      if (this.stopped) return stoppedResult
      await this.refresh()
      return this.stopped ? stoppedResult : result
    } catch (error) {
      if (this.stopped) return stoppedResult
      throw error
    } finally {
      await this.closeRuntime()
    }
  }
}

export function isAccountSyncCacheKey(
  key: unknown,
  userId: string,
  epoch: string
): boolean {
  return (
    Array.isArray(key) &&
    typeof key[0] === "string" &&
    key[0].startsWith("dalis:") &&
    key[1] === userId &&
    key[2] === epoch
  )
}
