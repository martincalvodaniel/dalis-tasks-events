# Dalis Tasks & Events

Mobile-first, offline-capable personal planning app built with Next.js, React, TypeScript, Better Auth and the native MongoDB driver. The interface is in Spanish.

- [User guide (Spanish)](plan/user-guide.md)
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

MongoDB indexes belong in `src/lib/db/ensure-indexes.ts`. Integration Preview bootstrap includes the explicitly authorized appearance and settings indexes; this does not authorize production provisioning or deployment. Commits pushed to `int` trigger the configured preproduction deployment.
