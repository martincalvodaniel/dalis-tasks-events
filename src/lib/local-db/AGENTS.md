# Local Persistence

- Runtime modules in this folder are client-only. Do not import server auth or MongoDB.
- Each account has its own versioned database, keyed by the stable server user ID. A database name is not proof of authorization.
- Validate stored and incoming records with the shared schemas. Personal preferences must match the partition's user ID.
- Queue IndexedDB requests synchronously inside transactions; never await network calls, timers or unrelated promises. Resolve writes only after the transaction's complete event.
- Never delete a database to recover from an upgrade or storage error. Close connections on version changes and preserve pending work.
- Low-level repository writes are for cache/infrastructure. Product mutations must use the atomic outbox layer from iteration 03b.
- Browser test fixtures may use raw transactions to induce failures, but may clean up only their own generated browser-test partitions.
