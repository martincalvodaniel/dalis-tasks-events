# Dalis Tasks & Events

Mobile-first, offline-capable personal planning app built with Next.js, React, TypeScript, Better Auth and the native MongoDB driver. The interface is in Spanish.

- [User guide (Spanish)](plan/user-guide.md)
- [Release readiness and operating checklist (Spanish)](plan/release-readiness.md)
- [Current plan and delivery status](plan/master.md)
- [Physical two-device acceptance checklist](plan/manual-device-checklist.md)
- [Contribution and iteration workflow](plan/workflow.md)

## Local development

Use the installed Bun toolchain and provide the required environment variables read by `src/config/env.ts`. Never commit credentials or environment files.

```bash
bun run dev
```

Open [localhost:3000](http://localhost:3000). Development mode supports local persistence; test offline shell preparation and reopening with a built application.

## Validation

```bash
bun run lint
bun run type-check
bun run test
bun run build
```

Isolated MongoDB and compiled Next scenarios use the owned-resource runners described in [the sync test environment](plan/sync-test-environment.md). Opt-in integration scenarios do not run against a user database by default.

MongoDB indexes belong in `src/lib/db/ensure-indexes.ts`. `getDatabase()` applies **all registered indexes** once per process, identically in development, Preview and Production. There is no branch or environment exclusion. Missing indexes are created idempotently; duplicates or incompatible definitions fail without deleting or repairing data. This bootstrap does not migrate old documents or resolve synchronization conflicts.

Commits pushed to `int` trigger the configured preproduction deployment. Promotion to `main` and production verification are separate release actions; see the operating checklist above. Do not erase browser storage or a database as an upgrade procedure.
