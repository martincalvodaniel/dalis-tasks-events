"use client"

import { DelayedStatus } from "@/components/ui/delayed-status"
import { ErrorBanner } from "@/components/ui/error-banner"
import { useAccountDay } from "@/features/calendar/hooks/use-account-day"
import { PlanList } from "@/features/plans/components/plan-list"
import { useLocalPlans } from "@/features/plans/hooks/use-local-plans"
import type { LocalAccount } from "@/features/workspace/local-account"

export function PlanAgenda({ account }: { account: LocalAccount }) {
  const { data, error } = useLocalPlans(account)
  const today = useAccountDay(data?.timeZone)
  if (error)
    return (
      <ErrorBanner>
        No se pudo abrir la agenda local. Tus planes se conservan.
      </ErrorBanner>
    )
  if (!today) return <DelayedStatus>Cargando agenda…</DelayedStatus>
  return (
    <>
      <PlanList
        account={account}
        selection={{ kind: "overdue", date: today }}
        heading="Atrasadas"
      />
      <PlanList
        account={account}
        selection={{ kind: "day", date: today }}
        heading="Hoy"
      />
      <PlanList
        account={account}
        selection={{ kind: "upcoming", date: today, excludeDate: today }}
        heading="Próximas"
      />
    </>
  )
}
