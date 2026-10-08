export class SyncTransportError extends Error {
  constructor(
    readonly reason:
      | "unauthorized"
      | "account_changed"
      | "update_required"
      | "recovery_required"
      | "retry_later"
  ) {
    super(`Sync transport failed: ${reason}`)
  }
}
