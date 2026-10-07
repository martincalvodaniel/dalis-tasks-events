"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { loadLocalAccount } from "@/features/workspace/local-account"
import { subscribeAccountChanges } from "@/lib/local-db/account-control"

export function useLocalAccount() {
  const { data, error, mutate, isLoading } = useSWR(
    "dalis:active-local-account",
    loadLocalAccount,
    { revalidateOnReconnect: false, shouldRetryOnError: false }
  )
  useEffect(
    () =>
      subscribeAccountChanges(() => {
        void mutate(
          {
            account: null,
            logoutPending: false,
            authenticationRequired: false,
          },
          { revalidate: true }
        )
      }),
    [mutate]
  )
  return {
    account: data?.account ?? null,
    logoutPending: data?.logoutPending ?? false,
    authenticationRequired: data?.authenticationRequired ?? false,
    error,
    isLoading,
    refresh: () => mutate(),
  }
}
