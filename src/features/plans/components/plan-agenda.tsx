"use client"

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
  if (!today)
    return (
      <p role="status" className="mt-4 text-sm">
        Cargando agenda…
      </p>
    )
  return (
    <>
      <PlanList
        account={account}
        selection={{ kind: "overdue", date: today }}
        heading="Atrasadas"
      />
      <PlanList
        account={account}
        selection={{ kind: "upcoming", date: today }}
        heading="Hoy y próximas"
      />
      {data?.plans.some((plan) => plan.recurrence) ? (
        <p className="mt-3 text-xs text-zinc-500">
          Las repeticiones se guardan, pero sus apariciones todavía no están
          disponibles en esta agenda.
        </p>
      ) : null}
    </>
  )
}
