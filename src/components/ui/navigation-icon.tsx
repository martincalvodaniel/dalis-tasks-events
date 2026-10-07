import type { NavigationIconName } from "@/config/navigation"

const paths: Record<NavigationIconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5 9v12h5v-7h4v7h5V9",
  tag: "M3 3h8l10 10-8 8L3 11V3M7.5 7.5h.01",
  settings:
    "M9.5 3h5l.5 3 2 1.2 2.9-1 2.5 4.3-2.4 2v2.3l2.4 2-2.5 4.3-2.9-1-2 1.2-.5 3h-5l-.5-3-2-1.2-2.9 1-2.5-4.3 2.4-2v-2.3l-2.4-2 2.5-4.3 2.9 1L9 6l.5-3M15 13.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
}

export function NavigationIcon({ name }: { name: NavigationIconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={name === "settings" ? "0 0 24 27" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 shrink-0"
    >
      <path d={paths[name]} />
    </svg>
  )
}
