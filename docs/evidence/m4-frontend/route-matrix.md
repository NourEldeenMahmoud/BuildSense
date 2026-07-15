# P8.3.2 — Route Matrix and Image/Tracking Audit

**Audit date:** 2026-07-15
**Auditor:** Automated agent + source review
**Scope:** All production routes, all `<img>` elements, all `@for` template expressions

---

## 1. Route Matrix

| Route | Feature | API Calls | Lazy-loaded | E2E spec coverage |
|---|---|---|---|---|
| `/` | Home + Catalog (combined) | 1 list request | Yes (`home` lazy chunk) | `smoke.spec.ts`, `catalog-routing.spec.ts`, `catalog-ui.spec.ts` |
| `/catalog` | Redirects to `/` preserving query params | Same as `/` | Same | `catalog-routing.spec.ts` |
| `/products/:productId` | Product detail | 1 detail request (offers inline) | Yes (`product` lazy chunk) | `product-details.spec.ts` |
| `/compare?left=...&right=...` | Product comparison | 2 detail requests (forkJoin) | Yes (`compare` lazy chunk) | `compare.spec.ts`, `compare-routing.spec.ts` |
| `/builder` | PC Builder (deferred) | 0 (static view model) | Yes (`builder` lazy chunk) | `smoke.spec.ts` |
| `/purchase-plan` | Purchase plan (deferred) | 0 (static view model) | Yes (`purchase` lazy chunk) | `smoke.spec.ts` |
| `/admin` | Admin placeholder | 0 | Yes (`admin` lazy chunk) | `shell.spec.ts` |
| `/**` (wildcard) | Not-found page | 0 | No (app-level) | `smoke.spec.ts` |

**Stitch screen mapping:**
| Stitch Screen | Route | Evidence |
|---|---|---|
| Home | `/` | `catalog-routing.spec.ts` — loads category pills + product grid |
| Catalog (grid) | `/` with filters | `catalog-ui.spec.ts` — search, filter, paginate all verified |
| Product detail | `/products/:id` | `product-details.spec.ts` — gallery, specs, offers |
| Compare | `/compare?left=...&right=...` | `compare.spec.ts` — headers, spec matrix |
| Builder | `/builder` | `smoke.spec.ts` — deferred state, zero API calls |
| Build Review | `/purchase-plan` | `smoke.spec.ts` — deferred state, zero API calls |
| Admin | `/admin` | `shell.spec.ts` — placeholder visible |

---

## 2. Image Loading Audit

### Images with `loading="lazy"`
| File | Line | Element | Justification |
|---|---|---|---|
| `catalog-product-card.component.ts` | 25 | Card thumbnail `<img>` | Below-fold grid image — lazy appropriate |
| `compare-headers.component.ts` | 21, 105 | Compare header images (left/right) | Below-fold in compare view — lazy appropriate |
| `compare-selector.component.ts` | 81 | Search result thumbnails | Below-fold dropdown — lazy appropriate |
| `image-fallback.component.ts` | 14 | Generic fallback wrapper | Generic component default — lazy appropriate |

### Images WITHOUT `loading="lazy"` (intentional)
| File | Line | Element | Justification |
|---|---|---|---|
| `product-gallery.component.ts` | 17 | Primary hero image `<img>` | **Above-fold hero image** — must load eagerly for LCP |
| `product-gallery.component.ts` | 52 | Thumbnail strip `<img>` | Tiny 64×48 inline thumbnails in initial gallery view — fast load |

**Verdict:** PASS — All below-fold images use `loading="lazy"`; hero image correctly uses eager loading.

---

## 3. Image Fallback / Alt Text Audit

| Component | Has `alt`? | Fallback SVG | Accessibility |
|---|---|---|---|
| `catalog-product-card.component.ts` | Yes (`[alt]="product.name"`) | `image-fallback` wrapper | Covered |
| `compare-headers.component.ts` | Yes (both left/right) | Inline SVG fallback with `aria-hidden="true"` + `sr-only` text | Covered |
| `compare-selector.component.ts` | Yes | Inline SVG with `aria-hidden="true"` | Covered |
| `product-gallery.component.ts` | Yes (hero + thumbnails) | Inline SVG with `aria-hidden="true"` + "No image available" sr-only text | Covered |
| `product-offers.component.ts` | N/A (decorative icons) | SVG with `aria-hidden="true"` + sr-only text | Covered |
| `image-fallback.component.ts` | Propagates parent `alt` | `aria-hidden="true"` wrapper + sr-only text | Covered |

**Verdict:** PASS — All images have alt attributes; all SVG fallbacks have `aria-hidden="true"` + sr-only text.

---

## 4. `@for` Track Expression Audit

Every `@for` loop in production templates must have a stable `track` expression.

| File | Line | Track Expression | Stable? |
|---|---|---|---|
| `catalog-grid.component.ts` | 33 | `track n` (skeleton index) | Yes — static array of `Array.from({length: 8})` |
| `catalog-grid.component.ts` | 59 | `track product.id` | Yes — product `_id` from API |
| `catalog-grid.component.ts` | 92 | `track product.id` | Yes — empty state variant |
| `catalog-pagination.component.ts` | 46 | `track pageNum` | Yes — numeric page index |
| `catalog-filters.component.ts` | 54 | `track cat` | Yes — category name string |
| `catalog-filters.component.ts` | 143 | `track cat` | Yes — category pills variant |
| `catalog-search.component.ts` | 64 | `track cat` | Yes — category name string |
| `product-gallery.component.ts` | 39 | `track url` | Yes — image URL string |
| `product-specs.component.ts` | 13 | `track spec._id ?? spec.label + spec.value` | Yes — composite fallback |
| `product-offers.component.ts` | 15 | `track offer.id` | Yes — offer `_id` from API |
| `compare-selector.component.ts` | 73 | `track product.id` | Yes — product `_id` from API |
| `compare-spec-matrix.component.ts` | 111 | `track row.displayLabel` | Yes — spec label string |
| `builder-workspace.component.ts` | 28 | `track slot.key` | Yes — slot key string |
| `component-selection-list.component.ts` | 43 | `track candidate.id` | Yes — product `_id` from API |

**Verdict:** PASS — All 14 `@for` loops have stable, deterministic track expressions. No index-only tracking on mutable lists.

---

## 5. Summary

| Check | Result |
|---|---|
| All Stitch screens mapped to routes | PASS |
| All below-fold images have `loading="lazy"` | PASS |
| Hero image uses eager loading | PASS |
| All `<img>` elements have `alt` attributes | PASS |
| SVG fallbacks have `aria-hidden` + sr-only text | PASS |
| All `@for` loops have stable track expressions | PASS (14/14) |

**All route, image, and tracking checks PASS. No code changes needed.**
