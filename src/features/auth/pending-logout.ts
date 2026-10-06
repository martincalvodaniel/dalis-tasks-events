"use client"

import { authClient } from "@/lib/auth/auth-client"
import {
  completeRemoteLogout,
  readAccountControl,
} from "@/lib/local-db/account-control"

export async function completePendingRemoteLogout() {
  const control = await readAccountControl()
  if (!control.logoutPending) return control
  const result = await authClient.signOut({ fetchOptions: { timeout: 5000 } })
  if (result.error)
    throw new Error(
      "Pending remote logout must complete before authenticating another account"
    )
  const completed = await completeRemoteLogout(control.epoch)
  if (completed.logoutPending)
    throw new Error("A newer logout is still pending")
  return completed
}
