# ADR-003: M2 Raw Scraper Decisions

**Project:** BuildSense  
**Status:** Accepted  
**Decision Date:** 13 July 2026  
**Scope:** M2 - Raw Scraper  
**Owner:** Nour Eldeen Mahmoud

## Context

M2 implements the Discovery + Fetch + Raw Snapshot pipeline for Sigma. The TDD defines an HTTP-first scraping subsystem, but several implementation choices were explicitly deferred from M1 to M2. This ADR records the decisions made for M2 and resolves conflicts between documentation sources.

## Decision

### HTTP Engine

Use **Crawlee `CheerioCrawler`** as the HTTP orchestration layer. Crawlee provides request queuing, retry logic, rate limiting, concurrency control, and structured failure handling out of the box.

- Store-neutral; Crawlee lives in `packages/scraping-core`.
- Store-specific parsing remains in `packages/sigma-adapter`.
- Crawlee storage is an implementation aid; Mongo repositories and immutable snapshots are authoritative.

### Request Policy

| Parameter | Default | Rationale |
|---|---|---|
| `maxRequestsPerMinute` | 30 | Conservative starting point; Sigma has no `crawl-delay` |
| `maxConcurrency` | 3 | Within ADR-000.13 bounds (1-5) |
| `minConcurrency` | 1 | Crawlee minimum |
| `requestHandlerTimeoutSecs` | 15 | Matches TDD §8.4 |
| `maxRequestRetries` | 2 | Matches TDD §8.4 |

Headers: `Accept-Language: en`, `Accept: text/html`, identifiable `User-Agent` with project name.

### Run State Model

Use a two-field state model to separate lifecycle status from processing stage.

```ts
type ScrapeRunStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

type ScrapeRunStage = 'DISCOVERY' | 'FETCH';

type ScrapeRunMode = 'FULL' | 'CATEGORY' | 'URL';
```

Transitions:

```text
CREATED -> RUNNING
RUNNING/DISCOVERY -> RUNNING/FETCH
RUNNING -> SUCCEEDED
RUNNING -> PARTIALLY_FAILED
RUNNING -> FAILED
CREATED/RUNNING -> CANCELLED
```

Terminal status (`SUCCEEDED`, `PARTIALLY_FAILED`, `FAILED`, `CANCELLED`) cannot be moved back to `RUNNING`. Resume is allowed only for non-terminal runs with matching store, mode, and command input.

### Partial vs Full Success

- `SUCCEEDED`: zero item failures.
- `PARTIALLY_FAILED`: item failures exist but all health gates pass.
- `FAILED`: a health gate fails or a critical stage (discovery/fetch) cannot proceed.

### Public Run ID vs Mongo ObjectId

The CLI accepts a user-supplied `--run-id` string (default: auto-generated UUID). This is stored as `runId: string` on `scrape_runs`, with a unique index on `{storeCode, runId}`. Internal cross-references (snapshots, run items) use the Mongo `_id` of the run document, consistent with TDD §9.2.

### HTML Storage

Use **filesystem gzip** only for M2.

```text
fixtures/runs/<runId>/<externalId-or-urlHash>-<shaPrefix>.html.gz
```

- SHA-256 over uncompressed response bytes.
- Atomic write: temp file + rename.
- Same content + same path = idempotent resume (no overwrite).
- Different content = second file with distinct hash prefix.
- Mongo document stores: `contentStorage: FILE`, `contentPath`, `contentSha256`, parsed raw fields.
- Runtime snapshots are gitignored; curated `fixtures/sigma` remain tracked.

### Run Membership

Use a **`scrape_run_items` collection** (one row per `scrapeRunId + canonicalUrl`) to track per-URL progress within a run. This avoids unbounded arrays on run or discovery documents and makes resume and auditing explicit.

Fields: run ID, canonical URL, category/seed source, fetch state (pending/fetched/failed/skipped), attempts, failure kind, snapshot reference, timestamps.

### Discovery Products

Global upsert by `{storeCode, canonicalUrl}`. First/last discovery timestamps tracked. `lastDiscoveredRunId` is not sufficient for overlapping runs, so run membership is handled by `scrape_run_items`.

### Product Identity

- Canonical `externalId` = Sigma RSC product UUID (`product.id` from RSC data).
- URL slug = separate discovery key (`?id=...` parameter).
- `externalId` may be null on a discovered product until a successful product parse fills the UUID.

### Snapshot Filename on Changed Content

Include a short content-hash prefix in the filename to preserve immutability:

```text
<externalId-or-urlHash>-<shaPrefix>.html.gz
```

Two different responses for the same URL in the same run produce two distinct files.

### Failed Fetch/Parse Persistence

When a response body exists but parsing fails, persist the HTML as an immutable raw snapshot with `parseStatus: 'FAILED'` and nullable raw fields. Failed snapshots reference the same filesystem gzip path. This satisfies the requirement that every failure is auditable.

### Pagination Loop Protection

- Hash sorted canonical product URLs from each category page.
- If the same hash repeats, stop that category and record a `PAGINATION_LOOP` failure.
- Hard limit: `maxPagesPerCategory = 200` (configurable).
- Use the `isNext` flag from Sigma's pagination object, not the misleading `totalPages` source value.

### Robots Policy

- Fetch and evaluate `robots.txt` before full or category runs.
- Record the decision in the scrape run document.
- Never bypass denial, CAPTCHA, login, or blocking.

### Health Gates

**Absolute gates** (enforced on every run, including first run):

| Gate | Threshold | Severity |
|---|---|---|
| Missing title | > 10% of fetched pages | FAILED |
| HTTP blocks | 403/429 rate > 10% | FAILED |
| Parser critical | Cannot extract externalId AND URL | FAILED |
| Duplicate page loop | Repeated fingerprint | FAILED |
| Empty discovery | Full run discovers zero products | FAILED |

**Historical gates** (enforced only when a prior successful full-run baseline exists):

| Gate | Threshold | Severity |
|---|---|---|
| Discovery count | < 40% of baseline | FAILED |
| Empty category | Previously non-empty category becomes empty | FAILED |
| Missing price growth | > 30% increase vs baseline | PARTIALLY_FAILED |

**First run behavior:** Historical gates emit a warning (`NO_BASELINE`) but are not enforced.

### Failure Classification

Retryable:

```text
NETWORK | TIMEOUT | HTTP_408 | HTTP_429 | HTTP_5XX
```

Terminal:

```text
ROBOTS_DENIED | HTTP_4XX | OFF_DOMAIN_REDIRECT | BLOCKED_RESPONSE
INVALID_CONTENT_TYPE | PARSE_FAILED | PERSISTENCE_FAILED
PAGINATION_LOOP | PAGE_LIMIT_EXCEEDED
```

### Worker Lock

All mutating Sigma commands (full, category, persistent URL) share one lock key: `SIGMA_MUTATING_RUN`. Dry-run and live-sample commands do not acquire the lock.

- Atomic `findOneAndUpdate` with expired-or-absent condition.
- TTL index on `expiresAt`.
- Heartbeat extension for long-running commands.

### Category Hint Type

Use a string union of current Sigma adapter seed IDs (e.g., `'cpu' | 'gpu' | ...`) inside `sigma-adapter`. Do not implement M3 domain taxonomy prematurely.

### Test MongoDB

Use `mongodb-memory-server` for repository and lock integration tests. Atlas remains the development default per ADR-001. Tests must not depend on Atlas credentials or external connectivity.

### CLI Commands

```bash
npm run worker -- sigma full [--run-id <id>]
npm run worker -- sigma category <seed-id> [--run-id <id>]
npm run worker -- sigma url <sigma-url> [--run-id <id>] [--dry-run]
npm run worker -- sigma live-sample [--url <sigma-url>]
```

- `sigma url` persists snapshots by default; `--dry-run` disables persistence.
- `sigma live-sample` is manual and excluded from CI.

## Consequences

### Benefits

- Crawlee provides battle-tested retry, rate limiting, and concurrency without custom infrastructure.
- Filesystem gzip keeps M2 simple and auditable.
- Run membership via `scrape_run_items` makes resume and auditing explicit.
- Two-field state model cleanly separates lifecycle from processing stage.
- `mongodb-memory-server` tests are hermetic and fast.

### Risks

- Crawlee adds a runtime dependency that may need version management.
- Filesystem gzip does not scale to production; object storage will be needed later.
- The `totalPages` source value may change behavior in future Sigma versions.
- RSC format changes remain a risk for parser correctness.

## Source Conflicts Resolved

### Mongoose vs Native MongoDB Driver

ADR-000.7 (accepted) specifies Mongoose. TDD §36 backlog lists "MongoDB Node Driver + Zod" as an alternative ADR. ADR-000 is authoritative. M2 uses Mongoose, consistent with the current codebase.

### MONGO_URI vs MONGODB_URI

ADR-001 and current `.env.example` use `MONGO_URI`. TDD §6.2 lists `MONGODB_URI`. Current implementation wins: `MONGO_URI` and `MONGO_DB_NAME`.

### MongoDB Atlas vs Docker

ADR-001 supersedes ADR-000.15: Atlas is the default for development. Docker is not required. Integration tests use `mongodb-memory-server`, not Docker containers.

### Dependency Versions

TDD §3 specifies Node 24, TypeScript 6, Angular 22, Crawlee 3.17+. The repository currently uses Node >=20, TypeScript ~5.8, Angular 19, and has no Crawlee. M2 installs a Crawlee release compatible with the current Node >=20 runtime. No opportunistic upgrades.

### CLI Naming

TDD examples use `sigma discover/fetch/full`. ADR-000.9 uses `sigma:discover/sigma:fetch`. M2 uses `sigma full/category/url/live-sample` as the authoritative command surface.

## Related Decisions

- ADR-000.8 - Application Separation
- ADR-000.9 - Worker Execution Model
- ADR-000.10 - Scraping Strategy
- ADR-000.11 - Raw-First Data Ingestion
- ADR-000.12 - Logging
- ADR-000.13 - Environment Configuration
- ADR-001 - MongoDB Atlas as Default Development Database
- ADR-002 - Sigma HTTP-First Extraction
- TDD §8 - Scraping Subsystem
- TDD §9 - Raw, Staging, Canonical, Published Models
- TDD §25 - Concurrency and Idempotency
- TDD §33 - Phase M2
