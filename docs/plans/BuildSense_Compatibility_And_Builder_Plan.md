# BuildSense — Fast Track User Features Plan

**Status:** Fast Track — Ready for Review  
**Created:** 15 July 2026  
**Updated:** 15 July 2026  
**Scope:** Persistent Build API → Real Builder + Purchase Plan → Full User Journey E2E  
**Owner:** Nour Eldeen Mahmoud

---

## 1. Overview

### Scope

Three delivery phases that deliver a working user-facing builder and purchase plan:

| Phase | Name | Deliverable |
|-------|------|-------------|
| 0 | Persistent Build API | Build model, repository, REST endpoints, optimistic concurrency, compatibility evaluation wired in |
| 1 | Real Builder + Purchase Plan | API-driven web builder UI + purchase plan UI, fully wired to Phase 0 API |
| 2 | Full User Journey E2E | End-to-end validation, edge-case hardening, E2E tests, documentation |

### What Is Not In This Plan

All items below are **explicitly deferred**. This plan does not implement, test, or claim readiness for any of them:

- **Compatibility-facts extraction pipeline** (worker ingestion, backfill, per-category extractors, quality gates, `CatalogProduct.compatibility` schema migration) — no new extraction work in these phases.
- **Compatibility-rule authoring and expansion** — these phases author no compatibility rules. The Phase 0 engine scaffold contains no rules; with no registered rules or missing required facts, evaluation deterministically returns UNKNOWN. The full 17-rule P0 matrix, rule activation gating, CMP-CPU-MB-002, and CMP-STORAGE-MB-001 are all deferred.
- **CPU Cooler / Case Fans** — removed from active models, endpoints, acceptance criteria, examples, rules, UI, and tests. Cooler and Case Fans appear in this document only in this deferral list.
- **Admin backend** — M7 scope.
- **Production scraper closure** — deferred.
- **Scheduler / deployment** — deferred.
- **Second store** — deferred.
- **Advanced scoring / ranking** — no performance score, no multi-factor suggestion scoring in this plan.
- **Green Validation phase** — removed; validation is covered by Phase 2 E2E.
- **Standalone Facts + Rules delivery phases** — removed; any fact/rule consumption is incidental to the three user-feature phases.

---

## 2. Build Slots and Cardinality

Seven slots only. One selected product per slot. Quantity rules:

| Slot | Cardinality | Quantity | Notes |
|------|-------------|----------|-------|
| CPU | 0..1 | 1 | |
| Motherboard | 0..1 | 1 | |
| RAM | 0..1 kit | 1–4 | Kits of identical RAM; quantity = number of kits |
| GPU | 0..1 | 1 | |
| Storage | 0..1 device | 1–8 | Quantity = number of identical drives |
| PSU | 0..1 | 1 | |
| Case | 0..1 | 1 | |

**Deferred slots** (not in any model, endpoint, or test): CPU Cooler, Case Fans.

**Bundle rule:** Bundles are visible in the catalog but `buildEligibility = NOT_ELIGIBLE`. Bundles never appear as candidate products for any slot.

---

## 3. Compatibility Facts: Product vs. Category-Level

### Product Facts

Per-`CatalogProduct` compatibility facts remain stored on the `CatalogProduct` document (field name `compatibility`). Facts are key-value pairs scoped by category, carrying per-fact evidence. The domain shape is:

```ts
interface CompatibilityFactSet {
  extractorVersion: string;
  facts: Record<string, unknown>;
  evidence: FactEvidence[];
  extractedAt: Date;
}
```

These are populated by worker extraction (deferred) and read by the API at evaluation time. No new extraction work is in scope for this Fast Track.

### Category-Level Quality Reports

Quality, coverage, and precision reports are **not** embedded in each product's fact record. They use a **separate category-level persistence model** — a distinct collection or document keyed by `(category, extractorVersion)`:

```ts
interface CategoryQualityReport {
  category: string;
  extractorVersion: string;
  totalProducts: number;
  extractableCount: number;
  coverage: number;                    // extractableCount / totalProducts
  verifiedCorrect: number | null;
  verifiedTotal: number | null;
  precisionOnVerifiedSample: number | null;
  verifiedSampleSize: number | null;
  evaluatedAt: Date;
}
```

- **Ownership:** Worker ingestion/backfill populates this store.
- **API:** Read-only — the API may surface quality reports for diagnostics but never writes them.
- **Not in Fast Track scope:** The quality report store, evaluation logic, and reporting UI are all deferred. This design decision is documented here to prevent product-fact records from being polluted with category-level aggregates.

---

## 4. Invariant: Missing Facts Produce UNKNOWN

**Rule:** When a compatibility rule depends on facts that are absent, null, or unextractable for either slot, the rule result status is **UNKNOWN** — never PASS, never ERROR, never WARNING.

**Scope in this plan:** The Phase 0 engine scaffold contains no rules; with no registered rules or missing required facts, the default evaluator deterministically returns UNKNOWN for every slot — never PASS. Phase 0 tests this at the API/domain level using fixture data, verifying that endpoints and the status reducer propagate UNKNOWN correctly. Phase 2 verifies UNKNOWN display in the user journey. No rule authoring or fact extraction is performed.

---

## 5. Current API Error Format

Source: `packages/contracts/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/app.test.ts`.

### Current Format

```ts
// packages/contracts/src/index.ts
interface ApiErrorResponse {
  error: string;
  requestId: string;
}
```

Response examples from source:
```json
{ "error": "Not Found", "requestId": "550e8400-..." }
{ "error": "Internal Server Error", "requestId": "550e8400-..." }
```

### Extension for BUILD_VERSION_CONFLICT

The current `ApiErrorResponse` has no `code` field and no structured details. The smallest compatible extension adds two optional fields:

```ts
interface ApiErrorResponse {
  error: string;
  requestId: string;
  code?: string;                       // e.g. 'BUILD_VERSION_CONFLICT'
  details?: Record<string, unknown>;   // structured context for the error code
}
```

This is backward-compatible: existing `{ error, requestId }` responses are unaffected. Module-level error handlers continue to produce `{ error, requestId }`. Only the builds module adds `code` and `details` for conflict responses.

### BUILD_VERSION_CONFLICT 409 Response

```json
{
  "error": "Build version conflict",
  "requestId": "550e8400-...",
  "code": "BUILD_VERSION_CONFLICT",
  "details": {
    "expectedVersion": 3,
    "currentVersion": 5,
    "latestBuild": { "...full build DTO..." }
  }
}
```

The `latestBuild` in `details` lets the client reconcile without an additional GET. `latestBuild` is mandatory and uses the same canonical Build DTO already returned by `GET /api/v1/builds/:publicId` — no separate serialization, summary substitution, or re-fetch fallback.

---

## 6. Endpoint Design

### Active Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/builds` | Create new build, return publicId |
| GET | `/api/v1/builds/:publicId` | Get build with items, compatibility, pricing |
| PATCH | `/api/v1/builds/:publicId` | Update name or constraints |
| PUT | `/api/v1/builds/:publicId/items/:slot` | Add or replace the single selected product in a slot |
| DELETE | `/api/v1/builds/:publicId/items/:slot` | Clear a slot (remove the item) |
| POST | `/api/v1/builds/:publicId/validate` | Full compatibility re-evaluation |
| GET | `/api/v1/builds/:publicId/candidates/:slot` | Candidate products for a slot with compatibility grouping |
| GET | `/api/v1/builds/:publicId/purchase-plan` | Shopping list with store links |

**Not in scope:** No multi-item POST endpoint. PUT handles add/replace for all slots including RAM (quantity 1–4 of the same kit) and Storage (quantity 1–8 of the same device). DELETE clears a slot entirely.

### Add/Replace Flow (PUT)

1. Validate product exists and is active.
2. Validate build eligibility (bundles are NOT\_ELIGIBLE → 400).
3. Validate slot matches product category.
4. Validate quantity within slot limits (RAM: 1–4, Storage: 1–8, others: exactly 1).
5. Replace the existing item in the slot (or insert if slot was empty). Increment version atomically.
6. Evaluate affected rules (incremental).
7. Recalculate pricing snapshot.
8. Return full updated Build DTO.

### Optimistic Concurrency

- Build carries `version` number.
- Mutation requests (PUT items, PATCH build, DELETE item) carry `expectedVersion` in request body.
- Repository performs: `UPDATE builds SET ... version = version + 1 WHERE publicId = ? AND version = ?`
- If 0 documents updated → HTTP 409 with `BUILD_VERSION_CONFLICT` (see §5).
- Build mutation + version update is a single-document operation — no transaction needed (TDD §24.4).

---

## 7. Compatibility Engine Package

`packages/compatibility-engine` does not currently exist. Phase 0 scaffolds the minimal pure zero-infrastructure package needed by the Persistent Build API.

### What the scaffold contains

- A `CompatibilityEngine` with a default evaluator and deterministic status reducer.
- The rule registry interface and candidate classification interface (types only).
- No compatibility rules registered.
- No fact extractors.
- No advanced classification or scoring logic.
- No infrastructure dependencies (no MongoDB, no Express, no Angular).

### Evaluation behavior

With no registered rules or when required facts are missing, the default evaluator deterministically returns **UNKNOWN** for every slot — never PASS. The status reducer propagates UNKNOWN to the overall `BuildCompatibilityStatus` per its rules (§4).

### Architecture boundary

The pure package owns the default evaluator and status behavior. API services (`apps/api`) orchestrate it — calling evaluate on item mutation and validate, calling classify on candidates. No compatibility business logic lives in Express route handlers or API service classes. This scaffold is supporting infrastructure inside Phase 0, not a separate delivery phase and not rule expansion.

### Deferred beyond this plan

All real rule implementation, rule expansion, fact extraction, activation gating, and advanced scoring are explicitly deferred. When rules are added in the future, they plug into the registry interface the scaffold defines.

---

## 8. Delivery Phases

---

### Phase 0: Persistent Build API

**Objective:** Implement the Build model, MongoDB repository, REST endpoints with optimistic concurrency, scaffold `packages/compatibility-engine` (minimal pure package, no rules), and wire compatibility evaluation into item mutations and validation.

**Bounded scope:**
- Scaffold `packages/compatibility-engine`: pure zero-infrastructure package with default evaluator (no rules → UNKNOWN), status reducer, registry/classification interfaces.
- Build domain model with 7 slots, version field, publicId.
- MongoDB `builds` collection with unique index on `publicId` and index on `updatedAt`.
- Build repository: CRUD, optimistic concurrency (409 on version mismatch).
- 8 REST endpoints (§6).
- `ApiErrorResponse` extension with `code` and `details` (§5).
- PUT add/replace flow with quantity validation.
- Candidate endpoint with compatibility grouping and pagination.
- Purchase plan endpoint returning shopping list DTO.
- Bundle ineligibility enforcement on item add.

**Affected projects/files (planning level):**
- `packages/database` — BuildDocument schema, BuildRepository.
- `packages/contracts` — `ApiErrorResponse` extension, Build DTOs, PurchasePlanDto.
- `packages/compatibility-engine` — scaffold in Phase 0 (pure package, no rules, no infrastructure).
- `apps/api/src/modules/builds/` — controller, service, repository, routes, schemas, mapper, tests.

**Dependency/prerequisite:**
- `mongodb-memory-server` must be declared in `package.json` for integration tests.
- Build slots, compatibility types, and domain models must exist in `packages/domain` (create if missing).
- `packages/compatibility-engine` does not exist; Phase 0 scaffolds it as part of the build API work.

**Implementation tasks:**

1. **Domain types** — Add `BuildSlot`, `BuildItem`, `BuildStatus`, `BuildCompatibilityStatus`, `CandidateCompatibilityGroup` to `packages/domain` (if not present).
2. **Contracts** — Add Build DTOs (request/response), PurchasePlanDto, extend `ApiErrorResponse` with `code?: string` and `details?: Record<string, unknown>`.
3. **Database** — BuildDocument Mongoose schema (7 slots, version, publicId with `crypto.randomUUID()`), BuildRepository (CRUD, optimistic concurrency, publicId lookup), indexes.
4. **Scaffold `packages/compatibility-engine`** — Create the minimal pure zero-infrastructure package: `CompatibilityEngine` class with default evaluator (no rules registered → UNKNOWN for all slots), deterministic status reducer, rule registry interface (types only), candidate classification interface (types only). Tests: default evaluator returns UNKNOWN deterministically, status reducer propagates UNKNOWN correctly.
5. **Build module in API** — Controller (HTTP mapping), Service (use-case orchestration), Routes (Express router), Schemas (Zod validation for request bodies including `expectedVersion`), Mapper (Document ↔ DTO). No compatibility business logic in controllers or services — orchestrate the engine package only.
6. **PUT /items/:slot** — Add/replace single product, quantity validation (RAM 1–4, Storage 1–8, others exactly 1), version increment, invoke compatibility engine for incremental evaluation, pricing recalculation.
7. **DELETE /items/:slot** — Clear slot, version increment, re-evaluate via engine.
8. **POST /validate** — Invoke full engine evaluation, return updated build.
9. **GET /candidates/:slot** — Fetch products by category, classify by compatibility against current build using the engine, paginate, return grouped results with topReasons. No advanced scoring or ranking.
10. **GET /purchase-plan** — Aggregate items with current offers/pricing, return shopping list with store links and availability.
11. **409 conflict response** — Implement `BUILD_VERSION_CONFLICT` with `code` + `details` including `expectedVersion`, `currentVersion`, `latestBuild`.
12. **publicId recovery** — On GET /builds/:publicId, store latest publicId in localStorage (web concern, but API must support lookup by publicId reliably).

**Focused tests/validation:**
- `nx run database:test` — Build CRUD, optimistic concurrency (409), publicId uniqueness.
- `nx run compatibility-engine:test` — Default evaluator returns UNKNOWN for all slots (no rules), status reducer determinism, registry interface contract.
- `nx run api:test` — Supertest for all 8 endpoints: happy paths, 404, 400 (bad slot, bad quantity, bundle ineligibility), 409 (version conflict).
- UNKNOWN invariant tests: PUT/validate endpoints return UNKNOWN (not PASS) when the engine scaffold has no rules — verified by integration tests.
- `nx run api:lint`, `nx run api:typecheck`, `nx run api:build` — clean.
- `nx run compatibility-engine:lint`, `nx run compatibility-engine:typecheck` — clean.

**Acceptance criteria:**
- [ ] Build model supports exactly 7 slots with correct quantity limits.
- [ ] PUT add/replace works for all 7 slots; POST items endpoint does not exist.
- [ ] Optimistic concurrency returns 409 with `code: "BUILD_VERSION_CONFLICT"`, `expectedVersion`, `currentVersion`, and `latestBuild` in `details`.
- [ ] Public IDs are non-sequential with ≥128 bits cryptographic entropy.
- [ ] Bundle products rejected with 400 on item add.
- [ ] Compatibility evaluation runs on PUT, DELETE, and POST validate.
- [ ] Candidate endpoint returns products grouped by compatibility status.
- [ ] Purchase plan endpoint returns shopping list with store links.
- [ ] No scraping or store-adapter imports in API code.
- [ ] `ApiErrorResponse` extension is backward-compatible (existing error responses unchanged).
- [ ] `packages/compatibility-engine` exists as a pure zero-infrastructure package with default evaluator, status reducer, and registry/classification interfaces (types only).
- [ ] UNKNOWN invariant: engine scaffold with no rules returns UNKNOWN (not PASS) for all slots — verified by package tests and API integration tests.

**Stop gate:** All API and compatibility-engine tests pass (including UNKNOWN invariant tests). No boundary violations. Engine scaffold contains no rules, no fact extractors, no infrastructure imports. Swagger docs updated for new endpoints.

---

### Phase 1: Real Builder + Purchase Plan

**Objective:** Migrate the web builder from presentation shell to API-driven behavior with live compatibility results, and wire the purchase plan page to the real API.

**Bounded scope:**
- Builder API service layer (HTTP client, state management).
- Builder page wiring: create build on first visit, hydrate on return, handle 409 conflicts.
- Component selection drawer: real products from candidate endpoint, compatibility badges, selection via PUT.
- Compatibility display: per-slot indicators, overall status banner, evidence drawer.
- Purchase plan page: fetch from API, display items with prices/availability/store links, redirect-only behavior.
- Bundle ineligibility: bundles never shown as candidates.
- localStorage: store only publicId.

**Affected projects/files (planning level):**
- `apps/web/src/app/features/builder/` — data-access layer (API service, store, query service), page component, slot components, selection drawer, summary panel.
- `apps/web/src/app/features/purchase-plan/` — page component, item list, redirect behavior.

**Dependency/prerequisite:** Phase 0 complete — Build API endpoints operational.

**Implementation tasks:**

1. **Builder API service** (`features/builder/data-access/builder-api.service.ts`) — HTTP calls to all build endpoints.
2. **Builder store** (`features/builder/data-access/builder.store.ts`) — State management for build state, compatibility, candidates.
3. **Builder query service** — Derived state selectors (compatibility status, pricing, slot fill state).
4. **Wire builder page** — First visit → POST /builds → store publicId in localStorage. Return visit → GET /builds/:publicId → hydrate. 409 → prompt user or auto-reconcile with latestBuild.
5. **Upgrade selection drawer** — Wire search/filter to GET /candidates/:slot. Selection → PUT /items/:slot. Compatibility group badges (COMPATIBLE, WARNING, UNKNOWN, INCOMPATIBLE). Top reasons on card, full details in drawer. Incompatible selection requires confirmation.
6. **Compatibility display** — Per-slot compatibility indicators. Overall build status banner. Evidence drawer for rule details.
7. **Purchase plan page** — Fetch from GET /builds/:publicId/purchase-plan. Display items with prices, availability, last-seen timestamps. "Open at Sigma" button opens sourceUrl in new tab. Client-side checklist for opened items. Disclaimer about redirect-only behavior. Missing prices shown honestly (no fabrication).
8. **Bundle handling** — Bundles excluded from candidate lists. `buildEligibility = NOT_ELIGIBLE` enforced.

**Focused tests/validation:**
- `nx run web:test` — Component tests for builder store, selection behavior, compatibility badges, purchase plan display.
- `nx run web:lint`, `nx run web:typecheck`, `nx run web:build` — clean.

**Acceptance criteria:**
- [ ] Create build, select products, view compatibility — all work via real API.
- [ ] 409 conflict handled gracefully with user feedback.
- [ ] localStorage stores only publicId (no build payload).
- [ ] Candidate drawer shows real products with compatibility grouping.
- [ ] Incompatible product selection requires explicit confirmation.
- [ ] Build reload preserves state from API.
- [ ] Purchase plan page shows real data from API with store redirect links.
- [ ] No payment processing. Redirect-only behavior.
- [ ] Bundles never appear as candidates.
- [ ] Guest route `/builder/:publicId` works for resume.

**Stop gate:** Builder and purchase plan pages functional against real API. No fixture/mock data in production code paths.

---

### Phase 2: Full User Journey E2E

**Objective:** Validate the complete user journey end-to-end, harden edge cases, add E2E tests, and ensure documentation is current.

**Bounded scope:**
- E2E test covering: create build → select products across all 7 slots → view compatibility → resolve conflicts → view purchase plan → verify redirect links.
- Edge-case coverage: empty build, single-slot build, all-slots build, conflicting concurrent edits, missing product, inactive product, bundle rejection.
- Compatibility invariant verification: missing facts → UNKNOWN in E2E.
- Documentation update: README, API docs, and this plan updated to reflect final state.
- Performance sanity: builder page loads within acceptable thresholds, candidate search responsive.

**Affected projects/files (planning level):**
- `apps/web/e2e/` — Playwright/Cypress E2E tests for builder and purchase plan.
- `apps/api/src/modules/builds/builds.test.ts` — Additional integration test cases.
- Documentation files.

**Dependency/prerequisite:** Phase 0 and Phase 1 complete.

**Implementation tasks:**

1. **E2E test: Full builder flow** — Create build, select a product for each of the 7 slots, verify compatibility results, handle a simulated 409, verify purchase plan.
2. **E2E test: Edge cases** — Empty build validation, single-slot build, bundle rejection, missing/inactive product handling.
3. **Concurrency test** — Simulate two clients editing the same build, verify 409 and reconciliation.
4. **UNKNOWN invariant test** — Verify that slots with missing compatibility facts produce UNKNOWN (not PASS) in the UI.
5. **Documentation** — Update README, API endpoint documentation, and this plan with final status.
6. **Performance sanity** — Builder page initial load, candidate search response time, compatibility evaluation latency on PUT.

**Focused tests/validation:**
- `nx run web:e2e` — Full E2E flow tests.
- `nx run api:test` — Additional edge-case integration tests.
- Full monorepo lint, typecheck, test, build at milestone checkpoint.

**Acceptance criteria:**
- [ ] Full user journey E2E test passes: create → select → validate → purchase plan → redirect.
- [ ] All edge cases covered with tests.
- [ ] Concurrent edit produces 409 and client reconciles correctly.
- [ ] Missing compatibility facts produce UNKNOWN in UI (never PASS).
- [ ] Documentation current and accurate.
- [ ] No regressions in existing functionality.

**Stop gate:** All E2E tests pass (full builder flow, edge cases, concurrency, UNKNOWN display). All focused API integration tests pass. Full monorepo lint, typecheck, test, and build clean. Plan status updated to complete.

---

## 9. Architecture Boundaries

These rules remain in effect and are enforced in every phase:

- `apps/web` must not import database or store-adapter code.
- `apps/api` must never scrape an external store. Must not depend on `sigma-adapter` or `scraping-core`.
- `packages/domain` must not depend on Angular, Express, MongoDB, or any infrastructure.
- `packages/contracts` contains transport DTOs and shared enums — not database models.
- `apps/worker` owns all ingestion (not in this plan's scope, but boundary preserved).
- Raw scraped data remains immutable after capture.
- Bundles are visible in the catalog but cannot be selected as PC builder components.
- The platform does not process payments. Users are redirected to the original store.

---

## 10. Resolved Design Decisions

| Decision | Resolution | Source |
|----------|-----------|--------|
| Build retention | Indefinite during Fast Track; `expiresAt = null` | Resolved requirement |
| Guest route | `/builder/:publicId` | Resolved requirement |
| Public ID entropy | ≥128 bits, non-sequential (`crypto.randomUUID()`) | Resolved requirement |
| Purchase behavior | Redirect-only to Sigma; no cart, no checkout, no payment | TDD §18.2, ADR-000 |
| Bundle eligibility | Catalog-visible, `buildEligibility = NOT_ELIGIBLE`, never in candidates | TDD §17.1 |
| One product per slot | Single product + quantity; no multi-product arrays | Assigned task |
| RAM quantity | 1–4 kits | Resolved requirement |
| Storage quantity | 1–8 devices | Resolved requirement |
| Other slot quantity | Exactly 1 | Assigned task |
| Missing facts | UNKNOWN, never PASS | Assigned task |
| Cooler / Case Fans | Deferred from active models entirely | Assigned task |
| POST items endpoint | Removed; PUT handles add/replace | Assigned task |
| Error format | Extend `ApiErrorResponse` with optional `code` + `details`; no Problem Details | Assigned task |
| Quality reports | Separate category-level store, not embedded in product facts | Assigned task |

---

## 11. Explicit Deferred Items

| Item | Reason |
|------|--------|
| Compatibility-facts extraction pipeline (worker) | Not needed for user-feature delivery; Phase 0 scaffold evaluates with no rules → UNKNOWN |
| Full 17-rule P0 matrix authoring and activation gating | No rules authored in these phases; Phase 0 scaffold has no registered rules |
| CMP-CPU-MB-002 (CPU support/BIOS rule) | Requires chipset reference data not available |
| CMP-STORAGE-MB-001 (Storage↔Motherboard rule) | Both sides must pass quality gate first |
| CPU Cooler slot, rules, facts, extractors | Not in active 7-slot model |
| Case Fans slot, rules, facts, extractors | Not in active 7-slot model |
| `packages/normalization` production implementation | Out of current scope |
| `packages/product-matching` production implementation | Out of current scope |
| Performance-based suggestion scoring | No performance score in Fast Track |
| Category quality gate evaluation and reporting store | Documented in §3; implementation deferred |
| Build TTL / expiry configuration | Fixed: builds retained indefinitely |
| Admin backend | M7 scope |
| Production scraper closure | Deferred |
| Scheduler / deployment | Deferred |
| Second store | Deferred |
| Multi-factor advanced scoring / ranking | Deferred |
| Green Validation phase | Merged into Phase 2 E2E |

---

## 12. Documentation Sections Consulted

- ADR-000 §2 (Project Context), §3 (ADR-000.1–.23), §4, §5, §9, §10
- TDD §15 (Compatibility Engine), §16 (PC Builder), §17 (Bundles), §18 (Purchase Plan), §19.5 (Endpoints), §24 (Database), §33 (Phases), §37 (Definition of Done)
- `packages/contracts/src/index.ts` — `ApiErrorResponse` type (current error format)
- `apps/api/src/app.ts` — `createErrorResponse` function and error middleware
- `apps/api/src/app.test.ts` — Error response shape assertions
- Audit: `BuildSense_TDD_Current_State_Audit.md`
