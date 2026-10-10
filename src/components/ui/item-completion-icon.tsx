export type ItemCompletionVariant = "task" | "event" | "appointment" | "note"

export function ItemCompletionIcon({
  variant,
  completed,
  color,
  className = "size-5",
}: {
  variant: ItemCompletionVariant
  completed: boolean
  color?: string | null
  className?: string
}) {
  const iconColor = color ?? "currentColor"
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={iconColor}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {variant === "event" ? (
        <circle
          cx="12"
          cy="12"
          r="9"
          fill={completed ? iconColor : "none"}
          fillOpacity="0.2"
        />
      ) : variant === "note" ? (
        <>
          <path
            d="M5 3h10l4 4v14H5z"
            fill={completed ? iconColor : "none"}
            fillOpacity="0.2"
          />
          <path d="M15 3v4h4" />
          {completed ? null : <path d="M8 11h8M8 15h6" />}
        </>
      ) : (
        <>
          <rect
            x="3"
            y={variant === "appointment" ? "5" : "3"}
            width="18"
            height={variant === "appointment" ? "16" : "18"}
            rx={variant === "appointment" ? "2" : "3"}
            fill={completed ? iconColor : "none"}
            fillOpacity="0.2"
          />
          {variant === "appointment" ? <path d="M3 9h18M7 3v4M17 3v4" /> : null}
        </>
      )}
      {completed ? (
        <path
          d={variant === "appointment" ? "m7 15 3 3 7-6" : "m7 12 3 3 7-7"}
        />
      ) : null}
    </svg>
  )
}
