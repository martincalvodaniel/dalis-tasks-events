export function parseAllowedEmails(value: string): ReadonlySet<string> {
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isEmailAllowed(
  email: string,
  allowedEmails: ReadonlySet<string>
): boolean {
  return allowedEmails.has(email.trim().toLowerCase())
}
