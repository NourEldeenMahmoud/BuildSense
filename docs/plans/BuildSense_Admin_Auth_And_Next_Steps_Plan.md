# BuildSense Admin Auth & Next Steps Plan

> **Purpose:** Implementation-focused phased plan for admin-only authentication/authorization, admin module, and remaining work to reach portfolio MVP and production readiness.
>
> **Generated from:** Repository audit `docs/audits/BuildSense_TDD_Current_State_Audit.md`, ADR-000 (especially §21 on auth deferral and early admin protection), TDD §6.2 env vars, §19.6 admin endpoints, §21.3 web routes, §27 security, Phase M7; PRD §18.3 and NFR-009.
>
> **Status:** Ready for Approval
>
> **Last revised:** 2026-07-16.

---

## 1. Current Project Status

| Area | Status | Evidence |
|------|--------|----------|
| Repository Foundation | COMPLETE | Nx monorepo, apps/web, apps/api, apps/worker; strict TS; packages/config, packages/database, packages/observability. `packages/config/src/env.ts` has MONGO_URI, MONGO_DB_NAME, API_PORT, LOG_LEVEL. |
| Catalog Feature Implementation | COMPLETE | API routes (`/api/v1/categories`, `/api/v1/products`, `/api/v1/products/:id`, `/api/v1/products/:id/offers`), Angular home page, catalog grid, product details at `/products/:productId`, `/compare` comparison matrix. |
| Catalog Production Data Readiness | PARTIAL | Normalization and publishing pipeline require scheduled production run to fully populate catalog. |
| Persistent Builder | COMPLETE | Build model/repository, CRUD/validate/candidates/purchase-plan routes, Angular builder at `/builder` and `/builder/:publicId`. |
| Compatibility Feature Implementation | COMPLETE | Fact extractors for 7 categories; engine registry with 14 rules in `packages/compatibility-engine`; build validation and candidate selection functional. |
| Compatibility Production Activation | PARTIAL | Fact coverage incomplete for some categories; production reprocessing loop not yet scheduled. |
| Admin Backend | NOT STARTED | `apps/api/src/modules/admin/` directory exists but is empty (0 files). No admin routes mounted. |
| Admin Frontend | NOT STARTED | Only static placeholder `apps/web/src/app/features/admin/admin.page.ts`. Route `/admin` exists but is unprotected. |
| Authentication / Authorization | NOT STARTED | No middleware, session, token enforcement, or auth config. `apps/api/src/middleware/` empty. No admin session/account model. |
| Production Operations | NOT STARTED | No scheduler, no deployment config, no operational monitoring. |

---

## 2. Current User Journey

### Flows that work end-to-end (feature-complete, may use limited production data)

| Flow | Path | Notes |
|------|------|-------|
| Browse catalog | `/` → `/products/:productId` | Products display if published to catalog. |
| Compare products | `/compare` | Requires products in catalog. |
| Build a PC | `/builder` → add items → validate → `/builder/:publicId` | Build CRUD, compatibility validation, candidate selection all functional. |
| Purchase plan | `/builder/:publicId` → `/purchase-plan` | Redirects user to Sigma store per item. |

### Flows that are feature-complete but depend on production data readiness

| Flow | Dependency |
|------|------------|
| Full catalog browsing across all categories | Normalization + publishing pipeline must run. |
| Cross-sell / comparison across brands | Depends on catalog coverage. |
| Purchase plan with accurate pricing | Depends on fresh offer/price data. |

### Flows that are NOT STARTED

| Flow | Gap |
|------|-----|
| Admin login | No auth system exists. |
| Admin dashboard | Placeholder only. |
| Admin scrape run monitoring | No backend, no models. |
| Admin match review / data quality | No backend, no models. |
| Product eligibility review | No admin backend for eligibility overrides. |
| Compatibility quality reports | No admin backend for quality visibility. |
| Production scheduler / reprocessing | No scheduler, no job queue. |
| Rate limiting / CSRF protection | Not implemented. |

---

## 3. Remaining Work and Priority Order

### Portfolio MVP (next deliverable)

1. **Admin authentication** — admin account, session, middleware.
2. **Admin module backend** — dashboard, scrape runs, compatibility quality reports, worker job status.
3. **Admin module frontend** — login page, protected shell, dashboard with real data.
4. **Security hardening** — strict CORS, CSRF token validation, rate limiting.

### Production-Ready Operation

5. **Audited admin actions** — match reviews, data-quality resolution, eligibility overrides, manual classifications, durable reprocessing/backfill requests.
6. **Production normalization / matching pipeline hardening** — scheduled/durable pipeline.
7. **Scheduler / deployment** — worker scheduler, deployment config.

### Deferred Scope

- End-user accounts (ADR-000 explicitly defers).
- Complex RBAC (single ADMIN role only in scope).
- OAuth / external identity providers.
- Redis or external job queue (ADR-000 defers).
- Second store adapter.
- Real-time notifications / websockets.
- Mobile-responsive admin UI refinements.
- Password change flow (stretch goal, not blocking).

---

## 4. Fixed Security Decisions

The following decisions are fixed. They replace earlier tentative recommendations and are not awaiting further approval unless explicitly noted in Section 9.

### 4.1 Admin Role

Single role: `ADMIN`. No end-user accounts, no RBAC hierarchy, no OAuth, no organization model.

### 4.2 Password Hashing

- Algorithm: Node.js built-in `crypto.scrypt`.
- No bcrypt, argon2, or any native/external dependency.
- Store `passwordHash`, `passwordSalt`, and hashing parameters (cost, salt length, key length) plus a version field for future migration.
- Verification uses `crypto.timingSafeEqual` for constant-time comparison.

### 4.3 Session Design

- Opaque random session tokens: at least 32 cryptographically random bytes (`crypto.randomBytes(32)`).
- The raw token is placed only in the HttpOnly cookie. It is never stored, logged, or transmitted except via the cookie.
- Only the SHA-256 hash of the token is stored in MongoDB.
- `AdminSession` fields: `adminId`, `tokenHash`, `createdAt`, `expiresAt`, `lastUsedAt`, `revokedAt` (nullable), optional `userAgent` metadata.
- TTL index on `expiresAt` for automatic MongoDB cleanup.
- No `SESSION_SECRET` — there is no HMAC-signed or JWT session token; the session is a random opaque token.

### 4.4 Session Cookie

Development:
- Name: `buildsense_admin_session`
- `HttpOnly=true`
- `SameSite=Strict`
- `Secure=false` (localhost HTTP)
- `Path=/api/v1/admin`
- Available to every protected admin endpoint under `/api/v1/admin/*`.

Production:
- Name: `__Host-buildsense_admin_session` (the `__Host-` prefix forces Secure and Path=/ in compliant browsers)
- `HttpOnly=true`
- `SameSite=Strict`
- `Secure=true`
- `Path=/`
- Available to every protected admin endpoint under `/api/v1/admin/*`.

### 4.5 CORS and Credentials

API must configure:
```ts
cors({
  origin: WEB_ORIGIN,
  credentials: true,
})
```

Angular admin requests must use `withCredentials: true` for login, logout, me, and every protected admin request.

### 4.6 CSRF Protection

Do not rely on SameSite alone. For POST, PUT, PATCH, DELETE admin requests:
1. Strict `Origin` header validation against `WEB_ORIGIN`.
2. CSRF token validation (double-submit cookie pattern or synchronizer token).
3. `SameSite=Strict` as defense in depth.

GET requests must remain read-only. Write operations must never be triggered by GET.

### 4.7 Bootstrap and Recovery

- CLI flow: `npm run worker -- admin seed --email admin@example.com`
- CLI silently prompts for password, confirms, hashes internally with `crypto.scrypt`, and writes to the database.
- Idempotent: safe to re-run; updates password if email already exists.
- Refuses unsafe defaults (e.g., empty password, common passwords).
- Never logs the password.
- Recovery uses the same CLI to reset/replace the password for an existing admin email.

### 4.8 Environment Schema

New env vars (added to `packages/config/src/env.ts`):
```
WEB_ORIGIN            # strict CORS origin (e.g., http://localhost:4200)
SESSION_MAX_AGE_HOURS # default 24
```

`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD_HASH` are **removed** — bootstrap is handled entirely by the CLI flow, not env vars. `SESSION_SECRET` is not needed.

### 4.9 Architecture Boundaries

- API never scrapes. It never processes raw data.
- Worker owns all ingestion: scraping, normalization, matching, publishing.
- Raw scraped snapshots remain immutable after capture.
- Admin write actions that need worker processing create durable job requests; they do not trigger in-request processing.
- All admin write actions create an `AdminAuditLog` entry with: admin ID, action, target, timestamp, request ID, and reason (for write actions).
- Product eligibility review and compatibility quality reports are in admin scope.

---

## 5. Admin Module Scope

### 5.1 Dashboard Summary

- Total scrape runs (count + last run timestamp).
- Data quality issue count (open / resolved).
- Match review queue count (pending / resolved).
- Worker job status (running / queued / last completed).
- Catalog stats: total products, total offers, last publish timestamp.
- Compatibility quality summary (fact coverage by category, gate pass/fail counts).

### 5.2 Scrape Runs / Failures

- `GET /api/v1/admin/scrape-runs` — paginated list with status, mode, timestamps.
- `GET /api/v1/admin/scrape-runs/:id` — run detail with items, failures, timing.
- Read-only. No HTTP endpoint starts a scraper.

### 5.3 Compatibility Quality Reports

- `GET /api/v1/admin/compatibility-quality` — per-category fact coverage and gate results.
- Read-only. Reprocessing triggered via durable job request.

### 5.4 Data Quality Issues

- `GET /api/v1/admin/data-quality-issues` — list with filters (open/resolved, category).
- `POST /api/v1/admin/data-quality-issues/:id/resolve` — mark resolved with reason + audit note.

### 5.5 Classification / Matching Queues

- `GET /api/v1/admin/match-reviews` — pending match reviews.
- `GET /api/v1/admin/match-reviews/:id` — detail with raw snapshot and candidate products.
- `POST /api/v1/admin/match-reviews/:id/link` — link to existing catalog product.
- `POST /api/v1/admin/match-reviews/:id/create-product` — create new catalog product.
- `POST /api/v1/admin/match-reviews/:id/ignore` — ignore with reason.

### 5.6 Product Eligibility Review

- Admin can review and override product eligibility for the PC builder catalog.
- All overrides are audited.

### 5.7 Audited Reasoned Overrides

- All write actions create an `AdminAuditLog` entry.
- Override must include: reason text, admin ID, timestamp.
- Raw snapshots remain immutable.

### 5.8 Reprocessing / Backfill Requests

- `POST /api/v1/admin/jobs/reprocess` — request worker reprocessing (durable job record).
- Worker picks up asynchronously. No in-request scraping or processing.

### 5.9 Reference Data Visibility

- `GET /api/v1/admin/reference-datasets` — list reference datasets.
- Read-only. Reference data managed via CLI/worker.

### 5.10 Worker Job Status

- `GET /api/v1/admin/jobs` — list recent jobs with status, timestamps.
- `GET /api/v1/admin/jobs/:id` — job detail with progress and errors.

### 5.11 Safe Actions Summary

| Action | Method | Endpoint | Creates Audit Log |
|--------|--------|----------|-------------------|
| Resolve data quality issue | POST | `/admin/data-quality-issues/:id/resolve` | Yes |
| Link match review | POST | `/admin/match-reviews/:id/link` | Yes |
| Create product from match | POST | `/admin/match-reviews/:id/create-product` | Yes |
| Ignore match review | POST | `/admin/match-reviews/:id/ignore` | Yes |
| Override product eligibility | POST | `/admin/eligibility/:id/override` | Yes |
| Request reprocessing job | POST | `/admin/jobs/reprocess` | Yes |

All other admin endpoints are read-only.

---

## 6. Phased Implementation Plan

### Phase 0 — Security Decisions and Configuration

**Objective:** Resolve the ADR conflict, establish the environment schema, and formalize all cookie/CORS/CSRF/session/hashing decisions.

**Dependencies:** None.

**Likely affected files:**
- `docs/ADR/ADR-004-admin-auth-strategy.md` (proposed, new) — formalizes session-based auth with HttpOnly cookie, scrypt hashing, CSRF token, and cookie config.
- `packages/config/src/env.ts` (modify — add `WEB_ORIGIN`, `SESSION_MAX_AGE_HOURS`; remove any `ADMIN_BOOTSTRAP_*` or `SESSION_SECRET` references)
- `.env.example` (modify — add `WEB_ORIGIN` and `SESSION_MAX_AGE_HOURS` placeholders)

**Focused tests:**
- `packages/config/src/env.test.ts` — validate new env schema accepts valid config and rejects missing required fields.
- Verify existing config tests still pass.

**Affected-project validation:**
```bash
npx nx run config:lint
npx nx run config:typecheck
npx nx run config:test
```

**Exit criteria:**
- ADR-004 accepted, documenting all fixed security decisions (cookie naming, scrypt, CSRF, CORS, bootstrap CLI).
- Env schema includes `WEB_ORIGIN` and `SESSION_MAX_AGE_HOURS` with correct types/defaults.
- `.env.example` updated.
- Config lint/typecheck/test pass.
- No `ADMIN_BOOTSTRAP_PASSWORD_HASH`, `ADMIN_BOOTSTRAP_EMAIL`, or `SESSION_SECRET` in env schema.

---

### Phase 1 — Admin Accounts, Sessions, and Auth API

**Objective:** Implement backend admin authentication: account model, session management, seed/reset CLI, login/logout/me endpoints, auth middleware, login rate limiting.

**Dependencies:** Phase 0.

**Likely affected files:**
- `packages/database/src/models/admin-account.ts` (proposed, new) — `AdminAccount` with email, passwordHash, passwordSalt, hashingParams/version, createdAt, updatedAt.
- `packages/database/src/models/admin-session.ts` (proposed, new) — `AdminSession` with adminId, tokenHash, createdAt, expiresAt, lastUsedAt, revokedAt, userAgent. TTL index on expiresAt.
- `packages/database/src/models/admin-audit-log.ts` (proposed, new) — `AdminAuditLog` with adminId, action, target, timestamp, requestId, details.
- `packages/database/src/models/index.ts` (modify — export new models)
- `apps/worker/src/commands/admin-seed.ts` (proposed, new) — CLI: `npm run worker -- admin seed --email <email>`. Prompts for password, confirms, hashes with scrypt, writes AdminAccount. Idempotent. Recovery: `admin seed --email <email> --reset`.
- `apps/api/src/middleware/admin-auth.ts` (proposed, new) — reads session cookie, validates against AdminSession (tokenHash lookup), checks expiry/revocation, attaches `req.admin`. Updates `lastUsedAt`.
- `apps/api/src/modules/admin/admin-auth.service.ts` (proposed, new) — login (find account, scrypt verify, create session, set cookie), logout (revoke session, clear cookie), me (session lookup, return admin info).
- `apps/api/src/modules/admin/admin-auth.routes.ts` (proposed, new) — POST login, POST logout, GET me.
- `apps/api/src/modules/admin/admin-auth.test.ts` (proposed, new)
- `apps/api/src/app.ts` (modify — mount admin auth routes at `/api/v1/admin/auth`, configure CORS with `credentials: true`)

**Focused tests:**
- Password hash/verify: scrypt produces consistent hash; timing-safe comparison works.
- Session creation: login with valid credentials creates session, sets correct cookie (dev and prod config).
- Session expiry: expired session returns 401.
- Session revocation: logout revokes session; subsequent request returns 401.
- TTL index: verify MongoDB TTL index exists on `expiresAt`.
- Login/logout/me: valid login → 200 + cookie; invalid credentials → 401; me with session → 200; me without session → 401; logout → 200 + cleared cookie.
- Unauthorized access: all `/api/v1/admin/*` routes (except login) return 401 without session.
- Rate limiting: 6th login attempt within 15 min → 429.
- Seed CLI: creates admin account with scrypt-hashed password; idempotent on re-run; refuses empty password; never logs password.

**Affected-project validation:**
```bash
npx nx run database:lint
npx nx run database:typecheck
npx nx run database:test
npx nx run api:lint
npx nx run api:typecheck
npx nx run api:test
npx nx run worker:lint
npx nx run worker:typecheck
```

**Exit criteria:**
- Seed CLI creates admin account with scrypt-hashed password; idempotent on re-run.
- POST `/api/v1/admin/auth/login` sets the correct cookie (dev: `buildsense_admin_session`, prod: `__Host-buildsense_admin_session`) and returns `{ ok: true }`.
- GET `/api/v1/admin/auth/me` returns admin info or 401.
- POST `/api/v1/admin/auth/logout` revokes session and clears cookie.
- `requireAdminSession` middleware rejects requests without valid session on all protected routes.
- CORS configured with `origin: WEB_ORIGIN, credentials: true`.
- All tests pass.

---

### Phase 2 — Admin Read Backend

**Objective:** Implement admin read-only API endpoints for dashboard, scrape runs, compatibility quality reports, worker jobs, reference datasets, and catalog/operational statistics.

**Dependencies:** Phase 1.

**Likely affected files:**
- `apps/api/src/modules/admin/admin.service.ts` (proposed, new) — read-only queries for dashboard, scrape runs, quality reports, jobs, reference datasets, stats.
- `apps/api/src/modules/admin/admin.routes.ts` (proposed, new) — GET dashboard, GET scrape-runs, GET scrape-runs/:id, GET compatibility-quality, GET jobs, GET jobs/:id, GET reference-datasets, GET stats.
- `apps/api/src/modules/admin/admin.controller.ts` (proposed, new)
- `apps/api/src/modules/admin/admin.test.ts` (proposed, new) — read endpoint tests.
- `apps/api/src/app.ts` (modify — mount admin read routes under `/api/v1/admin` with auth middleware)

**Focused tests:**
- All admin read routes return 401 without session cookie.
- All admin read routes return correct data shape with valid session.
- Dashboard returns aggregate stats (counts, last timestamps).
- Scrape runs list returns paginated results.
- Compatibility quality returns per-category coverage.
- Worker jobs list returns status and timestamps.

**Affected-project validation:**
```bash
npx nx run api:lint
npx nx run api:typecheck
npx nx run api:test
```

**Exit criteria:**
- All admin read endpoints require valid session.
- Endpoints return correct data shape matching admin DTOs (in `packages/contracts`).
- 401 for unauthenticated requests.
- All API tests pass.

---

### Phase 3 — Angular Auth and Admin Read UI

**Objective:** Implement protected Angular admin shell with login page, route guards, and pages that consume the Phase 2 read APIs.

**Dependencies:** Phase 1, Phase 2.

**Likely affected files:**
- `apps/web/src/app/features/admin/admin-auth.service.ts` (proposed, new) — calls login/logout/me endpoints with `withCredentials: true`, manages observable auth state.
- `apps/web/src/app/features/admin/admin.guard.ts` (proposed, new) — canActivate; calls `GET /api/v1/admin/auth/me`; redirects to `/admin/login` on 401.
- `apps/web/src/app/features/admin/admin.page.ts` (modify — replace placeholder with layout/shell)
- `apps/web/src/app/features/admin/admin-login.page.ts` (proposed, new) — email + password form; calls login; redirects to `/admin` on success.
- `apps/web/src/app/features/admin/admin-layout.component.ts` (proposed, new) — sidebar/topbar with logout button; wraps admin child routes.
- `apps/web/src/app/features/admin/admin-dashboard.page.ts` (proposed, new) — calls dashboard endpoint; displays summary cards.
- `apps/web/src/app/features/admin/admin-scrape-runs.page.ts` (proposed, new)
- `apps/web/src/app/features/admin/admin-scrape-run-detail.page.ts` (proposed, new)
- `apps/web/src/app/features/admin/admin-quality-reports.page.ts` (proposed, new)
- `apps/web/src/app/features/admin/admin.service.ts` (proposed, new) — HTTP client with `withCredentials: true` for all admin API calls.
- `apps/web/src/app/app.routes.ts` (modify — restructure `/admin` with guard and children)

**Focused tests:**
- AdminGuard: redirects to `/admin/login` when not authenticated; allows navigation when authenticated.
- AdminAuthService: login calls correct endpoint with `withCredentials: true`; logout clears state; me validates session.
- AdminService: all HTTP calls include `withCredentials: true`.
- Dashboard component renders stats from API.
- Scrape runs component renders list items.
- Route structure: admin child routes resolve correctly under guard.

**Affected-project validation:**
```bash
npx nx run web:lint
npx nx run web:typecheck
npx nx run web:test
```

**Exit criteria:**
- Navigating to `/admin` without session redirects to `/admin/login`.
- Login form submits and sets session via cookie.
- After login, admin dashboard loads with real data from API.
- Logout returns to login page.
- All admin HTTP requests use `withCredentials: true`.
- All web tests pass.

---

### Phase 4 — Audited Admin Actions

**Objective:** Implement admin write actions for match reviews, data-quality resolution, product eligibility overrides, manual classifications, and durable reprocessing/backfill requests — all with required reason and audit record.

**Dependencies:** Phase 1, Phase 2.

**Likely affected files:**
- `packages/database/src/models/match-review.ts` (proposed, new)
- `packages/database/src/models/data-quality-issue.ts` (proposed, new)
- `packages/database/src/models/eligibility-override.ts` (proposed, new)
- `packages/database/src/models/admin-job.ts` (proposed, new) — durable job request record.
- `packages/database/src/models/index.ts` (modify — export new models)
- `packages/contracts/src/admin.dtos.ts` (proposed, new) — request/response DTOs for admin write actions.
- `apps/api/src/modules/admin/admin.routes.ts` (modify — add write endpoints)
- `apps/api/src/modules/admin/admin.service.ts` (modify — add write methods with audit logging)
- `apps/api/src/modules/admin/admin.test.ts` (modify — add write action tests)
- `apps/worker/src/commands/admin-jobs.ts` (proposed, new) — worker-side job consumer for reprocessing requests.

**Focused tests:**
- Audit creation: every write action creates an AdminAuditLog entry with adminId, action, target, timestamp, requestId, reason.
- Match review resolution: link creates audit + updates status; create-product creates catalog product + audit; ignore records reason + audit.
- Data quality resolution: resolve creates audit + marks resolved.
- Eligibility override: creates audit, records reason, does not mutate raw snapshot.
- Reprocessing job request: creates durable job record; returns job ID; does not trigger in-request processing.
- All write actions return 401 without session.
- All write actions return 400 without reason.
- Raw snapshots remain immutable (no write action modifies snapshot data).

**Affected-project validation:**
```bash
npx nx run database:lint
npx nx run database:typecheck
npx nx run database:test
npx nx run api:lint
npx nx run api:typecheck
npx nx run api:test
```

**Exit criteria:**
- All match review, data quality, eligibility, and job endpoints functional.
- Every write action creates an audit log entry with required fields.
- Raw snapshots immutable.
- Durable job requests created but not executed in-request.
- All tests pass.

---

### Phase 5 — Security and End-to-End Validation

**Objective:** Validate all security controls end-to-end: CSRF, Origin validation, cookie flags, session expiry/revocation, throttling, and one complete admin E2E flow.

**Dependencies:** Phase 3, Phase 4.

**Likely affected files:**
- `apps/api/src/modules/admin/admin-auth.test.ts` (modify — add CSRF/Origin tests)
- `apps/api/src/modules/admin/admin.test.ts` (modify — add E2E validation tests)
- `apps/web/src/app/features/admin/admin.guard.spec.ts` (modify — session recovery tests)

**Focused tests:**
- CSRF: POST/PUT/PATCH/DELETE without valid CSRF token → 403. GET remains read-only.
- Origin validation: request with mismatched Origin header → rejected.
- Cookie flags: verify `HttpOnly`, `SameSite=Strict`, correct `Secure` and `Path` values in dev and prod configuration.
- Session expiry: expired session → 401; `expiresAt` TTL index functional.
- Session revocation: revoked session → 401.
- Throttling: login rate limiting functional (5 attempts / 15 min per IP).
- Admin E2E: login → navigate dashboard → view scrape runs → resolve a data quality issue with reason → verify audit log entry → logout. One complete flow covering the critical path.

**Affected-project validation:**
```bash
npx nx run api:lint
npx nx run api:typecheck
npx nx run api:test
npx nx run web:lint
npx nx run web:typecheck
npx nx run web:test
npx nx run database:lint
npx nx run database:typecheck
npx nx run database:test
```

**Exit criteria:**
- CSRF protection validated on all write endpoints.
- Origin validation rejects cross-origin write requests.
- Cookie flags correct for both dev and prod configurations.
- Session expiry and revocation both produce 401.
- Rate limiting enforced on login.
- One complete admin E2E flow passes: login → protected read → audited write → logout.
- All tests pass across affected packages.

---

## 7. Testing Policy

**Risk-based testing only.** No exhaustive static/framework/UI-branch coverage requirements.

### Must Test (high priority)

| Area | Test Type | Rationale |
|------|-----------|-----------|
| Password hash/verify (scrypt) | Unit | Incorrect hashing = plaintext leak. |
| Session creation / expiry / revocation / TTL | Unit + integration | Stale or unrevoked sessions leak access. |
| Login / logout / me | Unit + integration | Core auth flow. |
| Unauthorized access to admin routes | Integration | Every admin endpoint must reject unauthenticated requests. |
| CSRF / Origin validation | Integration | Write actions without CSRF protection are exploitable. |
| Guard / session recovery (Angular) | Unit | Client-side auth state and redirect logic. |
| Audit log creation | Unit | Every write action must create an audit entry. |
| One critical admin operation (match review resolution) | Unit + integration | Data correctness — wrong link corrupts catalog. |
| One complete admin E2E | E2E | Validates full integration: login → read → write → audit → logout. |

### Must NOT Test (explicitly excluded)

- Trivial getters and setters.
- Framework behavior (Express routing, Angular DI, Mongoose schema compilation).
- Static config mappings.
- UI branch coverage for all component states.
- Cookie serialization internals.
- Node.js crypto primitive correctness (trust the library).

### Validation Per Phase

Each phase runs lint, typecheck, and tests only for the affected project(s). No full monorepo suite after every task.

---

## 8. Decisions Now Fixed

The following are no longer open for approval:

| Decision | Fixed Value |
|----------|-------------|
| Hashing algorithm | `crypto.scrypt` — no bcrypt, argon2, or native dependency |
| Session token format | Opaque random, ≥ 32 bytes; only SHA-256(token) in MongoDB |
| Session storage | MongoDB-backed (no Redis) |
| CSRF defense | Origin validation + CSRF token + SameSite=Strict |
| Cookie name (dev) | `buildsense_admin_session` |
| Cookie name (prod) | `__Host-buildsense_admin_session` |
| Bootstrap mechanism | CLI (`npm run worker -- admin seed --email <email>`) — no env-var bootstrap hash |
| Recovery mechanism | Same CLI with `--reset` flag |
| Role model | Single `ADMIN` role, no RBAC |
| SESSION_SECRET | Not used — no signed/JWT session tokens |
| ADMIN_BOOTSTRAP_PASSWORD_HASH | Removed — bootstrap is CLI-only |
| ADMIN_BOOTSTRAP_EMAIL | Removed — passed as CLI argument |

## 9. Remaining Approval Decisions

Only the following require explicit approval before implementation begins:

1. **ADR-004 acceptance** — The ADR document itself must be reviewed and accepted. Its content is fixed per this plan.
2. **Admin write action set** — The exact set of write actions (match review link/create/ignore, data quality resolve, eligibility override, reprocess request) should be confirmed or trimmed.

## 10. Deferred Scope

- End-user accounts and OAuth.
- Complex RBAC (single ADMIN role only).
- Redis / external job queue.
- Second store adapter.
- Production scheduler and deployment.
- Real-time notifications.
- Mobile-responsive admin refinements.
- Password change flow (stretch goal, not blocking).
- Admin frontend for reprocessing job management (CLI sufficient for MVP).

## 11. Admin/Auth Definition of Done

- [ ] ADR-004 accepted.
- [ ] Env schema includes `WEB_ORIGIN` and `SESSION_MAX_AGE_HOURS`; no `ADMIN_BOOTSTRAP_*` or `SESSION_SECRET`.
- [ ] Admin account created via CLI seed with scrypt hashing; idempotent; never logs password.
- [ ] Login with email/password creates server-side opaque session; raw token only in HttpOnly cookie.
- [ ] Dev cookie: `buildsense_admin_session`, HttpOnly, SameSite=Strict, Secure=false, Path=/api/v1/admin.
- [ ] Prod cookie: `__Host-buildsense_admin_session`, HttpOnly, SameSite=Strict, Secure=true, Path=/.
- [ ] Cookie available to every protected admin endpoint under `/api/v1/admin/*`.
- [ ] CORS: `origin: WEB_ORIGIN, credentials: true`.
- [ ] Angular admin requests use `withCredentials: true` for all admin endpoints.
- [ ] POST/PUT/PATCH/DELETE protected by Origin validation + CSRF token + SameSite=Strict.
- [ ] GET endpoints are read-only.
- [ ] All `/api/v1/admin/*` routes (except login) require valid session.
- [ ] Logout revokes session and clears cookie.
- [ ] Session TTL index on `expiresAt` in MongoDB.
- [ ] Angular admin pages protected by route guard.
- [ ] Login page functional with session recovery via `/auth/me`.
- [ ] Rate limiting on login endpoint (5 attempts / 15 min per IP).
- [ ] All write actions require reason and create audit log entry.
- [ ] Product eligibility review and compatibility quality reports in admin scope.
- [ ] All tests pass (auth, API, web, database).
- [ ] No source file outside admin scope modified without justification.

## 12. Post-Admin/Auth Work for Portfolio MVP and Production Readiness

After Admin/Auth is complete:

1. Production normalization pipeline (scheduled reprocessing).
2. Production matching pipeline (match review seeding + resolution loop).
3. Fact extraction full coverage + re-extraction on data update.
4. Worker scheduler (cron-based job execution).
5. Deployment configuration (environment setup, CI/CD).
6. Data quality monitoring and alerting.
7. Rate limiting on public endpoints.
8. Performance baseline and optimization.
