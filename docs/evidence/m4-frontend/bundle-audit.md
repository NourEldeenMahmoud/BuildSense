# P8.2.2 — Bundle and Asset Audit

**Audit date:** 2026-07-15
**Auditor:** Automated agent + source review
**Scope:** Production build (`apps/web`), visual build (`apps/web-visual`), assets directory, CSS, dependencies

---

## 1. Production Bundle Budget

### Configured budgets (`apps/web/project.json`)
| Budget type | Warning threshold | Error threshold |
|---|---|---|
| `initial` | 500 kB | 1 MB |
| `anyComponentStyle` | 4 kB | 8 kB |

### Actual production build output (`npx nx run web:build`)
```
Initial total | 307.15 kB | < 500 kB warning | PASS
```

| File | Size | Within budget? |
|---|---|---|
| `styles.css` | 4.08 kB | Under 8 kB error; marginally above 4 kB warning for global stylesheet (not a component style — `anyComponentStyle` applies to per-component encapsulated styles, not the global entry) |
| `main.js` | 269.10 kB | Yes |
| `polyfills.js` | 33.95 kB | Yes |
| `vendor.js` | negligible chunk | Yes |

**Verdict:** PASS — 307 kB initial, well within 500 kB warning and 1 MB error.

---

## 2. Fixture Exclusion from Production Build

### Searched production build output (`dist/apps/web/browser/`)
| Pattern | Matches |
|---|---|
| `__visual` (fixture route prefix) | 0 |
| `builder-filled-page` (fixture page name) | 0 |
| `component-selection-page` (fixture page name) | 0 |
| `build-review-filled-page` (fixture page name) | 0 |
| `mobile-builder-page` (fixture page name) | 0 |
| `64a1b2c3d4e5f60718293a01` (fixture product ID) | 0 |
| `Ryzen 5 7600X` (fixture product name) | 0 |
| `Intel Core i7-13700K` (fixture product name) | 0 |
| `GeForce RTX 4070` (fixture product name) | 0 |

### Visual build output (`dist/apps/web-visual/browser/`)
| Pattern | Present? |
|---|---|
| `__visual` routes | Yes (expected) |
| `builder-filled` references | Yes (expected) |
| Fixture IDs/names | Yes (expected) |

**Source confirmation:** `apps/web/src/visual/main.visual.ts` is a separate entry point excluded from production build graph. The Angular CLI config in `project.json` defines `build-visual` as a distinct target.

**Verdict:** PASS — Fixtures excluded from production; present only in visual build.

---

## 3. External Dependency Audit

### Forbidden runtime dependencies in production bundle
| Pattern | Matches in `dist/apps/web/browser/` |
|---|---|
| `axe-core` | 0 |
| `AxeBuilder` | 0 |
| `@axe-core/playwright` | 0 |

**Source confirmation:** `@axe-core/playwright@4.12.1` is a devDependency for E2E testing only; imported only in `apps/web/e2e/accessibility.spec.ts`. Tree-shaken from production.

**Verdict:** PASS — No testing/audit dependencies leak into production.

---

## 4. Local Fonts and Assets

### Font files (`apps/web/src/assets/fonts/`)
| File | Usage | License |
|---|---|---|
| `HankenGrotesk-Variable.ttf` | `--font-primary` (UI headings, body, labels) | OFL 1.1 (in `fonts/HankenGrotesk-OFL.txt`) |
| `SpaceMono-Regular.ttf` | `--font-mono` (spec values, codes) | OFL 1.1 (in `fonts/SpaceMono-OFL.txt`) |
| `SpaceMono-Bold.ttf` | `--font-mono` bold weight | OFL 1.1 (same license file) |

### Font-face declarations (`apps/web/src/styles.css`)
```css
@font-face { font-family: 'Hanken Grotesk'; src: url('/assets/fonts/HankenGrotesk-Variable.ttf') format('truetype'); font-weight: 100 900; font-style: normal; font-display: swap; }
@font-face { font-family: 'Space Mono'; src: url('/assets/fonts/SpaceMono-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Space Mono'; src: url('/assets/fonts/SpaceMono-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; font-display: swap; }
```

All three declarations use `font-display: swap` (avoids FOIT). No `@import` from Google Fonts, Typekit, or other CDN.

### Forbidden external requests
| Pattern | Matches in `styles.css` or build output |
|---|---|
| `fonts.googleapis.com` | 0 |
| `fonts.gstatic.com` | 0 |
| `materialdesignicons` or `Material Symbols` | 0 |
| `cdn.tailwindcss` | 0 |

**Verdict:** PASS — Fonts are local, OFL-licensed, with `font-display: swap`. No external font/icon CDN requests.

---

## 5. SVG Strategy

Inline SVGs used as Angular template icons (search, close, menu, camera-placeholder). No external icon font dependency. SVGs are small (< 2 kB each) and inline in component templates — no separate SVG bundle or sprite sheet needed.

**Verdict:** PASS — Inline SVG icons only; no heavy icon library.

---

## 6. Heavy Unapproved Dependencies

| Concern | Status |
|---|---|
| Angular Material or PrimeNG | Not installed (not in `package.json`) |
| Lodash / heavy utility libraries | Not present |
| Chart libraries | Not present |
| Markdown renderers | Not present |
| Only Angular core + Angular CDK + RxJS | Confirmed |

**Verdict:** PASS — No heavy unapproved dependencies.

---

## 7. Summary

| Check | Result |
|---|---|
| Production initial bundle ≤ 500 kB | PASS (307 kB) |
| No budget warnings or errors | PASS |
| Fixtures excluded from production build | PASS |
| No axe-core/testing deps in production | PASS |
| Local fonts with OFL license | PASS |
| `font-display: swap` on all fonts | PASS |
| No external font/icon CDN requests | PASS |
| Inline SVG icons only | PASS |
| No heavy unapproved dependencies | PASS |

**All bundle and asset checks PASS. No code changes needed.**
