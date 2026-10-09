"use client"

import type { SyncPassResult } from "@/features/sync/coordinator"
import type { SyncPassResultV2 } from "@/features/sync/coordinator-v2"
import type { LocalSyncRuntimeV2 } from "@/features/sync/local-runtime-v2"
import { SyncAttempt } from "@/features/sync/manual-sync"
import { SyncScheduler } from "@/features/sync/scheduler"

export interface SyncSchedulerPortsV2 {
  run(): Promise<SyncPassResultV2>
  cancel(): void
  onResult(result: SyncPassResultV2): void
  isAvailable(): boolean
  now(): number
  schedule(callback: () => void, delayMs: number): () => void
}

class MixedResultAdapter {
  private readonly results = new WeakMap<SyncPassResult, SyncPassResultV2>()
  private readonly promises = new WeakMap<
    Promise<SyncPassResult>,
    Promise<SyncPassResultV2>
  >()

  retain(result: SyncPassResultV2): SyncPassResult {
    const value: SyncPassResultV2 = {
      status: result.status,
      uploaded: result.uploaded,
      downloaded: result.downloaded,
      diagnostics:
        result.status === "stopped" || result.status === "account_changed"
          ? null
          : result.diagnostics,
    }
    this.results.set(value, value)
    return value
  }

  normalize(result: SyncPassResult): SyncPassResultV2 {
    const retained = this.results.get(result)
    if (retained) return retained
    const value: SyncPassResultV2 = { ...result, diagnostics: null }
    this.results.set(result, value)
    return value
  }

  map(source: Promise<SyncPassResult>): Promise<SyncPassResultV2> {
    const existing = this.promises.get(source)
    if (existing) return existing
    const value = source.then((result) => this.normalize(result))
    this.promises.set(source, value)
    return value
  }
}

// Adapters retain mixed diagnostics while reusing the bounded controls.
export class SyncAttemptV2 {
  private readonly results = new MixedResultAdapter()
  private readonly attempt: SyncAttempt

  constructor(
    open: () => Promise<LocalSyncRuntimeV2>,
    refresh: () => Promise<unknown>
  ) {
    this.attempt = new SyncAttempt(async () => {
      const runtime = await open()
      return {
        run: async () => this.results.retain(await runtime.run()),
        close: () => runtime.close(),
      }
    }, refresh)
  }

  run(): Promise<SyncPassResultV2> {
    return this.results.map(this.attempt.run())
  }

  stop(): void {
    this.attempt.stop()
  }
}

export class SyncSchedulerV2 {
  private readonly results = new MixedResultAdapter()
  private readonly scheduler: SyncScheduler

  constructor(ports: SyncSchedulerPortsV2) {
    this.scheduler = new SyncScheduler({
      run: async () => this.results.retain(await ports.run()),
      cancel: () => ports.cancel(),
      onResult: (result) => ports.onResult(this.results.normalize(result)),
      isAvailable: () => ports.isAvailable(),
      now: () => ports.now(),
      schedule: (callback, delayMs) => ports.schedule(callback, delayMs),
    })
  }

  start(): void {
    this.scheduler.start()
  }
  wake(): void {
    this.scheduler.wake()
  }
  changed(): void {
    this.scheduler.changed()
  }
  stop(): void {
    this.scheduler.stop()
  }

  request(): Promise<SyncPassResultV2> {
    return this.results.map(this.scheduler.request())
  }
}
