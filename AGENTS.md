# BuildSense — Agent Instructions

## Project Identity

- **Name:** BuildSense
- **Current Phase:** M1 — Sigma Data Discovery (complete)
- **Purpose:** Egyptian PC hardware catalog, compatibility engine, and purchasing-assistance platform. Starts with Sigma Computer store only. Aggregates product data, normalizes specs, resolves product identity, provides search/filtering, a PC builder with rule-based compatibility checking, and a purchase plan that redirects to the original store.

## Source of Truth

Resolve project decisions in this order:

1. Current GitHub issue or explicitly assigned task.
2. Accepted ADR files in `docs/ADR/`.
3. TDD in `docs/TDD/`.
4. PRD in `docs/PRD/`.
5. Existing implementation and tests.

If sources conflict, the more specific and recently accepted decision wins. Report the conflict.

## Documentation Reading Policy

- Read `docs/ADR/ADR-000-project-foundation-decisions.md` before any foundation or architectural work.
- Read `docs/ADR/ADR-002-http-first-scraping.md` before Sigma scraping or parser work.
- Read only the relevant TDD section for the current task. Use heading search — never load the full TDD.
- Avoid reading the complete PRD unless a specific fact is missing from both ADR and TDD.
- Record which documentation sections were used for each task.
- Never invent requirements absent from the documentation.

## Architectural Boundaries

These rules are permanent and must not be violated:

- `apps/web` must not import database or store-adapter code.
- `apps/api` must never scrape an external store. It must not depend on `sigma-adapter` or `scraping-core`.
- `apps/worker` owns all ingestion: scraping, normalization, matching, and publishing.
- `packages/domain` must not depend on Angular, Express, MongoDB, Sigma, or any infrastructure.
- `packages/contracts` contains transport DTOs and shared enums — not database models.
- Store-specific parsing belongs in a store adapter package (e.g. `sigma-adapter`).
- Shared crawling behavior belongs in `scraping-core`.
- Compatibility rules belong in `compatibility-engine`.
- Raw scraped data must remain immutable after capture.
- Bundles are visible in the catalog but cannot be selected as PC builder components.
- The platform does not process payments in the MVP. Users are redirected to the store.

## Dependency Direction

```text
web  → contracts, domain, config
api  → contracts, domain, database, compatibility-engine, search, observability, config
worker → domain, database, scraping-core, sigma-adapter, normalization, product-matching, observability, config
```

No circular dependencies. No app imports another app. No package above the boundary imports from below.

## Working Method

When assigned a task:

1. Restate the task in your own words.
2. Identify and read only the relevant documentation sections.
3. Inspect only the files related to the task.
4. Present a short implementation plan before making changes.
5. Implement only the requested scope — no opportunistic refactoring.
6. Add or update tests where applicable.
7. Run the relevant validation commands (lint, type-check, test, build) when available.
8. Review your diff for boundary violations and unintended changes.
9. Report: modified files, validation results, limitations, and follow-up items.
10. Stop. Do not start another task.

## Safety Rules

Agents must never:

- Delete project files without explicit instruction.
- Rewrite the PRD, TDD, or ADR silently.
- Commit, push, merge, or force-reset Git unless asked.
- Expose or commit secrets, tokens, or credentials.
- Bypass website access protections.
- Implement features outside the current milestone scope.
- Create empty future packages merely to match the final architecture.
- Claim a command passed without actually running it.
- Add business logic inside Express route handlers, Angular templates, or Mongoose model hooks.

## Current M1 Scope

M1 is limited to understanding Sigma's response data before building the full crawler:

- Review access policy and record the decision.
- Capture representative category and product HTML fixtures.
- Record verified category seed IDs.
- Document selectors, pagination behavior, price/stock cases, and bundles.
- Extract raw specification labels and produce Data Dictionary v0.1.
- Build fixture-backed parser spikes in `packages/sigma-adapter`.
- Record the HTTP-first decision in ADR-002.

**M1 explicitly excludes:**

- A full category pagination/fetch loop.
- Request retries, concurrency controls, and worker locks.
- Raw snapshot persistence and scrape-run state machines.
- Product normalization or classification.
- Product matching or identity resolution.
- Compatibility rules or the engine.
- Catalog endpoints or UI beyond placeholder pages.
- Builder endpoints or UI.
- Search implementation.
- Production deployment.
- Payment processing.
- Authentication beyond basic admin token placeholders.
