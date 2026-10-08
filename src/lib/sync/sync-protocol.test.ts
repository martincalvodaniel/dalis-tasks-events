import { expect, test } from "bun:test"
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
