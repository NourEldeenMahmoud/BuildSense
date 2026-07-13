---
name: architecture-guard
description: Validates architectural boundaries, dependency direction, and responsibility separation in BuildSense. Loads before code review or when adding new imports/packages.
---

# Architecture Guard Skill

Load this skill when reviewing code, adding imports, creating new packages, or verifying architectural compliance.

## Permanent Boundary Rules

### Application Responsibilities

| App | Owns | Must Not |
|-----|------|----------|
| `apps/web` | UI, routing, user interaction | Import database code, store-adapter code, access MongoDB |
| `apps/api` | REST endpoints, business logic, data serving | Scrape external stores, depend on `sigma-adapter` or `scraping-core` |
| `apps/worker` | All ingestion: scraping, normalization, matching, publishing | Be triggered from API HTTP requests |

### Package Boundaries

| Package | May Depend On | Must Not Depend On |
|---------|---------------|-------------------|
| `packages/domain` | Nothing (pure types/logic) | Angular, Express, MongoDB, Mongoose, Sigma, any infrastructure |
| `packages/contracts` | Nothing | Database models, infrastructure code |
| `packages/database` | Mongoose, MongoDB driver | Angular, Express, UI code |
| `packages/config` | Zod, env vars | Any app-specific code |
| `packages/observability` | Pino | Any business logic |
| `packages/test-support` | Test utilities only | Production app code |

### Dependency Direction

```
web  → contracts, domain, config
api  → contracts, domain, database, compatibility-engine, search, observability, config
worker → domain, database, scraping-core, sigma-adapter, normalization, product-matching, observability, config
```

**Forbidden:**
- No circular package dependencies.
- No app imports another app.
- No package above the boundary imports from below.
- `packages/domain` has zero infrastructure dependencies.

### Data Rules

- Raw scraped snapshots must remain immutable after capture.
- Store-specific parsing belongs in a store adapter package (`sigma-adapter`, etc.).
- Shared crawling behavior belongs in `scraping-core`.
- Compatibility rules belong in `compatibility-engine`.
- Bundles are visible in catalog but cannot be selected as PC builder components.
- The platform does not process payments in the MVP.
- `packages/contracts` contains transport DTOs, not database models.

## Validation Checklist

When reviewing changes:

1. **Check imports** — Are any forbidden cross-boundary imports introduced?
2. **Check new packages** — Does the package belong at its level in the dependency hierarchy?
3. **Check API code** — Is there any scraping logic, HTML parsing, or Sigma-specific code?
4. **Check web code** — Is there any direct database access or store-adapter usage?
5. **Check domain code** — Is it free of infrastructure imports (Express, Mongoose, Angular)?
6. **Check data flow** — Does raw data remain immutable? Are corrections made through normalized data only?
7. **Check circular deps** — Run dependency analysis if adding new cross-package imports.

## Violation Response

When a violation is found:

1. Classify the severity (Blocker / High / Medium / Low).
2. Identify the smallest correction that resolves the violation.
3. Suggest the specific file and line changes needed.
4. Do not apply the fix unless explicitly asked.

## Common Anti-Patterns to Flag

- Business logic inside Express route handlers.
- Direct `process.env` access outside `packages/config`.
- Mongoose models imported into `packages/domain` or `apps/web`.
- Sigma-specific selectors or URL patterns in `apps/api`.
- `console.log` in production code (use Pino logger).
- `any` type without documented justification.
