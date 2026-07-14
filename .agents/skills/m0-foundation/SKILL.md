---
name: m0-foundation
description: Guide for tasks belonging to the M0 — Repository Foundation phase. Defines allowed work, excluded work, validation, and exit criteria.
---

# M0 — Repository Foundation Skill

Load this skill when working on any M0 task: Nx workspace setup, application scaffolding, shared packages, CI pipeline, or foundation configuration.

## M0 Goals

Create a buildable, testable repository with three runnable applications and a shared package ecosystem. No business features.

## Allowed Work

- Git repository initialization and branch rules.
- Nx workspace configuration and root scripts.
- npm workspaces with shared TypeScript, ESLint, Prettier config.
- Angular app shell with placeholder routes and basic layout.
- Express app with health endpoint, error handler, request logging.
- Worker CLI skeleton with health command.
- `packages/domain` — shared types and enums (no infrastructure deps).
- `packages/contracts` — transport DTOs and shared API types.
- `packages/database` — MongoDB client setup and base repository pattern.
- `packages/config` — Zod-based environment validation per runtime.
- `packages/observability` — Pino structured logging factory.
- `packages/test-support` — test helpers, fixtures, mock utilities.
- Vitest + Supertest test configuration.
- GitHub Actions CI pipeline (install → lint → test → build).
- README with setup instructions.
- `.env.example` with required environment variables.

## Explicitly Excluded from M0

- Sigma scraping, fetching, or HTML parsing.
- Product normalization, classification, or taxonomy mapping.
- Product matching or identity resolution.
- Compatibility rules or the engine.
- Catalog endpoints or UI beyond placeholder pages.
- Builder endpoints or UI.
- Search implementation.
- Production deployment configuration.
- Payment processing.
- Authentication beyond basic admin token placeholders.
- Creating future packages (`scraping-core`, `sigma-adapter`, `normalization`, `product-matching`, `compatibility-engine`, `search`) — these are created only when their milestone begins.

## Required Validation

Before marking any M0 task complete:

```bash
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
npx nx run-many -t typecheck
```

Also verify:

- `npm run dev` starts web and api.
- `npm run worker -- health` runs successfully.
- `GET /api/health` returns `{"status":"ok","database":"connected"}`.
- All apps use TypeScript strict mode.

## M0 Exit Criteria

All of these must be true before moving to M1:

- [ ] Nx monorepo works.
- [ ] `web`, `api`, `worker` run as independent applications.
- [ ] All applications use TypeScript strict mode.
- [ ] API connects to MongoDB.
- [ ] Worker connects to MongoDB.
- [ ] `GET /api/health` works.
- [ ] Angular can call the health endpoint.
- [ ] Worker health command works.
- [ ] Environment validation works.
- [ ] Structured logging works.
- [ ] Lint works from root.
- [ ] Tests work from root.
- [ ] Build works from root.
- [ ] GitHub Actions pipeline passes.
- [ ] README explains setup steps.
- [ ] No scraping code exists in M0.

## Rules

- No business feature implementation belongs in M0.
- Future packages are created only when their milestone begins — do not create empty placeholder packages.
- Every change must be the smallest coherent unit that completes the assigned task.
