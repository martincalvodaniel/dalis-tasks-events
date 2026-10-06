"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { restoreLocalAccount } from "@/features/workspace/local-account"
import {
  readAccountControl,
  subscribeAccountChanges,
} from "@/lib/local-db/account-control"

export function useLocalAccount() {
  const { data, error, mutate, isLoading } = useSWR(
    "dalis:active-local-account",
    async () => {
      const account = await restoreLocalAccount()
      const control = await readAccountControl()
      return {
        account: account && account.epoch === control.epoch ? account : null,
        logoutPending: control.logoutPending,
      }
    },
    { revalidateOnReconnect: false, shouldRetryOnError: false }
  )
  useEffect(
    () =>
      subscribeAccountChanges(() => {
        void mutate(
          { account: null, logoutPending: false },
          { revalidate: true }
        )
      }),
    [mutate]
  )
  return {
    account: data?.account ?? null,
    logoutPending: data?.logoutPending ?? false,
    error,
    isLoading,
    refresh: () => mutate(),
  }
}
