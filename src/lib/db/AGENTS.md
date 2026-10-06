# MongoDB Data-Layer Rules

## Boundaries

- Only modules under `src/lib/db/**` may import the MongoDB driver.
- Features, Server Actions, and route handlers must use repository or data-layer functions instead of calling `db.collection(...)` directly.
- Register every collection name in `COLLECTION_NAMES` in `collections.ts` and access it through `getCollection()`.
- Keep MongoDB persistence types inside `src/lib/db/**`; do not expose `ObjectId`, `Db`, `Collection`, or MongoDB filters to feature or UI code.
- All modules in this directory must begin with `import "server-only"`.

## Connection Lifecycle

- Use `getDatabase()` from `client.ts`; never create a `MongoClient` in feature code or per request.
- The shared connection promise is cached globally during development so hot reload does not create connection storms.
- Environment variables must be read through `src/config/env.ts`.

## Index Registration

- Every feature that introduces a collection or a new query/sort/uniqueness pattern must evaluate its index needs in the same change.
- Add required indexes to `INDEX_SPECS` in `ensure-indexes.ts`; never call `createIndex` from a repository, route handler, Server Action, or component.
- Every index must have an explicit, stable name that is unique within its collection.
- Add `unique: true` only when uniqueness is a domain invariant, not merely a performance optimization.
- Do not add speculative indexes. Each index should correspond to an implemented query, sort, lookup, or uniqueness constraint.
- Update the index tests whenever index registration rules or concrete specifications change.
- `getDatabase()` applies registered indexes once per process. Use `bun run db:ensure-indexes` to apply and verify them explicitly in an environment.
