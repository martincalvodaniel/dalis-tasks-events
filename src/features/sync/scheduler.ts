"use client"

import type { SyncPassResult } from "@/features/sync/coordinator"

interface SchedulerPorts {
  run(): Promise<SyncPassResult>
  cancel(): void
  onResult(result: SyncPassResult): void
  isAvailable(): boolean
  now(): number
  schedule(callback: () => void, delayMs: number): () => void
}
const stoppedResult: SyncPassResult = {
  status: "stopped",
  uploaded: 0,
  downloaded: 0,
}

export class SyncScheduler {
  private started = false
  private stopped = false
  private paused = false
  private dueAt = 0
  private failures = 0
  private dirty = false
  private cancelTimer: (() => void) | null = null
  private running: Promise<SyncPassResult> | null = null
  constructor(private readonly ports: SchedulerPorts) {}
  start() {
    if (this.started || this.stopped) return
    this.started = true
    this.wake()
  }
  wake() {
    if (
      !this.started ||
      this.stopped ||
      this.paused ||
      this.running ||
      !this.ports.isAvailable()
    )
      return
    this.cancelTimer?.()
    this.cancelTimer = this.ports.schedule(
      () => {
        this.cancelTimer = null
        if (this.ports.isAvailable()) void this.execute()
      },
      Math.max(0, this.dueAt - this.ports.now())
    )
  }
  request(): Promise<SyncPassResult> {
    if (this.running) return this.running
    if (this.stopped) return Promise.resolve(stoppedResult)
    this.paused = false
    this.failures = 0
    return this.execute()
  }
  changed() {
    this.dirty = true
    if (this.failures === 0 && !this.paused && !this.running) {
      this.dueAt = Math.min(this.dueAt, this.ports.now() + 1000)
      this.wake()
    }
  }
  stop() {
    if (this.stopped) return
    this.stopped = true
    this.cancelTimer?.()
    this.cancelTimer = null
    this.ports.cancel()
  }
  private execute(): Promise<SyncPassResult> {
    if (this.running) return this.running
    this.cancelTimer?.()
    this.cancelTimer = null
    this.dirty = false
    const work = this.pass().finally(() => {
      if (this.running === work) this.running = null
      this.wake()
    })
    this.running = work
    return work
  }
  private async pass(): Promise<SyncPassResult> {
    let result: SyncPassResult
    try {
      result = await this.ports.run()
    } catch {
      result = { status: "retry_later", uploaded: 0, downloaded: 0 }
    }
    if (this.stopped) return stoppedResult
    switch (result.status) {
      case "settled":
        this.failures = 0
        this.dueAt = this.ports.now() + (this.dirty ? 1000 : 60000)
        break
      case "more_work":
        this.failures = 0
        this.dueAt = this.ports.now() + 2000
        break
      case "retry_later":
        this.failures = Math.min(5, this.failures + 1)
        this.dueAt =
          this.ports.now() + Math.min(300000, 30000 * 2 ** (this.failures - 1))
        break
      default:
        this.paused = true
    }
    this.ports.onResult(result)
    return result
  }
}
