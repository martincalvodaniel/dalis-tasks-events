import { NavigationIcon } from "@/components/ui/navigation-icon"
import { type WorkspaceView, workspaceDestinations } from "@/config/navigation"

export function NavigationLinks({
  activeView,
  mobile = false,
}: {
  activeView: WorkspaceView
  mobile?: boolean
}) {
  return (
    <ul
      className={
        mobile ? "flex items-stretch gap-2" : "flex items-center gap-3"
      }
    >
      {workspaceDestinations.map((destination) => (
        <li key={destination.id} className={mobile ? "min-w-0 flex-1" : ""}>
          <a
            href={destination.href}
            aria-current={destination.id === activeView ? "page" : undefined}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${mobile ? "flex-col px-2" : "px-4"} ${destination.id === activeView ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            <NavigationIcon name={destination.icon} />
            <span className="min-w-0 wrap-anywhere text-center">
              {destination.label}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
