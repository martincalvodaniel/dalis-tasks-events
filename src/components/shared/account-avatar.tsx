"use client"

import Image from "next/image"
import { useState } from "react"
import { NavigationIcon } from "@/components/ui/navigation-icon"
import type { AccountProfile } from "@/types/account-profile"

export function AccountAvatar({
  profile,
  size = "small",
}: {
  profile?: AccountProfile | null
  size?: "small" | "large"
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const source = profile?.image
  return source && failedSource !== source ? (
    <Image
      unoptimized
      src={source}
      alt=""
      width={size === "small" ? 24 : 40}
      height={size === "small" ? 24 : 40}
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailedSource(source)}
      className={`${size === "small" ? "size-6" : "size-10"} shrink-0 rounded-full object-cover`}
    />
  ) : (
    <NavigationIcon name="settings" />
  )
}
