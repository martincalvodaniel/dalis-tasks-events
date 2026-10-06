"use client"

export const outboxStoreDefinitions = {
  outbox: {
    keyPath: "operation.operationId",
    indexes: [
      { name: "bySequence", keyPath: "sequence", unique: true },
      { name: "byState", keyPath: "state", unique: false },
      {
        name: "byEntitySequence",
        keyPath: ["entityKey", "sequence"],
        unique: true,
      },
    ],
  },
  remoteShadows: { keyPath: "entityKey", indexes: [] },
  syncMetadata: { keyPath: "key", indexes: [] },
}
