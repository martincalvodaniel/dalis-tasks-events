"use client"

import { useId, useState } from "react"
import { CreateItemButton } from "@/components/shared/create-item-button"
import { WorkspaceNavigation } from "@/components/shared/workspace-navigation"
import { workspaceDestinations } from "@/config/navigation"
import { CalendarScreen } from "@/features/calendar/components/calendar-screen"
import { useCalendarDate } from "@/features/calendar/hooks/use-calendar-date"
import { SyncIssueNotice } from "@/features/sync/components/sync-issue-notice"
import { WorkspaceSyncProvider } from "@/features/sync/components/workspace-sync-provider"
import { TagsScreen } from "@/features/tags/components/tags-screen"
import { CreateItemDialog } from "@/features/workspace/components/create-item-dialog"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { UpdateNotice } from "@/features/workspace/components/update-notice"
import { WorkspaceOverview } from "@/features/workspace/components/workspace-overview"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import { useWorkspaceView } from "@/features/workspace/hooks/use-workspace-view"

export function Workspace() {
  const contentId = useId()
  const view = useWorkspaceView()
  const calendarDate = useCalendarDate()
  const destination =
    workspaceDestinations.find((entry) => entry.id === view) ??
    workspaceDestinations[0]
  const { account, refresh } = useLocalAccount()
  const [composerEpoch, setComposerEpoch] = useState<string | null>(null)
  return (
    <WorkspaceSyncProvider account={account}>
      <div data-offline-shell="dalis" className="min-h-dvh">
        <a
          href={`#${contentId}`}
          className="sr-only z-50 rounded-xl bg-white p-4 text-emerald-800 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>
        <WorkspaceNavigation
          activeView={view}
          createAction={
            account ? (
              <CreateItemButton
                onClick={() => setComposerEpoch(account.epoch)}
              />
            ) : undefined
          }
        />
        {account && composerEpoch === account.epoch ? (
          <CreateItemDialog
            key={account.epoch}
            account={account}
            initialDate={
              view === "calendar" ? (calendarDate ?? undefined) : undefined
            }
            onClose={() => setComposerEpoch(null)}
            onSaved={() => {
              void refresh()
            }}
          />
        ) : null}
        <main
          id={contentId}
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-3xl wrap-anywhere px-3 pt-4 pb-[calc(18rem+env(safe-area-inset-bottom))] sm:px-8 md:py-12"
        >
          <h1 className="mb-3 text-xl font-semibold tracking-tight md:mt-3 md:text-3xl">
            {destination.label}
          </h1>
          <p className="hidden md:block mt-3 mb-6 max-w-xl text-zinc-600 dark:text-zinc-400">
            {destination.description}
          </p>
          {view === "settings" ? (
            <DeviceSettings />
          ) : view === "tags" ? (
            <TagsScreen />
          ) : view === "calendar" ? (
            <CalendarScreen />
          ) : (
            <WorkspaceOverview />
          )}
          <UpdateNotice />
          {view !== "settings" ? <SyncIssueNotice /> : null}
        </main>
      </div>
    </WorkspaceSyncProvider>
  )
}
