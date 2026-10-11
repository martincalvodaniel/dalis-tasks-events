import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { NavigationLinks } from "@/components/shared/navigation-links"
import { AccountIdentity } from "@/features/workspace/components/account-identity"
import {
  accountProfileForUser,
  accountProfileSchema,
} from "@/schemas/account-profile"

const profile = {
  userId: "profile-test-user",
  name: "Persona de prueba",
  email: "profile@example.test",
  image: "https://lh3.googleusercontent.com/a/test",
}

test("profile cache accepts only the intended identity and validated Google photo URLs", () => {
  expect(accountProfileForUser(profile, profile.userId)).toEqual(profile)
  expect(accountProfileForUser(profile, "other-user")).toBeNull()
  for (const image of [
    "http://lh3.googleusercontent.com/a/test",
    "https://googleusercontent.com.evil.test/a",
    "https://lh3.googleusercontent.com@evil.test/a",
    "data:image/svg+xml,test",
    "javascript:alert(1)",
  ])
    expect(accountProfileSchema.safeParse({ ...profile, image }).success).toBe(
      false
    )
  expect(
    accountProfileForUser({ ...profile, image: null }, profile.userId)
  ).toMatchObject({ image: null })
  expect(
    accountProfileForUser({ ...profile, extra: true }, profile.userId)
  ).toBeNull()
  expect(
    accountProfileForUser({ ...profile, email: "invalid" }, profile.userId)
  ).toBeNull()
})

test("both navigation layouts preserve settings labels and use a decorative profile photo", () => {
  for (const mobile of [true, false]) {
    const html = renderToStaticMarkup(
      <NavigationLinks
        activeView="settings"
        mobile={mobile}
        profile={profile}
      />
    )
    expect(html).toContain('aria-current="page"')
    expect(html).toContain("Ajustes")
    expect(html).toContain('alt=""')
    expect(html).toContain(profile.image)
    expect(html).not.toContain(profile.email)
    expect(
      renderToStaticMarkup(
        <NavigationLinks activeView="settings" mobile={mobile} />
      )
    ).not.toContain("<img")
  }
  const settings = renderToStaticMarkup(<AccountIdentity profile={profile} />)
  expect(settings).toContain(profile.name)
  expect(settings).toContain(profile.email)
  expect(settings).not.toContain(profile.userId)
})
