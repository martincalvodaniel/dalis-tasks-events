import { AccountAvatar } from "@/components/shared/account-avatar"
import type { AccountProfile } from "@/types/account-profile"

export function AccountIdentity({ profile }: { profile: AccountProfile }) {
  return (
    <section
      aria-label="Cuenta"
      className="mb-4 flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800"
    >
      <AccountAvatar profile={profile} size="large" />
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">Cuenta</p>
        {profile.name ? (
          <p className="wrap-anywhere text-sm font-semibold">{profile.name}</p>
        ) : null}
        <p className="wrap-anywhere text-sm text-zinc-600 dark:text-zinc-300">
          {profile.email}
        </p>
      </div>
    </section>
  )
}
