export const workspaceDestinations = [
  { id: "overview", label: "Mi espacio", href: "/workspace", icon: "home" },
  {
    id: "settings",
    label: "Ajustes",
    href: "/workspace?view=settings",
    icon: "settings",
  },
] as const

export type WorkspaceView = (typeof workspaceDestinations)[number]["id"]
export type NavigationIconName = (typeof workspaceDestinations)[number]["icon"]

export function workspaceViewFromSearch(search: string): WorkspaceView {
  const requested = new URLSearchParams(search).get("view")
  return (
    workspaceDestinations.find((destination) => destination.id === requested)
      ?.id ?? "overview"
  )
}
