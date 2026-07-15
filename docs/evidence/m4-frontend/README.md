# M4 Frontend — Stage 8 Audit Evidence

**Stage:** 8 — Cross-Cutting Accessibility, Performance, and Release Validation
**Checkpoint:** 3 — Final Release Validation, Documentation Accuracy Review, Scope/Diff Review
**Date:** 2026-07-15
**Environment:** Windows 11, Node 22.x, npm (Nx 23.0.2, Angular 19)
**Status:** All checks PASS. Changes uncommitted/unpushed per instruction.

---

## Evidence Files

| File | Covers | Key Results |
|---|---|---|
| [request-audit.md](./request-audit.md) | P8.2.1 — Request behavior | No N+1 detail requests, no duplicates, switchMap cancellation verified, Builder/Purchase Plan zero API calls |
| [bundle-audit.md](./bundle-audit.md) | P8.2.2 — Bundle and assets | 307 kB initial (budget: 500 kB warn / 1 MB error), fixtures excluded, no external CDN, local OFL fonts |
| [route-matrix.md](./route-matrix.md) | P8.3.2 — Route matrix + image/tracking audit | All 8 Stitch screens mapped, all images audited, 14 `@for` track expressions verified stable |

---

## Semantic Landmark Fix (Stage 8 correction)

### Root cause
Four page components (`compare.page.ts`, `home.page.ts`, `builder.page.ts`, `purchase-plan.page.ts`) each rendered a `<main>` element nested inside the shell's single `<main class="app-container app-main">` in `app.component.ts`. This produced duplicate main landmarks per route, violating correct semantic structure (P8.1.1).

### Fix applied
Converted all four nested `<main>` elements to `<section role="region" aria-labelledby="...">` landmarks, preserving each page's heading structure, layout, and styles. Added an `<h2>` in `home.page.ts` to label the previously unlabeled catalog results region. The shell (`app.component.ts`) remains the sole `<main>` landmark owner.

### Files changed
| File | Change |
|---|---|
| `compare.page.ts` | `<main class="compare-page">` → `<section class="compare-page" role="region" aria-label="Product comparison">` |
| `home.page.ts` | `<main id="catalog-results" aria-label="...">` → `<section id="catalog-results" role="region" aria-labelledby="catalog-results-heading">` with new `<h2>` |
| `builder.page.ts` | `<main ... role="main">` → `<section ... role="region">` (removed redundant `role="main"`) |
| `purchase-plan.page.ts` | `<main ... role="main">` → `<section ... role="region">` (removed redundant `role="main"`) |
| `accessibility.spec.ts` | Removed all 9 `.disableRules(['region'])` suppressions |
| `builder.page.test.ts` | Updated landmark assertion: queries `section[role="region"]` instead of `main` |
| `purchase-plan.page.test.ts` | Updated landmark assertion: queries `section[role="region"]` instead of `main` |
| `compare.spec.ts` (E2E) | Updated selector: `main.compare-page` → `section.compare-page` |

### Axe results after fix
- **region rule**: No violations on any route. Each page has exactly one `<main>` (shell-owned) plus zero or more labeled `<section role="region">` landmarks.
- **All routes (Desktop + Mobile)**: Zero serious/critical violations. Zero region violations.

---

## Validation Commands

| Command | Result |
|---|---|
| `npx nx run-many -t lint,typecheck,test,build -p web` | PASS (lint 0 errors, typecheck 0 errors, tests pass, build passes) |
| `npx nx run web:e2e` | PASS (all accessibility tests — zero serious/critical Axe violations, zero region violations) |
| `npx nx run web:build` | PASS |
| `git diff --check` | PASS |

---

## Stage 8 Changed-File Categories

| Category | Files | Count |
|---|---|---|
| Semantic landmark fixes (page components) | `compare.page.ts`, `home.page.ts`, `builder.page.ts`, `purchase-plan.page.ts` | 4 |
| Accessibility spec (suppression removal) | `accessibility.spec.ts` | 1 |
| Unit test updates | `builder.page.test.ts`, `purchase-plan.page.test.ts` | 2 |
| E2E test updates | `compare.spec.ts` | 1 |
| Evidence documentation | `README.md` | 1 |

---

## npm Audit Record

`npm install`/`npm audit` reported 37 vulnerabilities (6 low, 11 moderate, 20 high). They were not remediated because dependency remediation is outside Stage 8 scope and requires separate review.

---

## Unresolved Deviations

None. All acceptance criteria met.

---

## Next Steps

1. Stage 8 complete. Awaiting explicit instruction to commit and push.
