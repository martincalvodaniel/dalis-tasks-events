"use client"

export function OrderDragPreview({
  label,
  x,
  y,
  destination,
}: {
  label: string
  x: number
  y: number
  destination?: string
}) {
  return (
    <div
      aria-hidden="true"
      data-order-preview
      className="pointer-events-none fixed z-50 max-w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-emerald-400 bg-emerald-950 px-3 py-2 text-xs text-white shadow-lg"
      style={{ left: x, top: y - 20 }}
    >
      <p className="truncate font-semibold">{label}</p>
      <p className="mt-0.5 text-emerald-200">
        {destination ?? "Arrastra para elegir destino"}
      </p>
    </div>
  )
}
