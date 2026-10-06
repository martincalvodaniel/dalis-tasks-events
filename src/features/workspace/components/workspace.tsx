"use client"

import { useId, useState } from "react"
import { WorkspaceNavigation } from "@/components/shared/workspace-navigation"
import { CreateTaskButton } from "@/features/tasks/components/create-task-button"
import { TaskComposer } from "@/features/tasks/components/task-composer"
import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { UpdateNotice } from "@/features/workspace/components/update-notice"
import { WorkspaceOverview } from "@/features/workspace/components/workspace-overview"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import { useWorkspaceView } from "@/features/workspace/hooks/use-workspace-view"

export function Workspace() {
  const contentId = useId()
  const view = useWorkspaceView()
  const { account, refresh } = useLocalAccount()
  const [composerEpoch, setComposerEpoch] = useState<string | null>(null)
  return (
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
            <CreateTaskButton onClick={() => setComposerEpoch(account.epoch)} />
          ) : undefined
        }
      />
      {account && composerEpoch === account.epoch ? (
        <TaskComposer
          key={account.epoch}
          account={account}
          onClose={() => setComposerEpoch(null)}
          onSaved={() => {
            void refresh()
          }}
        />
      ) : null}
      <main
        id={contentId}
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-3xl wrap-anywhere px-5 pt-8 pb-[calc(14rem+env(safe-area-inset-bottom))] sm:px-8 md:py-12"
      >
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700 md:hidden dark:text-emerald-400">
          Dalis
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {view === "settings" ? "Ajustes" : "Mi espacio"}
        </h1>
        <p className="mt-3 mb-8 max-w-xl text-zinc-600 dark:text-zinc-400">
          {view === "settings"
            ? "Tu cuenta y la preparación de este dispositivo."
            : "Tareas, planes y fechas importantes, también sin conexión."}
        </p>
        {view === "settings" ? <DeviceSettings /> : <WorkspaceOverview />}
        <UpdateNotice />
      </main>
    </div>
  )
}
