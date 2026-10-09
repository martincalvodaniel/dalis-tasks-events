import "server-only"

import { MongoServerError } from "mongodb"
import { type CollectionName, getCollection } from "@/lib/db/collections"
import type { IndexSpec } from "@/lib/db/ensure-indexes"
import {
  selectMixedSyncIndexSpecs,
  selectPlacementSyncIndexSpecs,
} from "@/lib/db/mixed-sync-index-specs"

export interface MixedSyncIndexInspection {
  listIndexes(
    collection: CollectionName
  ): Promise<readonly Record<string, unknown>[]>
}

export interface MixedSyncIndexReadiness {
  ready: boolean
  missing: string[]
  incompatible: string[]
}

const harmlessIndexFields = new Set([
  "name",
  "key",
  "unique",
  "partialFilterExpression",
  "sparse",
  "hidden",
  "collation",
  "expireAfterSeconds",
  "v",
  "ns",
  "background",
])

function canonicalJson(value: unknown, depth = 0): unknown {
  if (depth > 16) throw new Error("Index filter exceeds its nesting limit")
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (Array.isArray(value))
    return value.map((entry) => canonicalJson(entry, depth + 1))
  if (typeof value !== "object" || value === null)
    throw new Error("Index filter is not a JSON value")
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    throw new Error("Index filter contains a non-JSON object")
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry, depth + 1)])
  )
}

function filtersMatch(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return actual === undefined
  if (actual === undefined) return false
  try {
    return (
      JSON.stringify(canonicalJson(actual)) ===
      JSON.stringify(canonicalJson(expected))
    )
  } catch {
    return false
  }
}

function indexMatches(
  index: Record<string, unknown>,
  spec: IndexSpec
): boolean {
  if (Object.keys(index).some((field) => !harmlessIndexFields.has(field)))
    return false
  const key = index.key
  if (typeof key !== "object" || key === null || Array.isArray(key))
    return false
  const actualKeys = Object.entries(key)
  const expectedKeys = Object.entries(spec.keys)
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      ([name, direction], position) =>
        name === expectedKeys[position][0] &&
        direction === expectedKeys[position][1]
    ) &&
    (index.unique ?? false) === (spec.options.unique ?? false) &&
    (index.sparse === undefined || index.sparse === false) &&
    (index.hidden === undefined || index.hidden === false) &&
    index.collation === undefined &&
    index.expireAfterSeconds === undefined &&
    filtersMatch(
      index.partialFilterExpression,
      spec.options.partialFilterExpression
    )
  )
}

// This port inspects definitions only; it cannot provision an index or expose account data.
async function inspectIndexReadiness(
  inspection: MixedSyncIndexInspection,
  selected: readonly IndexSpec[]
): Promise<MixedSyncIndexReadiness> {
  const missing: string[] = []
  const incompatible: string[] = []
  const collections = [...new Set(selected.map((spec) => spec.collection))]
  for (const collection of collections) {
    let observed: readonly Record<string, unknown>[]
    try {
      observed = await inspection.listIndexes(collection as CollectionName)
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 26) throw error
      observed = []
    }
    for (const spec of selected.filter(
      (entry) => entry.collection === collection
    )) {
      const candidates = observed.filter(
        (index) => index.name === spec.options.name
      )
      if (!candidates.length) missing.push(spec.options.name)
      else if (candidates.length !== 1 || !indexMatches(candidates[0], spec))
        incompatible.push(spec.options.name)
    }
  }
  return {
    ready: missing.length === 0 && incompatible.length === 0,
    missing,
    incompatible,
  }
}

export async function inspectMixedSyncIndexReadiness(
  inspection: MixedSyncIndexInspection
): Promise<MixedSyncIndexReadiness> {
  return inspectIndexReadiness(inspection, selectMixedSyncIndexSpecs())
}

export async function inspectPlacementSyncIndexReadiness(
  inspection: MixedSyncIndexInspection
): Promise<MixedSyncIndexReadiness> {
  return inspectIndexReadiness(inspection, selectPlacementSyncIndexSpecs())
}

const mongoIndexInspection: MixedSyncIndexInspection = {
  listIndexes: async (collection) =>
    (await getCollection(collection)).listIndexes().toArray(),
}

export function readMixedSyncIndexReadiness(): Promise<MixedSyncIndexReadiness> {
  return inspectMixedSyncIndexReadiness(mongoIndexInspection)
}

export function readPlacementSyncIndexReadiness(): Promise<MixedSyncIndexReadiness> {
  return inspectPlacementSyncIndexReadiness(mongoIndexInspection)
}
