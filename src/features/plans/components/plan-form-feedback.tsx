"use client"

import { type RefObject, useEffect, useId, useRef } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"

export type PlanFormError = { message: string; fields: string[] }

export function PlanFormFeedback({
  error,
  form,
}: {
  error: PlanFormError
  form: RefObject<HTMLFormElement | null>
}) {
  const id = useId()
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controls = [...(form.current?.elements ?? [])]
    const target = error.fields.flatMap((name) =>
      controls.filter(
        (element) =>
          element.getAttribute("name") === name &&
          element instanceof HTMLElement &&
          element.getClientRects().length > 0 &&
          !element.matches(":disabled")
      )
    )[0]
    if (!(target instanceof HTMLElement)) {
      summary.current?.focus()
      return
    }
    const invalid = target.getAttribute("aria-invalid")
    const description = target.getAttribute("aria-describedby")
    target.setAttribute("aria-invalid", "true")
    target.setAttribute(
      "aria-describedby",
      [description, id].filter(Boolean).join(" ")
    )
    target.focus()
    return () => {
      if (invalid === null) target.removeAttribute("aria-invalid")
      else target.setAttribute("aria-invalid", invalid)
      if (description === null) target.removeAttribute("aria-describedby")
      else target.setAttribute("aria-describedby", description)
    }
  }, [error, form, id])
  return (
    <div id={id} ref={summary} tabIndex={-1}>
      <ErrorBanner>{error.message}</ErrorBanner>
    </div>
  )
}
