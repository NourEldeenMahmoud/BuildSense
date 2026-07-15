# P8.2.1 — Request Behavior Audit

**Audit date:** 2026-07-15
**Auditor:** Automated agent + source review
**Scope:** All production feature routes (Catalog, Product Detail, Compare, Builder, Purchase Plan, Home)
**Evidence sources:** E2E specs (`catalog-routing.spec.ts`, `catalog-ui.spec.ts`, `product-details.spec.ts`, `compare.spec.ts`, `compare-routing.spec.ts`, `smoke.spec.ts`) + store/service source inspection

---

## 1. Catalog — No N+1 Detail Requests

| Scenario | Expected | Evidence |
|---|---|---|
| Initial catalog load (`/`) | Exactly 1 list request, 0 detail, 0 offers | `catalog-routing.spec.ts` line 53: `tracker.list.length === 1`, lines 58-59: `detail === 0`, `offers === 0` |
| Catalog with search/filter/page params | Exactly 1 list request per param change | `catalog-ui.spec.ts` lines 139-141: same assertion pattern; line 164: `tracker.list.length === initial + 1` after search debounce |
| Catalog reload (browser refresh) | Exactly 1 list request (URL restores state) | `catalog-routing.spec.ts` line 92: `tracker.list.length === 1` after reload |
| Navigation to catalog from another route | Exactly 1 list request | `catalog-routing.spec.ts` line 119: `tracker.list.length === 1` after back/forward |

**Source confirmation:** `catalog.store.ts` uses `switchMap` on route-driven observable — each navigation cancels any pending prior list request. Card clicks navigate to `/products/:id` (separate route); no detail fetch occurs from catalog grid.

**Verdict:** PASS — Zero N+1 detail requests from catalog.

---

## 2. Product Detail — Exactly One Detail Request Per Load

| Scenario | Expected | Evidence |
|---|---|---|
| Navigate to `/products/:id` | Exactly 1 detail request | `product-details.spec.ts` line 261: `requestCount === 1` |
| Offers embedded in detail response | No separate offers request | `product-details.spec.ts` lines 283-284: `offersRequested === false` |
| Navigate between products (no reload) | Exactly 1 new detail request (switchMap cancels stale) | `product-details.spec.ts` line 438: "no stale data" test |

**Source confirmation:** `product-detail.store.ts` uses `switchMap` on `productId` param change. Detail response includes offers array; `product-offers.component.ts` renders from `store.product().offers` — no standalone offers API.

**Verdict:** PASS — Exactly 1 detail request per load, offers served inline.

---

## 3. Compare — Exactly 2 Detail Requests Per Valid Load

| Scenario | Expected | Evidence |
|---|---|---|
| Valid compare with 2 IDs | Exactly 2 detail requests (forkJoin) | `compare.spec.ts` line 622: `tracker.requests.length === 2` |
| Valid compare with 2 IDs (routing) | Exactly 2 detail requests | `compare-routing.spec.ts` line 138: `detailRequestCount === 2` |
| Reload comparison page | Exactly 2 more detail requests | `compare.spec.ts` line 645: `tracker.requests.length === countAfterFirstLoad + 2` |
| Error states (missing/malformed IDs) | Zero detail requests | `compare-routing.spec.ts` line 151: `detailRequestCount === 0` |
| No separate offers endpoint | Zero offers requests | `compare.spec.ts` lines 816-817: `offersUrls.length === 0` |

**Source confirmation:** `compare.store.ts` uses `forkJoin([left$, right$])` — fires both detail requests in parallel, completes when both resolve. No offers endpoint called.

**Verdict:** PASS — Exactly 2 detail requests per valid load.

---

## 4. Compare Selector — Stale Request Cancellation (switchMap)

| Scenario | Expected | Evidence |
|---|---|---|
| Rapid typing in search (3+ chars) | switchMap cancels stale intermediate requests | `compare.spec.ts` line 542: "stale search responses do not win (switchMap cancellation)" |
| Search params only: category, page, pageSize | No brand, sort, minPrice, maxPrice, excludeId sent | `compare.spec.ts` lines 379-391: URL param assertion |

**Source confirmation:** `compare-candidate-search.service.ts` uses `switchMap` + `debounceTime(300)`. Only supported params forwarded.

**Verdict:** PASS — Stale requests cancelled; only supported params sent.

---

## 5. Builder and Purchase Plan — Zero API Calls

| Scenario | Expected | Evidence |
|---|---|---|
| Visit `/builder` (no build) | 0 API calls | `smoke.spec.ts` line 58: `apiCalls.length === 0` |
| Visit `/purchase-plan` (no build) | 0 API calls | `smoke.spec.ts` line 76: `apiCalls.length === 0` |

**Source confirmation:** Builder workspace renders static slot definitions (`SLOT_DEFINITIONS` array). Purchase plan page renders from `builderService.getCurrentBuild()` (local state, no HTTP). No backend endpoints exist for these yet.

**Verdict:** PASS — Zero backend requests from Builder/Purchase Plan.

---

## 6. Summary

| Check | Result |
|---|---|
| No catalog N+1 detail requests | PASS |
| No duplicate fetches on navigation | PASS |
| Stale request cancellation (switchMap) | PASS |
| Image lazy loading present | PASS (see `route-matrix.md` §2) |
| Stable Angular `@for` track expressions | PASS (see `route-matrix.md` §4) |

**All request behavior checks PASS. No code changes needed.**
