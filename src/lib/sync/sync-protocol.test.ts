import { expect, test } from "bun:test"
import {
  syncOperationVersion,
  syncProtocolVersion,
} from "@/config/sync-protocol"
import {
  acceptsSyncProtocolRange,
  encodeSyncProtocolRange,
} from "@/lib/sync/sync-protocol"

test("protocol compatibility requires a bounded valid announced range containing the client", () => {
  expect(acceptsSyncProtocolRange(encodeSyncProtocolRange())).toBe(true)
  expect(acceptsSyncProtocolRange('{"minimum":1,"maximum":2}')).toBe(true)
  for (const header of [
    null,
    "",
    "{",
    '{"minimum":2,"maximum":3}',
    '{"minimum":2,"maximum":1}',
    '{"minimum":0,"maximum":1}',
    '{"minimum":1.5,"maximum":2}',
    '{"minimum":1,"maximum":1000001}',
    '{"minimum":1,"maximum":1,"extra":true}',
    " ".repeat(129),
  ])
    expect(acceptsSyncProtocolRange(header)).toBe(false)
})

test("explicit transport negotiation pauses both mixed deployment directions without changing durable intentions", () => {
  const previous = encodeSyncProtocolRange(1)
  const prepared = encodeSyncProtocolRange(2)
  expect(JSON.parse(prepared)).toEqual({ minimum: 2, maximum: 2 })
  expect(acceptsSyncProtocolRange(prepared, 1)).toBe(false)
  expect(acceptsSyncProtocolRange(previous, 2)).toBe(false)
  expect(acceptsSyncProtocolRange(prepared, 2)).toBe(true)
  expect(acceptsSyncProtocolRange(previous, 1)).toBe(true)
  expect(acceptsSyncProtocolRange(prepared)).toBe(false)
  expect(encodeSyncProtocolRange()).toBe(previous)
  expect(syncProtocolVersion).toBe(1)
  expect(syncOperationVersion).toBe(1)
  for (const invalid of [0, -1, 1.5, 1000001, "2", null, Number.NaN]) {
    expect(() => encodeSyncProtocolRange(invalid)).toThrow()
    expect(acceptsSyncProtocolRange(prepared, invalid)).toBe(false)
  }
})
