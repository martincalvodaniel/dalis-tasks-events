export function assertBackupOwnership(value: unknown, userId: string): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const entry of value) assertBackupOwnership(entry, userId)
    return
  }
  for (const [key, entry] of Object.entries(value)) {
    // Lease owner IDs identify senders, not data accounts.
    if (key === "lease") continue
    if (
      (key === "userId" || key === "ownerId" || key === "recipientUserId") &&
      entry !== userId
    )
      throw new Error("Backup record belongs to another account")
    assertBackupOwnership(entry, userId)
  }
}
