export const syncProtocolVersion = 1
// Durable intentions and transport announcements evolve independently.
export const syncOperationVersion = 1
// Placement support requires a separate announcement, while DTOs remain version two.
export const placementSyncProtocolVersion = 3
export const syncProtocolHeader = "x-dalis-sync-protocol"
