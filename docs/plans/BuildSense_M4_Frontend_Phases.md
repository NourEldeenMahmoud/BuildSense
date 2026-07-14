# BuildSense Custom M4 Frontend Implementation Plan

## I. Executive Summary

### Goal

Implement the approved BuildSense Stitch interface as a responsive Angular application, using real catalog data and truthful capability boundaries while deferring Builder and compatibility business behavior to their authoritative later milestones.

### Milestone Override

This plan records an explicit user-approved sequencing override:

- The TDD defines official M4 as Product Identity and Publishing.
- The TDD defines Catalog Web UI as M6 and Build API/UI as M9 after the M8 Compatibility Engine.
- This document uses the label **custom frontend M4** for the current UI delivery.
- This override changes delivery sequencing only. It does not authorize fake backend behavior, fake compatibility, fake persistence, or violations of the architectural boundaries.

### Success Metrics

1. Real combined Home/Catalog, product-detail, and frontend-only comparison flows pass lint, type-check, unit tests, production build, and Playwright E2E tests.
2. Desktop and mobile screenshots demonstrate responsive visual parity with the eight approved Stitch screens and the Industrial Precision System.
3. Production Builder and Build Review routes expose honest unavailable or empty states; Stitch-filled variants exist only in a test/dev visual fixture harness excluded from production builds.
4. `apps/web` imports only approved packages and never imports database, scraper, worker, API implementation, or store-adapter code.

### Documentation Used

- User-approved scope decisions in this planning session.
- `docs/ADR/ADR-000-project-foundation-decisions.md` §ADR-000.4 and dependency boundaries.
- `docs/TDD/PC_Hardware_Aggregator_TDD_v1.0_AR.md` §21, §28.8, §33 M4/M5/M6/M8/M9, §35, and §37.
- Stitch project `1839315319553523077` and design system `assets/c45a24ee6b6b405d81671a4bf884f1dc`.
- Current Angular app, Catalog API implementation, and workspace target configuration.

## II. Skill Matrix

| Component | Required skill or source | Implementation role |
| --- | --- | --- |
| Visual system and screen parity | `frontend-design` + Stitch MCP | Translate the Industrial Precision System into maintainable Angular/CSS without copying generated Tailwind markup. |
| Project requirements | `docs-navigation` | Keep decisions aligned with ADR/TDD precedence and record the custom milestone override. |
| Angular architecture | TDD §21 + current Angular 19 app | Standalone components, lazy routes, Signals for feature state, RxJS for HTTP/debounce/cancellation. |
| API boundaries | ADR-000 dependency direction | Reuse existing shared contracts where suitable, define missing types locally in web, and keep API implementation out of `apps/web`. |
| Automated quality | Vitest + Playwright | Unit, route, store, accessibility, responsive, E2E, and screenshot evidence. |
| Documentation quality | `docs-guard` | Verify screen IDs, routes, commands, DTO names, and capability claims before approval. |

## III. Scope and Decisions

### In Scope

- Existing Stitch `DESIGN.md` and design system as the single visual source of truth; no duplicate design document.
- Local Hanken Grotesk and Space Mono font assets with recorded licenses.
- Project-owned SVG icon components; no runtime Material Symbols dependency.
- Shared application shell and responsive navigation.
- Combined Home + Catalog route at `/`.
- `/catalog` alias or redirect to `/`, preserving query parameters.
- Existing shared contracts where available; otherwise frontend-local typed interfaces.
- Real Catalog API integration for categories, product list, product details, and offers already exposed by the API.
- URL-synchronized search, supported filters, sort, and pagination.
- Product details and raw specification presentation.
- Frontend-only same-category two-product comparison.
- Comparison state in `/compare?left=<productId>&right=<productId>`.
- Presentational Builder, component-selection, and Build Review components.
- Honest production empty/unavailable states for `/builder` and `/purchase-plan`.
- Separate visual-fixture build configuration for filled Builder, selection, and review screenshot parity.
- Responsive behavior, accessibility, Playwright E2E, and screenshot evidence.

### Explicitly Out of Scope

- Any modification to `apps/api`, backend behavior, catalog endpoints, database packages, or backend contracts.
- Build API, build persistence, public build IDs, MongoDB build storage, or optimistic concurrency.
- Compatibility rules, compatibility claims, candidate classification, or recommendation scoring.
- Production localStorage builder persistence.
- Mock compatibility results in production.
- Fake saved builds, fake totals, fake availability, or fake store data in production.
- Payment, checkout, cart, or automatic multi-tab purchasing.
- Admin UI redesign.
- Tailwind, Angular Material, Bootstrap, NgRx, or generated Stitch JavaScript.
- M3 or scraper work.

### Capability Policy

- Catalog and product details use real API data.
- Comparison is a frontend-only view over two real product-detail responses.
- Builder and Build Review production routes state that functionality is unavailable until M8/M9 dependencies exist.
- Filled Builder/Review screenshots use fixtures only through a non-production visual configuration.
- Add-to-Build, Save Build, compatibility status, and export-plan actions must not appear active in production.
- Bundles remain catalog-visible and never expose an active Add-to-Build action.

**Builder and Build Review are not functional in this milestone.** Their filled variants exist only for isolated visual fixture testing and must never be reachable through the production application.

### Stage Execution Protocol

- Execute exactly one stage at a time.
- Run that stage's validation and review its diff before marking it complete.
- Report changed files, test/build results, manual evidence, known limitations, and git diff summary.
- Stop and wait for explicit user approval before starting the next stage.
- Do not batch stages or begin dependent work while the preceding stage is awaiting review.

### Route Map

| Route | Production behavior | Stitch reference |
| --- | --- | --- |
| `/` | Combined Home + real Catalog | `73ed103028854b8e8aee195c72d61d01` Clean Catalog v2 |
| `/catalog` | Alias or redirect to `/`, preserving query parameters | Backward compatibility |
| `/products/:productId` | Real product details | `2f1e7964a72848e9b13cd17543cf7d7d` Product Details & Comparison |
| `/compare` | Frontend-only real comparison from `left` and `right` query IDs | `d734beaa73194d3ebbca46d4a484f28d`, `6b0e9866abac471f91c0bde8624ec152` |
| `/builder` | Honest unavailable/empty Builder shell | `f36bf403749c46599acb7b96f6f1515f` and mobile reference |
| `/purchase-plan` | Honest unavailable/empty review shell | `d274f785e1e74b25adbba1f560c2e390` |
| `/admin` | Existing placeholder, visually integrated only where shell requires it | No Stitch redesign in this plan |
| `**` | Existing not-found behavior | Shared shell |

### Visual Fixture Routes

Visual fixture routes are registered only by a separate non-production Angular entry/configuration and are absent from the production route table and bundle:

- `/__visual/builder-filled`
- `/__visual/component-selection`
- `/__visual/build-review-filled`
- `/__visual/mobile-builder`

Fixture data must live outside production feature data-access code and must never be imported by the production entry point.

### Stitch Screen Inventory

| Screen | ID | Planned use |
| --- | --- | --- |
| Clean Catalog v2 | `73ed103028854b8e8aee195c72d61d01` | Shell, hero, category ribbon, search/filter panel, product grid, pagination, footer |
| Product Details & Comparison | `2f1e7964a72848e9b13cd17543cf7d7d` | Gallery, offer/status panel, raw specifications, compare entry |
| Refined Comparison Selection | `d734beaa73194d3ebbca46d4a484f28d` | Same-category selector and two-slot selection UX |
| Hardware Comparison Result | `6b0e9866abac471f91c0bde8624ec152` | Two-product header and raw-spec union matrix |
| Refined PC Builder Workspace | `f36bf403749c46599acb7b96f6f1515f` | Presentational workspace and production unavailable shell |
| Component Selection | `1b42ccf251704087a5682e0d1f498d4a` | Fixture-only selector parity |
| Refined Build Review & Purchase Plan | `d274f785e1e74b25adbba1f560c2e390` | Production empty state and fixture-only filled parity |
| Mobile Platform | `d47cdc606b734092b8db580cdedee96d` | Mobile shell, list-first builder composition, bottom action region |

## IV. Architecture

```text
Angular routes
  -> smart feature pages
      -> feature signal stores
          -> typed data-access services
              -> HttpClient
                  -> existing /api/v1 catalog endpoints

presentational components
  <- immutable view models
  <- real feature stores in production
  <- isolated fixtures in visual-test configuration only

apps/web -> packages/contracts when suitable, packages/config
apps/web -X-> apps/api, packages/database, scraping packages, worker packages
```

### State Ownership

- Catalog query parameters are the source of truth.
- Catalog form changes debounce for 300 ms, update the URL, and reset page to 1.
- Router changes trigger requests; `switchMap` prevents stale responses from winning.
- Comparison query parameters are the source of truth.
- Builder and review have no persisted production state during this milestone.
- Overlay state is local Signals state; focus management remains in the owning page/component.

### Contract Boundary

Inspect `packages/contracts` first and reuse suitable transport DTOs when they exist. If catalog DTOs are absent, define frontend-local typed interfaces under the relevant `apps/web` feature data-access folder. Do not modify `apps/api`, database models, endpoint behavior, or backend contracts. Required frontend type groups:

- category-list response;
- product-list query and sort values;
- paginated product-list response;
- product-list item;
- product-detail response;
- offer response;
- raw specification entry;
- API problem/error response.

Angular must consume only verified response shapes through shared contracts or frontend-local interfaces, then map them into web-specific view models at the HTTP boundary.

## V. Phased Roadmap

## Stage 1: Baseline, Design Source, Frontend Types, and Test Infrastructure

> **Entry Condition:** The current branch is identified, the workspace installs successfully, and no implementation task from this plan has started.
> **Exit Condition:** Baseline commands and actual Nx targets are recorded, the existing Stitch DESIGN.md is confirmed as source of truth, frontend response types compile, and the generated Playwright targets are inspected before later stages reference their commands.

### Module 1.1: Baseline and Decision Record

- [ ] [P1.1.1] Capture Baseline: Run current web lint/typecheck/test/build targets and record existing failures without changing unrelated projects.
      depends_on: none
      Verify: `npx nx run web:lint`, `npx nx run web:typecheck`, `npx nx run web:test`, and `npx nx run web:build` have recorded results.

- [ ] [P1.1.2] Record Custom M4 Override: Add a concise decision note stating that this frontend sequence is user-approved but does not supersede M8/M9 capability prerequisites.
      depends_on: P1.1.1
      Verify: The note names official TDD M4/M6/M8/M9 and forbids fake Builder/compatibility behavior.

### Module 1.2: Existing Design Source of Truth

- [ ] [P1.2.1] Verify Existing DESIGN.md: Load the existing DESIGN.md from Stitch asset `c45a24ee6b6b405d81671a4bf884f1dc` and verify its colors, typography, spacing, shape, elevation, and motion rules against the current design system.
      depends_on: P1.1.2
      Verify: Implementation notes reference the existing Stitch DESIGN.md directly; no duplicate DESIGN.md is created in the repository.

- [ ] [P1.2.2] Define Visual Acceptance Matrix: Record desktop and mobile viewport sizes, target screen IDs, production versus fixture-only routes, and permitted intentional differences caused by unavailable backend capabilities.
      depends_on: P1.2.1
      Verify: The matrix covers all eight Stitch screens and labels Builder/Review filled states fixture-only.

- [ ] [P1.2.3] Prepare Local Assets: Add licensed local font files and license notices for Hanken Grotesk and Space Mono; define the project SVG icon strategy and image-fallback policy.
      depends_on: P1.2.1
      Verify: A production build loads fonts/icons without requests to Google Fonts, Material Symbols, or Tailwind CDN.

### Module 1.3: Frontend Response Types and Fixture Isolation

- [ ] [P1.3.1] Inventory Existing Contracts: Inspect `packages/contracts` and the actual current Catalog API responses to identify reusable transport types without changing either source.
      depends_on: P1.1.1
      Verify: The inventory identifies every reusable type and every missing catalog shape; no file outside `apps/web` is modified.

- [ ] [P1.3.2] Define Frontend-Local Catalog Interfaces: Reuse suitable shared contracts and define only missing response/query interfaces in `apps/web` data-access code, including nullable fields observed in current responses.
      depends_on: P1.3.1
      Verify: `apps/web` type-checks without importing API implementation, database models, or modifying `packages/contracts`.

- [ ] [P1.3.3] Define Fixture Isolation: Add a separate visual-test configuration/entry design whose dependency graph cannot be reached from production `main.ts`.
      depends_on: P1.2.2, P1.3.1
      Verify: Production build stats contain no fixture route strings or fixture product/build names.

### Module 1.4: Browser Test Infrastructure

- [ ] [P1.4.1] Record Actual Nx Targets: Run `npx nx show projects` and `npx nx show project web --json`; record that the current web targets are `build`, `serve`, `dev`, `lint`, `typecheck`, and `test`, with no current Playwright target.
      depends_on: P1.1.1
      Verify: The recorded target inventory matches live Nx output before any Playwright command is defined.

- [ ] [P1.4.2] Add and Inspect Playwright Project: Add a pinned Nx-compatible Playwright setup, generate/configure production and visual-fixture execution, then inspect the generated project with `npx nx show project <generated-project-name> --json`.
      depends_on: P1.3.3, P1.4.1
      Verify: Exact generated project/target names and runnable commands are recorded before Stage 2; no later stage starts until this plan's command references are updated to those inspected targets.

### Stage 1 Test Procedures

#### Test 1.1: Frontend Type and Boundary Validation
- **Type:** Integration
- **Preconditions:** Contract inventory and frontend-local response types are implemented.
- **Steps:**
  1. Run web type-check and tests.
  2. Search `apps/web` for imports from `@buildsense/database`, `sigma-adapter`, `scraping-core`, and `apps/api`.
  3. Confirm `apps/api`, database packages, and existing contracts have no diff from this stage.
- **Expected Result:** Web targets pass, response shapes are typed at the frontend boundary, forbidden imports are absent, and backend files are unchanged.
- **Pass Command:** `npx nx run-many -t typecheck,test -p web`
- **Fail Indicators:** Untyped HTTP boundary, backend modification, database types in web, or forbidden imports.

#### Test 1.2: Production Asset Independence
- **Type:** Build inspection
- **Preconditions:** Local fonts and SVG icons are configured.
- **Steps:**
  1. Run the production web build.
  2. Inspect emitted HTML/CSS for Google Fonts, Material Symbols, Tailwind CDN, or fixture route references.
- **Expected Result:** No runtime design CDN and no fixture-only content appears in production output.
- **Pass Command:** `npx nx run web:build`
- **Fail Indicators:** External font/icon requests, fixture imports, or production bundle errors.

#### Test 1.3: Browser Harness Isolation
- **Type:** Playwright smoke/build
- **Preconditions:** P1.4.2 has generated the Playwright project and recorded its actual Nx project/target names.
- **Steps:**
  1. Run the production smoke test and verify `/` loads.
  2. Verify production returns the normal not-found page for `/__visual/builder-filled`.
  3. Run the visual smoke test and verify `/__visual/builder-filled` loads.
- **Expected Result:** Both Playwright targets execute, and fixture routes are reachable only through the visual configuration.
- **Pass Command:** Use the exact production and visual Playwright Nx commands recorded by P1.4.2; do not assume project or target names before inspection.
- **Fail Indicators:** Missing target, fixture route in production, visual route unavailable, or browser startup failure.

## Stage 2: Application Shell and Reusable Visual Foundation

> **Entry Condition:** Stage 1 is complete and the existing DESIGN.md, frontend types, and generated browser-test targets are approved.
> **Exit Condition:** The shared shell, tokens, primitives, overlays, and responsive navigation match the Stitch system and are independently testable.

### Module 2.1: CSS Foundation

- [ ] [P2.1.1] Implement Global Tokens: Map the existing Stitch DESIGN.md into semantic CSS custom properties for surfaces, text, accent, status, borders, typography, spacing, layout widths, focus, and motion.
      depends_on: P1.2.1, P1.2.3
      Verify: `styles.css` contains semantic tokens rather than screen-specific hex duplication.

- [ ] [P2.1.2] Implement Global Reset and Atmosphere: Add accessible reset styles, dark color scheme, blueprint grid utility, selection styles, reduced-motion handling, and responsive container utilities.
      depends_on: P2.1.1
      Verify: No horizontal overflow at 390, 768, 1280, and 1600 CSS pixels.

### Module 2.2: Shared Components

- [ ] [P2.2.1] Build App Shell: Replace placeholder inline shell styling with reusable header, navigation, main landmark, and footer components.
      depends_on: P2.1.2
      Verify: Navigation supports desktop and mobile, route-active state, keyboard operation, and current-route announcement.

- [ ] [P2.2.2] Build Interaction Primitives: Implement button, icon button, text field, select field, badge, technical label, price display, and external-link components using native semantics.
      depends_on: P2.1.2
      Verify: Every control has focus-visible styling, disabled behavior, and no rounded default inconsistent with the design system.

- [ ] [P2.2.3] Build Feedback Primitives: Implement skeleton, inline progress, empty state, error/retry state, image fallback, and `aria-live` result status.
      depends_on: P2.2.2
      Verify: Loading, error, empty, and missing-image states can render without page-specific data.

- [ ] [P2.2.4] Build Overlay Primitive: Implement accessible dialog/drawer behavior with focus trap, Escape close, backdrop close policy, scroll lock, and focus restoration.
      depends_on: P2.2.2
      Verify: Keyboard-only test opens, traverses, closes, and returns focus to the trigger.

### Stage 2 Test Procedures

#### Test 2.1: Shared Component Semantics
- **Type:** Unit/component
- **Preconditions:** Shared components exist.
- **Steps:**
  1. Render each interactive primitive.
  2. Exercise keyboard focus, disabled state, and accessible name.
  3. Render loading/error/empty/image-fallback states.
- **Expected Result:** Tests find semantic controls by role/name and all state transitions are observable without color alone.
- **Pass Command:** `npx nx run web:test`
- **Fail Indicators:** Click-only controls, missing labels, focus loss, or generic blank states.

#### Test 2.2: Shell Responsive Check
- **Type:** Playwright
- **Preconditions:** App shell and Playwright project are configured.
- **Steps:**
  1. Open `/` at desktop viewport.
  2. Resize to 390x844.
  3. Open and close mobile navigation using keyboard.
- **Expected Result:** Desktop links collapse into an accessible mobile control; no overflow or obscured content occurs.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `application shell`.
- **Fail Indicators:** Overflow, inaccessible menu, focus loss, or hidden primary navigation.

## Stage 3: Catalog Data Layer, Routing, and Query State

> **Entry Condition:** Frontend response types and the shared shell are complete.
> **Exit Condition:** Canonical routes and typed catalog state load real API data with deterministic URL synchronization and stale-request protection.

### Module 3.1: Routing

- [ ] [P3.1.1] Establish Canonical Routes: Make `/` the combined lazy Home + Catalog route, keep `/catalog` as an alias or redirect that preserves query parameters, and retain `/products/:productId`, `/builder`, `/purchase-plan`, `/admin`, and wildcard routes. Do not add `/products` as a Catalog route.
      depends_on: P2.2.1
      Verify: Route tests assert the canonical route table and redirect behavior.

- [ ] [P3.1.2] Add Comparison Route: Add lazy `/compare` route with `left` and `right` query-parameter validation.
      depends_on: P3.1.1
      Verify: Missing, duplicate, malformed, and valid IDs produce explicit route states.

### Module 3.2: Catalog Data Access

- [ ] [P3.2.1] Implement Catalog API Service: Create typed methods for existing categories, product list, product detail, and offer endpoints using `HttpClient` and `API_BASE_URL`.
      depends_on: P1.3.2
      Verify: Service tests assert URLs, supported parameters, response typing, and error propagation.

- [ ] [P3.2.2] Implement Query Codec: Parse and serialize page, pageSize, search, category, brand, minPrice, maxPrice, and sort; reject or normalize invalid values without sending unsupported availability filters.
      depends_on: P3.2.1
      Verify: Round-trip unit tests cover empty, valid, malformed, and boundary queries.

- [ ] [P3.2.3] Implement Catalog Store: Use Signals for state and RxJS for 300 ms debounce, URL updates, router-driven fetching, `switchMap`, retry action, background-loading state, and page reset after query changes.
      depends_on: P3.1.1, P3.2.2
      Verify: Store tests prove stale responses cannot replace newer results and back/forward navigation restores state.

### Stage 3 Test Procedures

#### Test 3.1: URL Synchronization
- **Type:** Unit/integration
- **Preconditions:** Catalog store and query codec are implemented.
- **Steps:**
  1. Initialize with search/category/page query parameters.
  2. Change search and advance fake time by 300 ms.
  3. Change a filter and navigate browser history backward/forward.
- **Expected Result:** URL is source of truth; search/filter changes reset page to 1; history restores prior query and data request.
- **Pass Command:** `npx nx run web:test`
- **Fail Indicators:** Duplicate requests, stale results, lost query state, or unsupported parameters.

#### Test 3.2: API Failure and Retry
- **Type:** Integration
- **Preconditions:** API service/store tests can mock HTTP.
- **Steps:**
  1. Return an API error for product list.
  2. Trigger retry and return a valid page.
- **Expected Result:** Typed error state appears, retry preserves query, and valid results replace the error.
- **Pass Command:** `npx nx run web:test`
- **Fail Indicators:** Unhandled error, query reset, duplicate request, or full-page blanking.

## Stage 4: Real Catalog Screen

> **Entry Condition:** Stage 3 routes and data layer pass.
> **Exit Condition:** `/` implements the real combined Home + Catalog flow and matches the Clean Catalog reference within documented data constraints.

### Module 4.1: Catalog Composition

- [ ] [P4.1.1] Build Catalog Hero and Category Ribbon: Implement the Stitch hero, real category navigation, primary search, and truthful calls to action.
      depends_on: P2.2.3, P3.2.3
      Verify: Category controls come from the API and update URL state.

- [ ] [P4.1.2] Build Filter Drawer: Implement category, brand text filter, min/max price, sort, clear, apply/close, active-filter summary, and responsive drawer behavior.
      depends_on: P2.2.4, P3.2.3
      Verify: No availability or performance filter is sent because the backend does not support it.

- [ ] [P4.1.3] Build Product Card and Grid: Render only list DTO fields: image, title, category, brand, model, MPN, price, availability, and source URL.
      depends_on: P4.1.1
      Verify: Cards do not request product details, fabricate specifications, or expose active Builder actions.

- [ ] [P4.1.4] Build Pagination and Result Status: Implement page controls, total/result range, disabled states, focus movement, background refresh, and `aria-live` updates.
      depends_on: P4.1.2, P4.1.3
      Verify: Pagination updates URL and preserves filters without duplicate requests.

- [ ] [P4.1.5] Complete Catalog States: Integrate initial skeleton, background loading, empty results, API retry, unknown price/availability, out of stock, missing image, long title, and bundle badge.
      depends_on: P4.1.4
      Verify: Every state is covered by a component/store test and has readable mobile layout.

### Stage 4 Test Procedures

#### Test 4.1: Catalog E2E
- **Type:** Playwright E2E
- **Preconditions:** API is available or deterministically intercepted with contract-valid responses.
- **Steps:**
  1. Open `/`.
  2. Search, select category, set price bounds, sort, and navigate page 2.
  3. Reload and use browser back/forward.
  4. Open one product detail link and one Sigma external link.
- **Expected Result:** URL and controls remain synchronized; results update once per state; product route and safe external link work.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `catalog flow`.
- **Fail Indicators:** State loss, stale results, unsupported query, N+1 detail calls, or broken external link semantics.

#### Test 4.2: Catalog Responsive Parity
- **Type:** Playwright visual/manual review
- **Preconditions:** Contract-valid deterministic catalog fixtures are supplied through network interception.
- **Steps:**
  1. Capture `/` at 1280px and 390px widths.
  2. Open desktop filter panel and mobile filter drawer.
  3. Compare composition to Clean Catalog v2 and Mobile Platform references.
- **Expected Result:** Grid, typography, spacing, category ribbon, filters, and states follow the acceptance matrix with no overflow.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `catalog visual`.
- **Fail Indicators:** Layout drift outside documented tolerances, inaccessible drawer, or desktop-only interaction.

## Stage 5: Real Product Details

> **Entry Condition:** Catalog cards navigate with real product IDs.
> **Exit Condition:** Product details display real API data, raw specifications, offer state, and comparison entry without Builder claims.

### Module 5.1: Product Detail Data

- [ ] [P5.1.1] Implement Product Detail Store: Load and expose product detail by route ID with loading, invalid ID, not found, API error, and retry states.
      depends_on: P3.2.1, P3.1.1
      Verify: Route changes cancel stale requests and never display the previous product under a new ID.

- [ ] [P5.1.2] Map Product View Model: Derive gallery, metadata, current Sigma offer, availability, source link, and raw specification groups without inventing canonical values.
      depends_on: P5.1.1
      Verify: Null and empty fields map to explicit unknown/empty states.

### Module 5.2: Product Detail UI

- [ ] [P5.2.1] Build Product Hero: Implement breadcrumb, gallery, category/SKU labels, title, price, availability, store link, and disabled/deferred Builder action.
      depends_on: P5.1.2, P2.2.3
      Verify: External links use safe attributes and unavailable Builder functionality is not presented as active.

- [ ] [P5.2.2] Build Specification Presentation: Render all raw Sigma labels/values safely, preserving distinctions and displaying missing values explicitly.
      depends_on: P5.1.2
      Verify: No semantic equivalence is guessed and arbitrary labels cannot inject markup.

- [ ] [P5.2.3] Add Compare Entry: Open same-category selector with the current product fixed in slot A.
      depends_on: P5.2.1, P3.1.2
      Verify: Compare action is disabled with a clear reason when product identity/category is insufficient.

### Stage 5 Test Procedures

#### Test 5.1: Product Details States
- **Type:** Component/integration
- **Preconditions:** Product detail service/store are implemented.
- **Steps:**
  1. Render complete, sparse, missing-image, no-offer, not-found, and API-error responses.
  2. Exercise retry and route-ID change.
- **Expected Result:** Each state is explicit, safe, and free of stale data or fabricated fields.
- **Pass Command:** `npx nx run web:test`
- **Fail Indicators:** N+1 offer calls without need, unsafe raw labels, stale product, or active Builder claim.

#### Test 5.2: Product Details Visual Parity
- **Type:** Playwright visual
- **Preconditions:** Detail endpoint is intercepted with contract-valid deterministic data.
- **Steps:**
  1. Capture `/products/<fixture-id>` at desktop and mobile widths.
  2. Navigate gallery controls and raw specifications by keyboard.
- **Expected Result:** Hero/gallery/specification hierarchy matches the Stitch reference and remains usable on mobile.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `product details visual`.
- **Fail Indicators:** Unreadable specs, clipped gallery, focus loss, or visual hierarchy mismatch.

## Stage 6: Frontend-Only Product Comparison

> **Entry Condition:** Product details and comparison route exist.
> **Exit Condition:** Users can select exactly two real same-category products, reload/share the URL, and compare actual raw labels without backend comparison support.

### Module 6.1: Comparison State and Selection

- [ ] [P6.1.1] Implement Comparison Query Codec: Validate `left` and `right` product IDs, reject duplicates, and expose empty/partial/valid/invalid states.
      depends_on: P3.1.2
      Verify: Query codec round-trips valid IDs and never silently replaces malformed input.

- [ ] [P6.1.2] Implement Compare Store: Load both product details concurrently with cancellation, preserve independent errors, and enforce same-category comparison.
      depends_on: P6.1.1, P5.1.1
      Verify: Cross-category and duplicate selections cannot reach valid comparison state.

- [ ] [P6.1.3] Build Comparison Selector: Implement searchable same-category candidate list, two slots, replace/remove actions, focus trap, and URL navigation.
      depends_on: P6.1.2, P2.2.4
      Verify: Selector sends only supported catalog parameters and cannot select a third product.

### Module 6.2: Comparison Matrix

- [ ] [P6.2.1] Build Stable Product Headers: Render image, identity, price, availability, Sigma link, remove/change action, and deferred Builder action.
      depends_on: P6.1.2
      Verify: Both columns remain aligned and sparse products remain readable.

- [ ] [P6.2.2] Build Raw Specification Union: Normalize whitespace/casing only for row matching, preserve original labels for display, show em dash for absent values, and highlight literal differences without declaring a winner.
      depends_on: P6.2.1
      Verify: Unit tests cover duplicate labels, casing/whitespace, missing values, and conflicting values.

- [ ] [P6.2.3] Implement Responsive Comparison: Use aligned side-by-side desktop matrix and horizontal ribbon or stable product switcher on mobile.
      depends_on: P6.2.2
      Verify: Labels remain associated with both values and keyboard scrolling is supported.

### Stage 6 Test Procedures

#### Test 6.1: Comparison URL Flow
- **Type:** Playwright E2E
- **Preconditions:** Two same-category and one cross-category products are available through deterministic API interception.
- **Steps:**
  1. Open product A and launch selector.
  2. Select product B and navigate to comparison.
  3. Reload and share/open the same URL.
  4. Attempt duplicate and cross-category selections.
- **Expected Result:** Valid comparison survives reload; invalid selections show explicit correction actions.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `comparison flow`.
- **Fail Indicators:** localStorage dependency, lost selection, third slot, cross-category matrix, or fabricated values.

#### Test 6.2: Comparison Visual Parity
- **Type:** Playwright visual
- **Preconditions:** Deterministic same-category detail responses are configured.
- **Steps:**
  1. Capture selector and result at desktop width.
  2. Capture result at mobile width and exercise horizontal/switcher navigation.
- **Expected Result:** Selection and matrix match their Stitch references while retaining accessible labels and controls.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `comparison visual`.
- **Fail Indicators:** Unaligned rows, unreadable mobile columns, missing values hidden, or false best/winner language.

## Stage 7: Deferred Builder and Build Review Presentation

> **Entry Condition:** Shared visual foundation is stable and fixture isolation from Stage 1 is proven.
> **Exit Condition:** Production routes are truthful empty/unavailable experiences, while non-production visual routes render all approved filled Stitch compositions without entering production bundles.

### Module 7.1: Production Capability Boundaries

- [ ] [P7.1.1] Build Builder Unavailable State: Implement `/builder` with the Stitch workspace structure, empty component slots, dependency explanation, catalog navigation, and no save/select/compatibility claims.
      depends_on: P2.2.3, P3.1.1
      Verify: Production Builder contains no fixture product, total, compatibility result, localStorage access, or active Save/Review action.

- [ ] [P7.1.2] Build Review Unavailable State: Implement `/purchase-plan` with honest no-build messaging, return-to-catalog/Builder navigation, and no fake summary, total, export, or compatibility result.
      depends_on: P7.1.1
      Verify: Production review cannot imply a saved or active build.

### Module 7.2: Presentational View Models and Components

- [ ] [P7.2.1] Build Builder Presentational Components: Implement workspace canvas, hotspot/slot visuals, component list, summary panel, selector shell, and mobile list composition as input-driven components with no persistence or compatibility logic.
      depends_on: P2.2.4, P1.3.3
      Verify: Components render immutable view models and emit UI intents only.

- [ ] [P7.2.2] Build Review Presentational Components: Implement component rows, summary panel, price/availability display, disclaimers, and print/export button styling as input-driven components.
      depends_on: P7.2.1
      Verify: No component computes compatibility or claims store checkout.

- [ ] [P7.2.3] Build Component Selection Presentation: Implement the Stitch selection drawer/list, filters, product rows, and selected slot styling for fixture-only visual validation.
      depends_on: P7.2.1
      Verify: Production routes do not import or activate selection fixtures.

### Module 7.3: Fixture-Only Visual Harness

- [ ] [P7.3.1] Add Isolated Visual Fixtures: Create typed fixtures for filled Builder, component selection, Build Review, and mobile states under the visual-test configuration only.
      depends_on: P7.2.2, P7.2.3
      Verify: Fixture names/data are absent from production output and production dependency graph.

- [ ] [P7.3.2] Add Visual Fixture Routes: Register the four `__visual` routes only in the visual-test entry and configure Playwright to start that target for screenshot tests.
      depends_on: P7.3.1, P1.4.2
      Verify: Production server returns not-found for `__visual` routes; visual-test server renders them.

### Stage 7 Test Procedures

#### Test 7.1: Production Truthfulness
- **Type:** Playwright E2E
- **Preconditions:** Production configuration is served.
- **Steps:**
  1. Open `/builder` and `/purchase-plan`.
  2. Search page text and network/storage activity for fixture data, compatibility claims, saved-build claims, totals, localStorage, and Build API calls.
  3. Open every `__visual` path.
- **Expected Result:** Honest unavailable/empty states appear, no fake data or unsupported requests occur, and visual fixture routes are absent.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2 with the test-title filter `production capability boundary`.
- **Fail Indicators:** Demo data, fake compatibility, local persistence, Build API calls, or reachable fixture routes.

#### Test 7.2: Fixture Visual Parity
- **Type:** Playwright visual
- **Preconditions:** Visual-test configuration is served.
- **Steps:**
  1. Capture filled Builder and component selection at 1280px.
  2. Capture filled Build Review at 1280px.
  3. Capture mobile Builder at 390x884.
- **Expected Result:** Input-driven presentational components match the corresponding Stitch compositions within the acceptance matrix.
- **Pass Command:** Use the inspected visual-fixture Playwright Nx command recorded by P1.4.2.
- **Fail Indicators:** Production fixture import, layout overflow, inaccessible hotspots/slots, or screenshot regression outside tolerance.

## Stage 8: Cross-Cutting Accessibility, Performance, and Release Validation

> **Entry Condition:** Stages 1-7 pass independently.
> **Exit Condition:** All custom frontend M4 acceptance checks pass and evidence is ready for review; no implementation beyond this stage begins without approval.

### Module 8.1: Accessibility Completion

- [ ] [P8.1.1] Audit Semantic Structure: Verify landmarks, heading order, labels, tables, external links, image alternatives, `aria-live`, status text, and disabled-action explanations across all production routes.
      depends_on: P4.1.5, P5.2.3, P6.2.3, P7.1.2
      Verify: Automated accessibility scan reports no serious/critical violations and manual keyboard flow is complete.

- [ ] [P8.1.2] Audit Focus and Motion: Verify overlay focus trap/return, route-change focus, visible focus, Escape handling, scroll locking, and `prefers-reduced-motion` behavior.
      depends_on: P8.1.1
      Verify: Keyboard-only Playwright scenarios pass at desktop and mobile widths.

### Module 8.2: Performance and Data Integrity

- [ ] [P8.2.1] Audit Request Behavior: Assert no catalog N+1 detail requests, no duplicate fetches, stale cancellation, image lazy loading, and stable Angular tracking.
      depends_on: P6.2.3
      Verify: Playwright request logs and store tests show expected request counts.

- [ ] [P8.2.2] Audit Bundle and Assets: Check production budgets, local font subsets, SVG reuse, fixture exclusion, and absence of heavy unapproved dependencies.
      depends_on: P7.3.2
      Verify: Production build passes configured budgets and fixture strings are absent.

### Module 8.3: Final Evidence

- [ ] [P8.3.1] Run Full Validation: Run web lint, type-check, unit tests, production build, inspected Playwright E2E target, and inspected visual target.
      depends_on: P8.1.2, P8.2.1, P8.2.2
      Verify: Every required command exits successfully.

- [ ] [P8.3.2] Capture Review Evidence: Save route matrix, screenshots, accessibility output, request-count evidence, production fixture-exclusion proof, changed-file list, and git diff summary.
      depends_on: P8.3.1
      Verify: Evidence maps every success metric and Stitch screen to an observable result.

- [ ] [P8.3.3] Perform Scope Review: Confirm no backend endpoint changes, no Builder/compatibility business logic, no production fixtures, and no forbidden dependencies.
      depends_on: P8.3.2
      Verify: Review checklist is complete and unresolved deviations are documented.

### Stage 8 Test Procedures

#### Test 8.1: Full Production Flow
- **Type:** Playwright E2E
- **Preconditions:** Production-like web and API are running with deterministic catalog seed data.
- **Steps:**
  1. Open home and catalog.
  2. Search/filter/paginate.
  3. Open a product and Sigma link.
  4. Select and compare two same-category products.
  5. Reload comparison.
  6. Open Builder and Purchase Plan unavailable states.
  7. Verify browser history and not-found route.
- **Expected Result:** Real-data flows work, frontend-only comparison is URL-restorable, deferred routes are truthful, and no unsupported endpoint is called.
- **Pass Command:** Use the inspected production Playwright Nx command recorded by P1.4.2.
- **Fail Indicators:** Broken route, unsupported API call, stale data, fake capability, accessibility failure, or fixture leakage.

#### Test 8.2: Final Validation Matrix
- **Type:** Automated/build
- **Preconditions:** All implementation tasks are complete.
- **Steps:**
  1. Run lint, type-check, tests, and builds for affected projects.
  2. Run E2E and visual suites.
  3. Review production bundle and git diff.
- **Expected Result:** All commands pass; screenshots are approved; no unrelated/backend behavior change is present.
- **Pass Commands:**
  - `npx nx run-many -t lint,typecheck,test,build -p web`
  - Use the inspected production Playwright Nx command recorded by P1.4.2.
  - Use the inspected visual-fixture Playwright Nx command recorded by P1.4.2.
- **Fail Indicators:** Any nonzero exit, visual regression, production fixture content, scope violation, or undocumented change.

## VI. Dependency Sanity Check

- Stage 1 establishes decisions, design source, frontend response types, Nx target evidence, and fixture isolation.
- Stage 2 depends on the design source and creates reusable UI foundations.
- Stage 3 depends on frontend response types and shell, then establishes routes/data state.
- Stage 4 depends on Stage 3 and implements the real catalog.
- Stage 5 depends on catalog navigation and detail data access.
- Stage 6 depends on product details and adds frontend-only comparison.
- Stage 7 depends on shared visual foundations and fixture isolation; it does not depend on or invent M8/M9 business services.
- Stage 8 depends on every observable production and visual-fixture stage.
- Every task dependency terminates at a `depends_on: none` task; no cycle is intentional.

## VII. Final Verification Checklist

- [ ] Custom frontend M4 override is documented and approved.
- [ ] The existing Stitch DESIGN.md is used directly and no duplicate design document was created.
- [ ] Fonts and icons are local and licensed.
- [ ] `/` is the combined Home + Catalog route; `/catalog` aliases or redirects to `/` while preserving query parameters; no separate `/products` Catalog route exists.
- [ ] Existing contracts are reused where suitable and missing response shapes are typed locally in web without database leakage.
- [ ] Catalog uses only supported query parameters.
- [ ] Catalog does not perform product-detail N+1 requests.
- [ ] Loading, background loading, error, retry, empty, missing-image, unknown-price, unknown-availability, and out-of-stock states are covered.
- [ ] Product details show real offers and raw specifications without fabricated values.
- [ ] Comparison accepts exactly two same-category products and restores from URL.
- [ ] Comparison does not claim a winner or normalize semantic differences speculatively.
- [ ] Bundles never expose active Add-to-Build actions.
- [ ] Production Builder and Build Review contain no fake data or unsupported behavior.
- [ ] Fixture routes/data are excluded from production builds.
- [ ] All eight Stitch screens have mapped screenshot evidence or an approved intentional-difference note.
- [ ] Desktop and mobile accessibility checks pass.
- [ ] Production budgets and request-count checks pass.
- [ ] Web lint, type-check, tests, and production build pass; backend projects remain unchanged.
- [ ] Playwright production E2E and visual suites pass.
- [ ] Git diff contains only approved custom frontend M4 scope.

## VIII. Implementation Stop Condition

This document is a plan only. After this revision:

- Do not begin Stage 1 implementation until the user explicitly approves this roadmap.
- Do not commit or push unless explicitly requested.
- Stop after each stage for review, validation results, changed-file list, and git diff summary.
- Do not begin real Builder or compatibility behavior until the M8/M9 prerequisites are implemented and separately approved.
