import "server-only"

import { createHash } from "node:crypto"
import { syncOperationSchema } from "@/schemas/sync"

const fingerprintDomain = "sync-operation-fingerprint:v1\n"

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) =>
          left < right ? -1 : left > right ? 1 : 0
        )
        .map(([key, nested]) => [key, canonicalValue(nested)])
    )
  return value
}

// Compute on the server; a client-provided digest is never a receipt or permission.
export function syncOperationFingerprint(input: unknown): string {
  const operation = syncOperationSchema.parse(input)
  return createHash("sha256")
    .update(fingerprintDomain)
    .update(JSON.stringify(canonicalValue(operation)), "utf8")
    .digest("hex")
}
