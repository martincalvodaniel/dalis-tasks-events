<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Language
- All generated or edited source code, identifiers, code comments, technical error messages, and commit messages must be in English.
- All user-facing graphical UI copy, including labels, validation messages, accessibility text, and empty states, must be in Spanish. Product names may remain unchanged.
- Planning and product documentation under `plan/**` may be in Spanish.

## Iteration Delivery
- Read `plan/master.md` and `plan/workflow.md` before starting a product iteration. Follow the current dependency order in `plan/iterations.md`.
- Before editing, define the iteration goal, `target_paths`, dependencies, acceptance criteria, and validation scope. Keep each iteration independently reviewable.
- Every completed iteration, including planning-only iterations, must end with a Conventional Commit on the current branch. Do not switch branches, include unrelated user changes, or push unless requested.
- Update the plan and iteration log in the same commit. For documentation-only iterations, validate references, consistency, and `git diff --check`; code changes must satisfy the full Definition of Done below.
- After every completed iteration, ask the user for the remaining percentages of BOTH Codex usage windows: 5 hours and 7 days, unless the user has explicitly authorized an unattended batch. During such a batch, query current account usage after each commit and follow the batch closing reserve in `plan/workflow.md`; if usage cannot be read, stop at the completed iteration. Resume the normal question protocol when the batch ends.
- Use the lower remaining window, recent observed consumption, and the closing reserve in `plan/workflow.md` to choose whether to continue, split the next task, or stop. Do not promise exact consumption estimates.
- Default to sequential work. Parallel agent work is allowed only when explicitly selected for the iteration, budget permits it, and each agent has disjoint `target_paths`. Shared integration files remain owned by one agent.
- Nested `AGENTS.md` files may add narrowly scoped instructions, but must preserve the root boundaries, language rules, and iteration closing protocol.

## Responsive Navigation
- Prioritize a minimal, information-dense mobile UI: compact rows and typography, short headings, avoid repeated subtitles and large status blocks, and reveal secondary actions/details on demand. Keep essential actions accessible and usable by touch; density must not depend on shrinking interactive targets below a usable size.
- Build mobile-first responsive screens, usable on both phones and desktop.
- Use a bottom navigation bar with local SVG icons on mobile and a top navigation bar on desktop, driven by a single shared destination registry.
- Whenever an important screen is added, update both navigation variants in the same iteration. Show only working destinations, active state and Spanish accessible labels.
- Keep the primary create button accessible, account for device safe areas, and ensure fixed navigation never covers content, focus targets or form controls.

## Tech Stack (Authoritative)
- `next@16`, `react@19`, `react-dom@19` — App Router, Server Components, Server Actions
- `better-auth` — authentication (server config + browser client)
- `mongodb` (native driver, **no ODM / no Mongoose**) — data layer
- `server-only` — enforce the server/client boundary
- `swr` — client-side data fetching
- `zod` — schema validation (shared client/server)
- **TypeScript** is mandatory across the codebase.

Do not introduce new core dependencies (ORMs, state libraries, UI kits, alternative auth/data solutions) without explicit human approval.

## Target Architecture (Baseline)
This is the **baseline**, not a rigid contract. Deviate only when justified by real code, and document the rationale.

```text
src/
├── app/                          # ROUTING ONLY
│   ├── (auth)/                   # auth route group
│   ├── (dashboard)/              # protected route group (session check in layout)
│   └── api/
│       ├── auth/[...all]/route.ts
│       └── pdf/route.ts
├── components/
│   ├── ui/                       # generic primitives
│   └── shared/                   # layout-level components
├── features/                     # domain-driven modules
│   └── <feature>/
│       ├── components/
│       ├── hooks/                # client-side, SWR
│       └── actions.ts            # "use server"
├── lib/
│   ├── auth/
│   │   ├── auth.ts               # server ("server-only")
│   │   └── auth-client.ts        # browser
│   ├── db/
│   │   ├── client.ts             # MongoDB singleton ("server-only")
│   │   └── collections.ts
│   ├── pdf/
│   │   └── generate.ts           # pdf-lib ("server-only")
│   └── utils.ts
├── schemas/                      # zod, shared
├── types/
├── hooks/                        # global client hooks
└── config/                       # constants + typed env access
```

## Boundary Rules (Non-Negotiable)
- `lib/db/**`, `lib/pdf/**`, and server-side auth (`lib/auth/auth.ts`) MUST start with `import 'server-only'`.
- `schemas/**` and `types/**` MUST stay framework- and runtime-agnostic (importable from client and server).
- `swr` hooks and `auth-client.ts` are client-only and MUST carry `"use client"` where applicable.
- `app/**` is reserved for routing primitives (`page`, `layout`, `loading`, `error`, `route`); business logic lives in `features/**` or `lib/**`.
- MongoDB connection MUST use a **singleton pattern** to survive hot reloads and serverless invocations. Never open a new connection per request.

## Coding Conventions
- **Server-first**: prefer Server Components and Server Actions. Use `swr` only for interactive/client-driven data (polling, optimistic updates, revalidation).
- **Validation**: every Server Action and route handler that accepts input MUST validate it with a `zod` schema from `schemas/**`. Do not duplicate validation logic.
- **Mutations**: implement via Server Actions in `features/<feature>/actions.ts` marked `"use server"`.
- **Path alias**: use `@/*` mapped to `src/*`. Avoid deep relative imports (`../../../`).
- **PDF generation**: keep all `pdf-lib` logic in `lib/pdf/**` (server-only) and expose it via a route handler or Server Action — never bundle it client-side.
- **Naming**: `kebab-case` for files/folders, `PascalCase` for components, `camelCase` for functions/variables.
- **Env vars**: access only through `config/**`; never read `process.env` directly inside components or features.
- **MongoDB indexes**: when a feature adds a collection or a new query, sort, lookup, or uniqueness pattern, evaluate its index needs in the same change and register required indexes in `src/lib/db/ensure-indexes.ts`. Never create indexes ad hoc.

## Component Extraction Policy
- **No inline components.** Define components in their own files instead of declaring them inline within other components.
- **Scope by reuse:** if a component is tightly coupled to a specific context, colocate it within that feature/context (`features/<feature>/components/**`). If it is generic and reusable, place it in the shared components folder (`components/ui/**` or `components/shared/**`).
- **Reuse first:** before creating a new component, search for an existing one that fits the need and reuse it whenever possible.

## Security & Data
- Never log secrets, tokens, or PII.
- Never commit `.env*` files or credentials.
- Enforce auth checks in protected route group layouts, not only on the client.
- Treat all external input as untrusted until validated by `zod`.
## Agent Workflow
1. **Plan before code**: for any non-trivial task, outline the change, affected paths, and dependencies first.
2. **Scope discipline**: only modify files relevant to the task. Do not perform unrelated refactors.
3. **Parallel-safe edits**: if multiple subagents run concurrently, no two may write the same file. Partition work by `target_paths`.
4. **Small, coherent changes**: keep diffs reviewable; one logical concern per change.
5. **Document deviations**: if you depart from the baseline architecture, state why in the PR/description and in code comments where helpful.

## Definition of Done
- [ ] Code placed at the correct target path with the right boundary directive (`server-only` / `"use client"`).
- [ ] All imports updated; no broken references; uses `@/*` alias.
- [ ] Components extracted to their own files and correctly scoped (feature-local vs shared); existing components reused where applicable.
- [ ] Input validated with `zod` schemas from `schemas/**`.
- [ ] MongoDB access goes through the singleton.
- [ ] `tsc --noEmit` passes (no type errors).
- [ ] `next build` succeeds with **no client/server import leaks** (no `server-only` module reachable from a client component).
- [ ] No secrets or `.env*` introduced into version control.

## What NOT to Do
- Do not put business logic, DB access, or PDF logic inside `app/**`.
- Do not import `lib/db`, `lib/pdf`, or server auth from client components.
- Do not declare inline components or duplicate components that already exist.
- Do not add an ORM or replace the native MongoDB driver.
- Do not bypass `zod` validation on inputs.
- Do not introduce new top-level dependencies without approval.
- Do not reveal or hardcode secrets.

## When in Doubt
Prefer the **server-first**, **boundary-safe**, **validated** option. If a decision materially changes architecture, dependencies, or security posture, **pause and request human confirmation** rather than guessing.
