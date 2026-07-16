# BuildSense TDD Audit

## Executive Summary

This audit compares the repository on branch `m4/catalog-ui` with the official milestone definitions and exit criteria in TDD section 33, applying accepted ADR overrides where they are more specific. The worktree was clean before this report was created. The reviewed baseline contains 11 Nx projects and the following milestone-bearing commits, newest first: `82ffe03`, `6e35f1d`, `f896084`, `b8ab918`, `84a9434`, `5d67cc5`, `ef550b2`, `ab4ef38`, `388cf23`, `ba6b9d5`, `dc4e8fe`, `6339d62`, `1046425`, and `bf1eb5d`.

The official MVP, M0 through M10, is approximately **40% complete**. M1 is complete. M2 has a substantial production implementation, but the open high-severity pagination defect prevents a reliable full crawl and therefore blocks the official dependency chain. Later work was intentionally or pragmatically performed out of sequence: a one-time M3/M4 bootstrap path, an M5-lite catalog API, a strong M6-oriented frontend, and a custom comparison feature all exist. They are useful demo capabilities, but they do not replace the missing production M2-M4 pipeline.

The current practical official milestone is **M2 - Raw Scraper completion**. The immediate validation blocker is separately critical: `mongodb-memory-server` is imported by test infrastructure but absent from every `package.json` and `package-lock.json`. The recorded local command `npx nx run-many -t lint,typecheck,test,build` exited 1 after 44 targets: 35 passed and 9 failed, specifically the `database`, `scraping-core`, and `api` build, typecheck, and test targets. The import/collection problem caused seven suites to fail; 54 test files and 588 tests passed, with no individual assertion failure. All 11 lint targets passed with 23 warnings, one in `database` and 22 in `scraping-core`. Vitest also warns that `environmentMatchGlobs` is deprecated.

Frontend-specific local evidence is strong: `npx nx run web:e2e` passed 111/111 tests and `web:e2e-visual` passed 34/34 tests. These are automated and generated evidence only; they are not a claim of manual screenshot approval or live-backend end-to-end proof. GitHub CI was not executed as part of this audit. `.github/workflows/ci.yml`, introduced by `bf1eb5d`, runs `npm ci`, lint, typecheck, test, build, and format checking, but a clean CI run is expected to fail because the missing test package is present in neither the manifests nor the lock file.

## Milestone Status Table

| Milestone | Official objective | Status | Completion | Exit criteria |
|---|---|---:|---:|---|
| M0 Foundation | Buildable, testable repository with web, API, worker, database, configuration, logging, health, and CI | PARTIAL | 85% | Not met: root validation and expected clean CI are broken |
| M1 Sigma Data Discovery | Understand Sigma responses and establish fixtures, parser spikes, and Data Dictionary v0.1 | COMPLETE | 100% | Met |
| M2 Raw Scraper | Idempotent, observable discovery, fetch, and raw snapshot pipeline | PARTIAL | 70% | Not met: reliable full pagination and current integration verification are blocked |
| M3 Classification/Normalization | Convert raw snapshots into consistent store listings | PARTIAL | 15% | Not met: only a one-time bootstrap transform exists |
| M4 Product Identity/Publishing | Create stable canonical products and linked offers | PARTIAL | 10% | Not met: only one-time direct publishing exists |
| M5 Catalog API/Search | Stable searchable and filterable catalog API | PARTIAL | 50% | Not met: core API exists, official search/filter/detail requirements remain incomplete |
| M6 Catalog Web UI | Complete catalog experience before Builder | PARTIAL | 80% | Not met: route, bundle, facets/autocomplete, canonical data, and live proof gaps remain |
| M7 Admin | Manage match review and data-quality issues without editing raw data | NOT STARTED | 0% | Not met: placeholder only |
| M8 Compatibility | Independent, versioned P0 compatibility rule engine | NOT STARTED | 0% | Not met |
| M9 Build API/UI | Persistent PC build journey with compatibility and suggestions | UI ONLY | 15% | Not met: presentation shell only |
| M10 Purchase Plan/Scheduling/Hardening | Demo-ready MVP with purchase plan, safe scheduling, operations, deployment, and full regression | PARTIAL | 10% | Not met: isolated UI and lock-heartbeat work only |
| M11 Second Store | Add a second store after M10 | DEFERRED | 0% | Correctly deferred by the TDD |

## Detailed Milestone Audit

### M0 - Foundation

1. **Milestone name/objective:** M0 Foundation. Establish a repository that builds and tests, runs web/API/worker with MongoDB, centralizes configuration and database access, provides logging and health checks, and validates through CI.
2. **Status:** PARTIAL (85%).
3. **Implemented:** npm workspaces and Nx orchestration; Angular web app; Express TypeScript API; worker CLI; shared TypeScript, ESLint, and Prettier configuration; Zod-backed configuration package; Mongoose database package; Pino logging and request IDs; `/health/live`, `/health/ready`, and `/api/health`; Vitest/Supertest setup; root commands; README setup; and GitHub Actions CI. The API and worker share configuration/database infrastructure. ADR-001 validly replaces local Docker Compose with MongoDB Atlas, so the absence of local Docker files is not a current M0 violation.
4. **Missing:** A clean root build/typecheck/test result and credible green clean-clone CI. `mongodb-memory-server` must be declared and locked. README content is stale and does not describe the current packages or capabilities. Branch-rule enforcement was not verifiable from repository files.
5. **Exact evidence:** `package.json`; `nx.json`; `.github/workflows/ci.yml`; `.nvmrc`; `.env.example`; `apps/web`; `apps/api/src/app.ts` and `createApp`; `apps/api/src/modules/health/health.routes.ts`; `apps/worker/src/commands/health.ts`; `packages/config`; `packages/database`; `packages/observability`; `README.md`; ADR-000; ADR-001; commit `bf1eb5d`. Baseline validation: 44 Nx targets, 35 passed and 9 failed; all 11 lint targets passed with 23 warnings; 54 test files and 588 tests passed; seven suites failed import/collection because `mongodb-memory-server` is undeclared; no assertion failed.
6. **Exit criteria verdict:** **Not met.** The architecture and CI workflow exist, but a clean clone is expected to fail build/typecheck/test and CI cannot currently be green.
7. **Blockers/risks/debt:** Critical missing test dependency; stale setup documentation; root/web TypeScript version inconsistency (`~5.8.0` at root and `~5.6.0` in `apps/web/package.json`); Vitest deprecation warning; lint warnings. CI does not run Playwright.
8. **Dependencies before completion:** Declare and lock the intended hermetic MongoDB test dependency, restore green root validation, then verify clean-clone setup and CI behavior. No local Docker work is required under ADR-001.

### M1 - Sigma Data Discovery

1. **Milestone name/objective:** M1 Sigma Data Discovery. Understand real Sigma response data before a full crawler and establish the initial data dictionary.
2. **Status:** COMPLETE (100%).
3. **Implemented:** Access-policy review; HTTP-first decision; nine verified category seeds; 11 category and 20 product HTML fixtures; manifest; first, middle, and terminal pagination coverage; price, stock, variant, bundle, and missing-spec cases; candidate selectors; RSC extraction; fixture-backed category/product parser spikes; 129 unique raw specification labels; inventory; and Data Dictionary v0.1.
4. **Missing:** No milestone-blocking item identified. Live drift remains an expected future operational risk, not an unmet M1 criterion.
5. **Exact evidence:** `fixtures/sigma/manifest.json`; 11 files under `fixtures/sigma/category-pages`; 20 files under `fixtures/sigma/product-pages`; `docs/discovery/sigma-data-discovery-report.md`; `docs/discovery/spec-label-inventory.csv`; `docs/discovery/data-dictionary-v0.1.md`; `packages/sigma-adapter/src/category-seeds.ts`; `parse-category-page.ts`; `parse-product-page.ts`; `rsc-extract.ts`; `fixture-regression.test.ts`; parser tests and snapshots; ADR-002; commit `1046425`.
6. **Exit criteria verdict:** **Met.** Representative fixture and edge coverage exists, ADR-002 records that no observed route needs Playwright, and parser tests preceded the production scraper.
7. **Blockers/risks/debt:** Sigma RSC and HTML formats can drift. Product parsing still depends on valid RSC product data, as documented by ADR-002.
8. **Dependencies before completion:** None. M1 is complete; future parser drift belongs to maintenance or M2 operations.

### M2 - Raw Scraper

1. **Milestone name/objective:** M2 Raw Scraper. Implement idempotent and observable Sigma discovery, fetch, and reusable raw snapshots.
2. **Status:** PARTIAL (70%).
3. **Implemented:** `StoreScraperAdapter`; `SigmaScraperAdapter`; `Orchestrator`; `SigmaBootstrapImporter`; `SnapshotStore`; robots evaluation; same-domain and health gates; request policy, retry, concurrency, and rate settings through Crawlee; failure classification; scrape run and item state; worker locking and heartbeat; models for ScrapeRun, ScrapeRunItem, RawProductSnapshot, DiscoveredProduct, and WorkerLock; gzip and content-hash snapshot storage; and CLI full/category/url/bootstrap/live-sample surfaces. Run status has invariant tests, including incomplete-category status behavior.
4. **Missing:** Reliable execution of dynamically enqueued pagination pages, terminal audit completion for every enabled category, and audited production full-run evidence. Current package resolution also prevents integration suites from being collected. The open bug's exact live queue-draining behavior is not reproduced by the existing orchestrator test.
5. **Exact evidence:** `packages/contracts/src/ports.ts` (`StoreScraperAdapter`); `packages/sigma-adapter/src/sigma-scraper-adapter.ts` (`SigmaScraperAdapter`); `packages/scraping-core/src/orchestrator.ts` (`Orchestrator`); `bootstrap-import.ts` (`SigmaBootstrapImporter`); `snapshot-store.ts` (`SnapshotStore`); `robots-evaluator.ts`; `health-gates.ts`; related unit tests; `packages/database/src/models/{scrape-run,scrape-run-item,raw-product-snapshot,discovered-product,worker-lock}.ts`; database repositories and tests; `apps/worker/src/commands/sigma.ts`; `apps/worker/src/cli/run-cli.ts`; ADR-003; `docs/BUGS/M2-BUG-001.md` (OPEN, High, M3 blocker); commits `6339d62` and `dc4e8fe`.
6. **Exit criteria verdict:** **Not met.** Idempotency and audit structures are substantial, but a production full run cannot yet prove complete pagination. The missing test dependency prevents current integration verification.
7. **Blockers/risks/debt:** `M2-BUG-001` can leave categories `completed=false` after only a subset of pages. It correctly produces `PARTIALLY_FAILED` rather than a false `SUCCEEDED`; this is a completeness defect, not five failing assertions. Raw snapshots use SHA-256, gzip, atomic write, distinct content paths, and no repository update API, providing application-level immutability only; there is no database-level immutable enforcement. Filesystem snapshots are intentionally non-production-scale under ADR-003.
8. **Dependencies before completion:** First restore package resolution and green integration validation. Then fix dynamic pagination, prove every enabled category reaches a terminal state, and run an idempotent/resumable, auditable full crawl under retry, rate, lock, and health-gate controls.

The separate bootstrap workaround is successful but is not production-crawler completion. It pre-generates category pages and bypasses the dynamic Crawlee queue. Local gitignored artifacts under `data/bootstrap` report 130/130 pages processed, 1,984 unique URLs, 1,963 fetched/parseable products, and 21 fetch/parse failures; the one-time normalization reports 1,962 normalized with one rejection, and publishing reports 1,962 published. Only `data/bootstrap/.gitignore` is tracked, so these artifacts are not a clean-clone dataset or proof of the production orchestration path.

### M3 - Classification and Normalization

1. **Milestone name/objective:** M3 Classification and Normalization. Convert raw snapshots into consistent store listings for all supported categories with explicit quality handling and versioned reprocessing.
2. **Status:** PARTIAL (15%).
3. **Implemented:** A meaningful one-time bootstrap normalizer processed the local bootstrap dataset, yielding 1,962 normalized records and one rejected record.
4. **Missing:** A production `normalization` package; domain taxonomy; reusable text, price, availability, unit, and category parsers; brand aliases; label mapping; category schemas; conflict detection; quality scoring; search-term generation; normalizer versioning; reprocess command; data-quality issue repository; Data Dictionary v1.0; per-category quality reports; and table-driven production tests.
5. **Exact evidence:** `scripts/sigma-one-time-normalize.mjs`; local gitignored `data/bootstrap/normalization-manifest.json`; commit `ba6b9d5`; absence of a `packages/normalization` project among the 11 Nx projects. `docs/BUGS/M2-BUG-001.md` explicitly identifies complete terminal pagination as an M3 prerequisite.
6. **Exit criteria verdict:** **Not met.** The bootstrap result demonstrates a one-time transform, not a versioned production pipeline in which every discovered listing has a normalized result or durable rejection/review reason.
7. **Blockers/risks/debt:** Production M2 pagination is incomplete. The fast-track script is coupled to local gitignored bootstrap artifacts and lacks production quality/reprocess infrastructure.
8. **Dependencies before completion:** Green validation and official M2 completion, followed by taxonomy and normalization package design against complete raw data.

### M4 - Product Identity and Publishing

1. **Milestone name/objective:** M4 Product Identity and Publishing. Establish stable canonical products, linked offers, matching review, price events, and offer lifecycle behavior.
2. **Status:** PARTIAL (10%).
3. **Implemented:** `CatalogProduct` and `Offer` Mongoose models and a one-time publisher that loaded 1,962 locally normalized bootstrap records. Offer uniqueness is enforced on `storeCode + storeExternalId`, with an index on `catalogProductId`.
4. **Missing:** A `product-matching` package; canonical keys; aliases; exact matching; candidate blocking/scoring; contradiction rules; match review creation; stable identity across production runs; bundle-vs-component safeguards in matching; PriceEvent model; one-event-per-change behavior; missing-offer lifecycle; pricing summaries; and review CLI/reporting.
5. **Exact evidence:** `packages/database/src/models/catalog-product.ts` (`CatalogProductModel`); `packages/database/src/models/offer.ts` (`OfferModel`); `scripts/sigma-one-time-publish.mjs`; local gitignored `data/bootstrap/publish-manifest.json`; commits `ba6b9d5` and `388cf23`; no PriceEvent model and no `packages/product-matching` project.
6. **Exit criteria verdict:** **Not met.** Direct one-time publishing does not prove stable identity, safe automatic matching, review handling, offer lifecycle, or price-event idempotency.
7. **Blockers/risks/debt:** M2 and production M3 are incomplete. Current published records can support a demo catalog but are not evidence of a canonical catalog pipeline.
8. **Dependencies before completion:** Complete M2, implement production M3, then add identity extraction, matching/review, aliases, lifecycle, and event persistence before claiming canonical publication.

### M5 - Catalog API and Search

1. **Milestone name/objective:** M5 Catalog API and Search. Expose a stable searchable/filterable canonical catalog API.
2. **Status:** PARTIAL (50%).
3. **Implemented:** Real endpoints for categories, product listing, product detail, and offers; raw-regex search over title, brand, model, and MPN; category/brand/price filters; sorting; pagination; Mongo-backed service logic; Swagger UI; health routes; and API tests.
4. **Missing:** Filter-definition API; real facet aggregation in the response contract; suggestions/autocomplete; normalized search and ranking proof; price-history endpoint; canonical specifications; Problem Details error format; Zod validation at the HTTP DTO boundary; production indexes beyond category and brand on `CatalogProduct`; explain-plan/index review; full-dataset performance evidence; and proof that exact model/MPN ranks first.
5. **Exact evidence:** `apps/api/src/modules/catalog/catalog.routes.ts` routes `/api/v1/categories`, `/api/v1/products`, `/api/v1/products/:id`, and `/api/v1/products/:id/offers`; `catalog.controller.ts`; `catalog.service.ts` (`CatalogService`, raw `RegExp` search, match/sort/pagination pipeline); `catalog.test.ts`; `apps/api/src/app.ts` (`/api/docs`, `/health`, `/api/health`); `packages/database/src/models/catalog-product.ts` category and brand indexes; `offer.ts` unique store/external ID and product indexes; commit `388cf23`.
6. **Exit criteria verdict:** **Not met.** Basic catalog use is real, but canonical-field filters/specs, ranking, price history, and performance criteria are unproven or unavailable.
7. **Blockers/risks/debt:** The API is downstream of one-time publishing rather than production M2-M4. Raw unindexed regex search will not establish required ranking or scale. CORS is permissive; Helmet is present. Request DTOs are manually parsed rather than Zod-validated. Frontend API DTOs are local while `packages/contracts` currently contains crawler contracts; this is a contract-centralization gap against the TDD, not evidence of a literal duplicate implementation or forbidden import.
8. **Dependencies before completion:** Production M4 canonical data, then contracts, validation/error semantics, canonical search/filter/facet behavior, price history, indexing/explain review, and full-dataset integration/performance proof.

### M6 - Catalog Web UI

1. **Milestone name/objective:** M6 Catalog Web UI. Deliver a responsive, accessible catalog journey with search, filtering, product details, bundle handling, and outbound Sigma links before Builder.
2. **Status:** PARTIAL (80%).
3. **Implemented:** Application shell; responsive catalog at `/`; `/catalog` redirect preserving query parameters; API-driven category/product listing; search, category/brand/price filtering, sorting, pagination, active filters, loading/error/empty states, and URL synchronization; API-driven `/products/:productId` details and offers; outbound store links; catch-all route; extensive component/store tests; mocked Playwright flows; and accessibility checks. Custom `/compare` is complete as a separate capability, using URL state and two real product-detail requests.
4. **Missing:** The official list route `/products`; bundle badge; API-backed autocomplete; server facets/filter definitions; canonical specs; and a complete live-backend exit proof over the full valid catalog. Current route behavior uses `/` for the catalog and reserves `/products/:productId` for details.
5. **Exact evidence:** `apps/web/src/app/app.routes.ts`; `features/home/home.page.ts`; `features/catalog/data-access/{catalog.service,catalog.store,catalog-query.service,category.service}.ts`; catalog UI components; `features/product/product.page.ts`; product detail store/components; `features/compare/compare.page.ts`; compare store/query/search services; unit tests; `apps/web/e2e`; `apps/web/e2e-visual`; commits `ab4ef38`, `ef550b2`, `5d67cc5`, `84a9434`, `b8ab918`, `f896084`, and `82ffe03`. Recorded local results: `web:e2e` 111/111 and `web:e2e-visual` 34/34.
6. **Exit criteria verdict:** **Not met.** The mocked catalog journey is strong, but complete live-data visibility, bundle-specific behavior, and official API-supported facets/canonical data are not proven.
7. **Blockers/risks/debt:** The frontend depends on M5-lite and bootstrap-published data. `apps/web/src/app/app.config.ts` hardcodes `http://localhost:3000` without production environment wiring. `apps/web/src/app/features/catalog/catalog.page.ts` is unreferenced. Duplicated generated screenshots exist under `apps/web/apps/web/e2e/screenshots/`. The empty legacy directory `apps/web/src/app/features/product-details/` remains, while the real API-driven Product Details implementation lives under `apps/web/src/app/features/product/`. Automated screenshots are generated evidence, not manual visual approval.
8. **Dependencies before completion:** Complete the necessary M5 contracts and canonical data; add the official route/bundle semantics/autocomplete/facets; wire production API configuration; then run live-backend catalog E2E proof without hiding missing-spec products.

### M7 - Match Review and Data Quality Admin

1. **Milestone name/objective:** M7 Admin. Resolve match reviews and data-quality issues through authenticated, auditable application workflows without modifying raw snapshots.
2. **Status:** NOT STARTED (0%).
3. **Implemented:** A production `/admin` route and placeholder page communicate deferred status.
4. **Missing:** Admin token middleware; authentication and rate limiting; scrape-run pages; match-review and data-quality endpoints/UI; manual classification/mapping overrides; durable aliases; audit notes; and admin tests.
5. **Exact evidence:** `apps/web/src/app/app.routes.ts` route `/admin`; `apps/web/src/app/features/admin/admin.page.ts`; empty/placeholder API admin path; no admin routes in `apps/api/src/app.ts`.
6. **Exit criteria verdict:** **Not met.** No review can be resolved through the UI, no alias is created, and no administrative workflow exists.
7. **Blockers/risks/debt:** Production M3/M4 review entities do not exist. Security controls required for admin operations are absent.
8. **Dependencies before completion:** Production M3 quality issues and M4 match-review/alias infrastructure, followed by admin authentication, authorization, rate limiting, API, UI, and audit tests.

### M8 - Compatibility Engine

1. **Milestone name/objective:** M8 Compatibility Engine. Implement an independent, versioned rule engine with complete P0 rules, evidence, deterministic aggregation, and PASS/ERROR/UNKNOWN behavior.
2. **Status:** NOT STARTED (0%).
3. **Implemented:** No compatibility-engine capability. Some catalog and visual types contain presentation-shaped compatibility fields, but they do not implement rules.
4. **Missing:** The entire package, facts/context model, rule contract and registry, evidence model, category rules, state reducer, power estimation, candidate classification, suggestion scoring, rule versioning, tests, and rule matrix documentation.
5. **Exact evidence:** No `packages/compatibility-engine` project among the 11 Nx projects; no compatibility dependency in API routes; ADR-004 explicitly states that its frontend sequence does not supersede M8/M9 prerequisites.
6. **Exit criteria verdict:** **Not met.** No rules or PASS/ERROR/UNKNOWN tests exist.
7. **Blockers/risks/debt:** Compatibility requires stable canonical category specifications from M3-M5. UI shapes must not be mistaken for domain behavior.
8. **Dependencies before completion:** Complete canonical taxonomy/specification work and M5 data access, then build and test the independent engine before Builder integration.

### M9 - Build API and UI

1. **Milestone name/objective:** M9 Build API and UI. Provide a persistent PC-building journey with candidate selection, compatibility results, conflicts, suggestions, save/resume, and concurrency safety.
2. **Status:** UI ONLY (15%).
3. **Implemented:** An honest `/builder` presentation shell, input-driven view models, builder slots/summary/workspace components, a visual-only component-selection surface, isolated visual fixtures, and component/presentation tests.
4. **Missing:** Build collection/repository; API routes; guest public IDs; persistence; optimistic concurrency; cardinality rules; mutation/validate/candidate endpoints; real selection behavior; compatibility integration; conflict confirmation; resume; completion rules; and real Builder E2E flows.
5. **Exact evidence:** `apps/web/src/app/app.routes.ts` route `/builder`; `features/builder/builder.page.ts`; `builder-view.models.ts`; builder UI components and tests; `features/builder/ui/component-selection/component-selection-list.component.ts`, which explicitly identifies itself as a purely visual shell; `apps/web/src/visual/fixtures`; no API build routes or database Build model; ADR-004; commit `6e35f1d`.
6. **Exit criteria verdict:** **Not met.** A build cannot be saved, reloaded, validated, or classified by compatibility.
7. **Blockers/risks/debt:** M8 does not exist and M4/M5 canonical data remains incomplete. Component selection is visual-only by design and should not be labeled generic dead code.
8. **Dependencies before completion:** Complete M8, then implement build persistence/API/concurrency and connect real catalog candidates and compatibility results before enabling selection behavior.

### M10 - Purchase Plan, Scheduling, Hardening

1. **Milestone name/objective:** M10 Purchase Plan, Scheduling, and Hardening. Complete the displayable MVP, safely schedule updates, add operational evidence and runbooks, deploy staging, and prove scrape-to-store-link flow.
2. **Status:** PARTIAL (10%).
3. **Implemented:** An honest `/purchase-plan` presentation shell and view components/fixtures; scraper worker lock heartbeat; Pino logs, request IDs, run reports, robots checks, and scraper health gates.
4. **Missing:** Purchase-plan API and persistence; integration with saved builds and live offers; stale/last-checked semantics; scheduler; operational metrics system; required runbooks; deployment containers; staging; seed/demo fallback; full regression; updated architecture/demo documentation; and full scrape-to-purchase E2E proof.
5. **Exact evidence:** `apps/web/src/app/app.routes.ts` route `/purchase-plan`; `features/purchase-plan/purchase-plan.page.ts`; purchase view models/components/tests; visual purchase fixtures; `packages/database/src/models/worker-lock.ts`; `packages/scraping-core/src/orchestrator.ts`; `health-gates.ts`; `apps/api/src/app.ts`; ADR-003 lock-heartbeat decision; commit `6e35f1d`. No Docker files have been committed; while this is not an M0 violation under ADR-001, deployment containers remain an explicit M10 requirement.
6. **Exit criteria verdict:** **Not met.** There is no persistent purchase workflow, scheduler safety proof, reproducible staging deployment, or full production-data journey.
7. **Blockers/risks/debt:** Depends on M2-M9. Observability lacks metrics and operational runbooks. README remains an M0 document. The current purchase page must not be represented as a working purchase plan.
8. **Dependencies before completion:** Complete the upstream ingestion, canonical catalog, admin, compatibility, and persistent build milestones; then implement purchase persistence/API/UI, scheduling, metrics, runbooks, deployment, staging, and full regression.

### M11 - Second Store

1. **Milestone name/objective:** M11 Second Store. Add another adapter, source mappings, cross-store matching, multiple offers, comparison, and grouped purchase planning after M10.
2. **Status:** DEFERRED (0%).
3. **Implemented:** Store-neutral adapter boundaries and offer fields provide architectural groundwork only. No second store capability exists.
4. **Missing:** Second adapter, source mappings, cross-store review, multi-store offer UI, price comparison, and purchase-plan grouping.
5. **Exact evidence:** TDD section 33 states M11 must not start before M10; `packages/contracts/src/ports.ts` defines `StoreScraperAdapter`; `Offer` carries `storeCode`; only `packages/sigma-adapter` exists.
6. **Exit criteria verdict:** **Correctly deferred and not met.** No same-product multi-store offers exist.
7. **Blockers/risks/debt:** M10 and all upstream production capabilities are incomplete. Starting now would amplify unresolved identity and operational risks.
8. **Dependencies before completion:** Complete and harden M10 first, then add the second store without store-specific conditions in domain or API code.

## Frontend Capability Matrix

| Feature | UI | Real API | Persistence | Tests | Status |
|---|---|---|---|---|---|
| Catalog | Responsive list, search/filter/sort/pagination, states, URL sync | Yes, categories and products | URL query state only | Unit plus mocked E2E | PARTIAL |
| Product details | Gallery, raw specs, offers, outbound Sigma link | Yes, detail and offers | Route ID only | Unit plus mocked E2E | PARTIAL |
| Comparison | Two-product matrix, selectors, URL state | Yes, two detail requests and candidate search | URL query state | Unit plus mocked E2E | COMPLETE as custom capability |
| Admin | Deferred placeholder page | No | No | Route/shell coverage only | NOT STARTED |
| Builder | Presentation shell, slots, summary, visual selection surface | No | No | Component and visual-fixture tests | UI ONLY |
| Purchase plan | Presentation shell and review rows | No | No | Component and visual-fixture tests | UI ONLY |
| Visual fixture harness | Isolated `__visual/*` routes in a separate visual build | Mocked/route-intercepted only | No | `web:e2e-visual` 34/34 | COMPLETE as test harness |
| Accessibility | Automated catalog/details/compare and shared-component checks | Mocked API responses | Not applicable | Included in 111/111 web E2E plus unit checks | STRONG AUTOMATED BASELINE |

Production routes are `/`, `/catalog` as a redirect, `/compare`, `/products/:productId`, `/builder`, `/purchase-plan`, `/admin`, and a catch-all. Visual routes are isolated from the production route configuration. Builder and purchase-plan fixtures are presentation evidence only. No manual visual screenshot approval is claimed.

## Backend Capability Matrix

| Capability | Implementation | Tests | Production Ready | Status |
|---|---|---|---|---|
| Foundation/config/database | Nx workspaces, Zod config, Mongoose lifecycle, health | Broad unit/integration intent; current DB import collection blocked | No | PARTIAL |
| Sigma parser | RSC/HTML category parsing and RSC product parsing over 31 fixtures | Fixture regressions and parser tests | Suitable foundation; live drift remains | COMPLETE for M1 |
| Production scraper | Crawlee orchestrator, policies, queues, run state, lock, health gates | Unit/invariant coverage; exact live pagination defect not reproduced | No | PARTIAL |
| Bootstrap importer | Pre-generated page import path | Dedicated bootstrap tests and local manifests | No, workaround/demo path | COMPLETE as workaround |
| Raw snapshots | SHA-256, gzip, atomic files, Mongo metadata, no update repository API | Snapshot/repository tests currently dependency-blocked | No, application-level immutability and filesystem storage | PARTIAL |
| Normalization | One-time script only | Local result manifest, no production suite | No | PARTIAL |
| Identity/publishing | CatalogProduct/Offer models and one-time direct publisher | No production matching/lifecycle tests | No | PARTIAL |
| Catalog API/search | Categories/list/detail/offers, regex search, filters, sort, pagination, Swagger | API tests exist but current collection is dependency-blocked | No | PARTIAL |
| Admin | No backend routes or services | None | No | NOT STARTED |
| Compatibility | No package or rules | None | No | NOT STARTED |
| Build API | No model/repository/routes | None | No | NOT STARTED |
| Purchase API | No persistence/routes | None | No | NOT STARTED |
| Scheduler/operations | Worker lock heartbeat only | Lock tests currently dependency-blocked | No | PARTIAL |
| Observability | Pino, request IDs, run reports, robots and health gates | Unit/API coverage where applicable | No metrics or required runbooks | PARTIAL |
| Deployment | No containers or staging definitions | None | No | NOT STARTED |

## Known Blockers and Technical Debt

### Critical

- `mongodb-memory-server` is imported but absent from every `package.json` and `package-lock.json`. This breaks root build, typecheck, and test targets for `database`, `scraping-core`, and `api`, and makes a clean CI run expected to fail after `npm ci`.

### High

- `docs/BUGS/M2-BUG-001.md` is OPEN/High. Dynamically enqueued category pages may not execute, preventing terminal pagination and reliable full discovery. It is the practical production M2 and official M3 blocker.
- Production M3 normalization does not exist. The one-time bootstrap script has no taxonomy/mapping/version/reprocess/data-quality pipeline or production test suite.
- Production M4 identity and publishing do not exist. There is no matching, aliases, review queue, PriceEvent, lifecycle, or stable cross-run proof.
- M5 remains downstream of bootstrap data and lacks canonical specs, normalized ranking, filter definitions/facets, suggestions, price history, and full-dataset performance proof.
- M7-M10 are absent or presentation-only in major areas. This is expected by sequence but blocks the official MVP: no admin workflow, compatibility engine, persistent Builder, purchase API, scheduler, staging, or scrape-to-purchase proof.

### Medium

- Catalog search uses raw regex across title/brand/model/MPN with only category and brand product indexes; index/explain and ranking requirements are unproven.
- API input parsing has no Zod HTTP DTO boundary or Problem Details response model. CORS is permissive. Helmet and scraper same-domain protection are present, but admin authentication and rate limiting do not exist.
- Web production DI hardcodes `http://localhost:3000` in `apps/web/src/app/app.config.ts`; no production environment wiring exists.
- Frontend transport DTOs are local to `apps/web`, while `packages/contracts` currently focuses on crawler contracts. This is a contract-centralization gap against the TDD, not a demonstrated forbidden dependency.
- CI omits Playwright, so the locally passing 111 functional/accessibility E2E tests and 34 visual tests are not protected by `.github/workflows/ci.yml`.
- `.env.example` omits worker scraper variables. No secret values are needed in documentation, but variable names and safe defaults should be documented.
- Observability has logs, request IDs, run reports, robots decisions, and health gates but no metrics system, required operational runbooks, scheduler monitoring, deployment, or staging.
- Raw-snapshot immutability is application-level. Content hashing, immutable file naming, atomic writes, and the lack of a repository update API are useful controls, but database-level immutable enforcement is absent.

### Low

- `README.md` says the project is M0 and describes placeholder applications; `AGENTS.md` says M1 is complete; the actual official chain is blocked at M2. README also omits scraping packages, catalog API, and frontend capabilities.
- `apps/web/src/app/features/catalog/catalog.page.ts` is unreferenced. Empty/placeholder paths include API admin/builds and the empty legacy directory `apps/web/src/app/features/product-details/`; the real API-driven Product Details implementation lives under `apps/web/src/app/features/product/`.
- Generated screenshots are duplicated under `apps/web/apps/web/e2e/screenshots/`. They are automated artifacts, not manual approval evidence.
- Root TypeScript is `~5.8.0` while `apps/web/package.json` declares `~5.6.0`.
- Lint currently emits 23 warnings: one from `database` and 22 from `scraping-core`.
- Vitest warns that `environmentMatchGlobs` is deprecated.

## TDD Deviations and ADR Overrides

| Topic | TDD baseline | Current decision/state | Audit treatment |
|---|---|---|---|
| Local MongoDB | M0 lists Docker Compose | ADR-001 selects Atlas and supersedes local Docker | No M0 violation; deployment containers remain missing for M10 |
| Scraping mode | HTTP-first architecture | ADR-002 confirms RSC/HTML HTTP extraction and no current Playwright need | Compliant |
| M2/database implementation choices | TDD §3.1 specifies MongoDB Node Driver | ADR-000.7 and ADR-003 choose Mongoose; scraping framework, run model, CLI naming, health gates, and related M2 details were otherwise resolved by ADR-003 | ADR-000.7/ADR-003 override the TDD database-driver choice; ADR-003 is authoritative for the other listed M2 decisions |
| Runtime/framework versions | TDD names Node 24, Angular 22, TypeScript 6 | ADR-003 documents current Node >=20, Angular 19, and TypeScript 5.x and prohibits opportunistic upgrades | Documented deviation; root/web TS inconsistency remains debt |
| Frontend sequence | Officially M6 follows M5 and Builder follows M8 | ADR-004 authorizes a custom accelerated frontend sequence | Authorized sequencing only; it does not grant M8/M9 capability claims |
| Express version | TDD calls for Express 5 | Repository uses Express 4 | Undocumented deviation requiring a future decision or alignment |
| Fast-track data work | M3/M4 follow complete M2 | One-time bootstrap normalization and publishing were added before production M2 completion | Useful demo path, not official M3/M4 completion |
| Catalog/API frontend work | M5/M6 follow production M4 | M5-lite, M6-oriented UI, and custom comparison were implemented early | Out-of-order capability; does not satisfy upstream exits |
| Comparison | Not a dedicated official milestone in M0-M11 | Custom `/compare` capability is implemented | Complete separate feature, not a milestone substitute |

Documentation used for this audit: TDD section 33 (M0-M11 implementation phases and exit criteria); ADR-000 (foundation and architectural boundaries); ADR-001 (Atlas over local Docker); ADR-002 (HTTP-first Sigma extraction); ADR-003 (M2 scraper, persistence, configuration, CLI, versions, and testing decisions); and ADR-004 (custom frontend sequence and M8/M9 constraints).

## Recommended Next Milestone

Complete exactly one official milestone next: **M2 - Raw Scraper**.

This is the correct next milestone because it is the first incomplete production-data dependency, `M2-BUG-001` explicitly blocks M3, and all later canonical, API, admin, compatibility, build, and purchase claims depend on complete and auditable raw discovery.

Prerequisite: declare and lock `mongodb-memory-server` in the appropriate manifest, restore green root lint/typecheck/test/build validation, and confirm the repository/lock integration suites collect and run.

Exact M2 scope: fix dynamic pagination execution; require every enabled category audit to reach a terminal state; preserve pagination loop/page-limit safeguards; verify idempotency and no unintended duplicates; verify resume after interruption; verify retry/failure classification and prior-data preservation; verify request rate and concurrency policy; verify lock acquisition/heartbeat/release; execute a complete auditable full run; and retain run counts and reusable raw snapshots as evidence.

Explicitly defer M3 normalization, M4 matching/publishing expansion, M7 and later administrative/operational work, Builder and compatibility behavior, and any second-store work until M2 exits. Existing bootstrap, catalog, comparison, and presentation work may remain available but should not expand the milestone scope.

## Recommended Execution Order

1. Repair validation by declaring/locking the hermetic MongoDB test dependency and restore green root validation.
2. Complete M2 production pagination, idempotency/resume/retry/rate/lock verification, and full-run evidence.
3. Implement M3 production classification and normalization.
4. Implement M4 identity, matching, publishing, reviews, lifecycle, and price events.
5. Complete M5 canonical catalog API, contracts, search, facets, history, indexes, and performance proof.
6. Close M6 route, bundle, autocomplete/facet, canonical-spec, production configuration, and live E2E gaps.
7. Implement M7 match-review and data-quality admin.
8. Implement M8 compatibility engine independently.
9. Implement M9 persistent Build API/UI and compatibility integration.
10. Complete M10 purchase plan, scheduler, metrics, runbooks, deployment, staging, and full regression.
11. Begin M11 second-store work only after M10 exits.

## Final Verdict

Truthful claims today are: **M1 is complete; M2 is substantial but incomplete; a successful one-time bootstrap demo path exists; an M5-lite catalog API provides real basic endpoints; the frontend provides strong API-driven catalog and product-details experiences plus URL-backed comparison; and Builder and purchase-plan pages are explicitly deferred, UI-only presentation shells.**

Claims that must not be made are: **the production scraper is complete; production normalization or product matching exists; a canonical catalog pipeline is operational; compatibility checking exists; Builder is persistent or functional; a purchase workflow exists; admin workflows exist; scheduling/deployment is complete; or the system is production-ready.**

BuildSense is suitable for a portfolio or controlled demo of its architecture, frontend, API-driven catalog, comparison experience, and bootstrap data path, provided the bootstrap/workaround, mocked E2E, and missing production milestones are disclosed. It is **not production-ready**. The official MVP is approximately 40% complete, and the next defensible milestone claim requires restoring validation and completing production M2 pagination end to end.
