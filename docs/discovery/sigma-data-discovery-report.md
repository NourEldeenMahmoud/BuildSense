# Sigma Data Discovery Report

**Version:** 1.0  
**Date:** 13 July 2026  
**Status:** Complete  
**Author:** BuildSense Team

---

## Executive Summary

M1 contains 31 HTML fixtures (11 category and 20 product pages), fixture-backed parser spikes, verified category seeds, a raw specification inventory, and output snapshots. The fixture set covers unavailable stock, variant attributes, and first/middle/terminal pagination behavior while remaining within the TDD target of 30-50 pages.

---

## 1. Objectives

1. Explore Sigma Computer's website structure and data format
2. Capture representative HTML fixtures for parser development
3. Build fixture-backed category and product parser spikes
4. Extract and inventory all specification labels
5. Document findings and architectural decisions

---

## 2. Methodology

### 2.1 Access Assessment

- **robots.txt**: `https://www.sigma-computer.com/robots.txt` reviewed on 13 July 2026; `User-Agent: *` allows page routes and disallows `/api/`, `/admin/`, account, checkout, and selected generated assets
- **Terms review**: The English footer exposes privacy, return, warranty, and shipping policy pages but no terms page. `/en/terms`, `/en/terms-and-conditions`, `/terms`, and `/terms-and-conditions` were checked on 13 July 2026; the first two returned 404 and the latter two rendered the generic storefront shell rather than terms content. No dedicated terms page was found.
- **Request policy**: No crawl delay is declared; M2 still owns explicit rate and concurrency configuration
- **Decision**: Proceed with HTTP-first scraping (ADR-002)

### 2.2 Site Structure Analysis

**Technology Stack:**
- Next.js App Router with React Server Components (RSC)
- Data embedded in `self.__next_f.push()` script tags
- RSC flight data splits large objects across multiple 4KB chunks

**URL Patterns:**
- Product pages: `/en/item?id={slug}`
- Category pages: `/en/category/{uuid}`
- API images: `http://api.sigma-computer.com/media/{uuid}`

### 2.3 Fixture Selection

**31 fixtures captured:**

| Category | Product Pages | Category Page |
|----------|---------------|---------------|
| CPU | 2 | 1 |
| GPU | 2 | 1 |
| Motherboard | 2 | 1 |
| RAM | 2 | 1 |
| Storage | 2 | 1 |
| PSU | 2 | 1 |
| Case | 2 | 1 |
| Cooling | 2 | 1 |
| Bundle | 2 | 1 |

Additional edge fixtures:

1. Unavailable Intel CPU product (`is_stock: false`) with discounted pricing.
2. ACER external SSD with `variant_attributes: { "capacity": "2TB" }`.
3. CPU page 2 (`isNext: true`, `isPrevious: true`).
4. CPU page 8 (`isNext: false`, `isPrevious: true`, one product).

---

## 3. Technical Findings

### 3.1 RSC Data Extraction

**Key Discovery**: Next.js RSC flight data embeds large JSON objects as **stringified JSON within data strings**, split across multiple `self.__next_f.push()` calls at 4KB boundaries.

**Solution Implemented:**
1. Locate each `self.__next_f.push(` call with a string-aware JSON-array scanner.
2. Concatenate RSC string chunks and scan complete JSON objects via brace matching.
3. Use `deepFindAll` and `deepFindHasKey` to locate target objects.

**Code Location:** `packages/sigma-adapter/src/rsc-extract.ts`

### 3.2 Product Data Structure

Product data is consistently available in RSC payloads with this structure:

```typescript
{
  id: string;           // UUID
  slug: string;         // URL-friendly identifier
  name: string;         // Product display name
  sku: string;          // Stock keeping unit
  price: {
    base: number;
    current: number;
    discount_percentage: number;
    currency: string;   // "EGP"
  };
  specifications: Array<{
    id: string;
    name: string;       // Spec label
    value: string;      // Spec value
    order: number;
    priority: number;
    meta: string[];
  }>;
  category: {
    id: string;
    name: string;
    parent_category?: {...};
  };
  brand: {
    id: string;
    name: string;
  } | null;
  // ... other fields
}
```

### 3.3 Category Data Structure

Category pages contain product cards with limited data:

```typescript
{
  id: string | null;       // null in the HTML fallback
  slug: string;
  name: string;
  price: {
    base: number | null;
    current: number;
    discount_percentage: number | null;
    currency: string | null;
  };
  thumbnail: {...} | null;
  category: {...} | null;
  brand: {...} | null;
  is_stock: boolean | null;
  // No specifications in category view
}
```

**Pagination:**
```typescript
{
  totalItems: number;  // Mapped from Sigma's misleading totalPages source key
  perPage: number;     // Default: 16
  isNext: boolean;
  isPrevious: boolean;
}
```

### 3.4 Breadcrumb Structure

HTML breadcrumbs use Chakra UI components:

```html
<nav aria-label="breadcrumb">
  <ol>
    <li><a href="#">Home</a></li>
    <li></li>  <!-- separator -->
    <li><span aria-current="page">CPU</span></li>
  </ol>
</nav>
```

### 3.5 Candidate Selectors

| Data | Selector or marker | Notes |
|---|---|---|
| RSC push payload | `self.__next_f.push(` | Parse the following JSON array with string and escape handling; do not use a delimiter-only regex. |
| Category product links | `a[href*="/en/item?id="]` | HTML fallback only; deduplicated by slug. |
| Category card | `.flex.flex-col` | HTML fallback card ancestor. |
| Product title | `a[href="{productHref}"]` | Match the link associated with the current fallback slug. |
| Displayed fallback price | `.font-bold` | Parses only displayed current price; base and discount remain null. |
| Breadcrumb | `nav[aria-label="breadcrumb"] ol li` | Links are ancestors; the current item is `span[aria-current="page"]`. |

### 3.6 Pagination Behavior

Category pagination is one-based and uses `?page={number}`. For the CPU seed (`9f503b67-b433-4434-8879-ebd003dce713`), RSC reports `totalPages: 113` and `perPage: 16`; the field behaves as 113 total items, yielding eight pages. The adapter exposes it as `totalItems`.

| Fixture | Request | Products | isPrevious | isNext |
|---|---|---:|---:|---:|
| `cpu-category.html` | no `page` query | 16 | false | true |
| `cpu-category-page-2.html` | `?page=2` | 16 | true | true |
| `cpu-category-page-8.html` | `?page=8` | 1 | true | false |

---

## 4. Specification Label Inventory

### 4.1 Summary

- **Total unique case-sensitive labels**: 129
- **Labels appearing in 2+ products**: 98
- **Labels appearing in 1 product**: 31

### 4.2 Labels by Category

| Category | Unique Labels | Example Labels |
|----------|---------------|----------------|
| CPU | 22 | CPU Socket, Total Cores, TDP, Architecture |
| GPU | 26 | CUDA Cores, Memory Size, Boost Clock |
| Motherboard | 25 | Chipset, DIMM Slots, M.2 Slots |
| RAM | 13 | Speed, CAS Latency, Voltage |
| Storage | 4 | Capacity, Interface, Max Sequential Read |
| PSU | 10 | Maximum Power, Modular, Energy-Efficient |
| Case | 20 | Max GPU Length, Fan Options, Radiator Options |
| Cooler | 28 | Fan Size, Heatpipes, Noise Level |
| Bundle | 7 | CPU, GPU, Motherboard, RAM, SSD, Cooler |

### 4.3 Key Observations

1. **Category-specific labels**: Most specs are unique to their category
2. **Generic labels**: "Brand", "Series", "Type" appear across categories
3. **Inconsistent casing**: Mix of "Model", "MODEL NAME", "COLOR"
4. **Typos**: "Bluetoooht & Wireless" (in source data)
5. **Missing specs**: Some products (e.g., Transcend ESD310) have no specifications

---

## 5. Parser Spikes

### 5.1 Package Structure

```text
packages/sigma-adapter/
├── src/
│   ├── types.ts                    # TypeScript types
│   ├── rsc-extract.ts             # RSC flight data extraction
│   ├── parse-product-page.ts      # Product page parser
│   ├── parse-category-page.ts     # Category page parser
│   ├── category-seeds.ts          # Category seed config
│   ├── index.ts                   # Package exports
│   ├── validate-product.ts         # Runtime product-shape validation
│   ├── rsc-extract.test.ts         # Delimiter and escaping regressions
│   ├── fixture-regression.test.ts  # Snapshots for every captured fixture
│   ├── parse-product-page.test.ts # 17 tests
│   └── parse-category-page.test.ts # 15 tests
└── package.json
```

### 5.2 Test Coverage

| Parser | Tests | Status |
|--------|-------|--------|
| Product Parser | 17 | Passed |
| Category Parser | 15 | Passed |
| RSC Extraction | 2 | Passed |
| Fixture Snapshots | 31 | Passed |
| **Total** | **65** | **Passed** |

### 5.3 Validation Results

| Check | Result |
|-------|--------|
| Lint | Passed for 10 projects |
| Typecheck | Passed for 10 projects |
| Test | Passed: 78 tests, including 65 sigma-adapter tests |
| Build | Passed for 10 projects |
| Format | Passed |

---

## 6. Deliverables

### 6.1 Artifacts Created

| Artifact | Location | Description |
|----------|----------|-------------|
| HTML Fixtures | `fixtures/sigma/` | 31 HTML files |
| Fixture Manifest | `fixtures/sigma/manifest.json` | Metadata for all fixtures |
| Spec Label Inventory | `docs/discovery/spec-label-inventory.csv` | 129 case-sensitive raw labels |
| Data Dictionary | `docs/discovery/data-dictionary-v0.1.md` | Core entity definitions |
| Category Seeds | `packages/sigma-adapter/src/category-seeds.ts` | 9 fixture-verified category IDs |
| ADR-002 | `docs/ADR/ADR-002-http-first-scraping.md` | Scraping strategy |

### 6.2 Code Changes

| File | Changes |
|------|---------|
| `rsc-extract.ts` | String-aware RSC push parsing, cross-chunk extraction, and brace matching |
| `parse-category-page.ts` | Uses `deepFindHasKey` for products/pagination |
| `parse-product-page.ts` | Uses `deepFindAll` with predicate for specifications |
| `index.ts` | Added exports for category seeds |
| `package.json` | Added `cheerio@1.0.0` dependency |
| `scripts/generate-sigma-fixture-manifest.mjs` | Regenerates the fixture manifest from parsed responses |
| `scripts/generate-sigma-spec-label-inventory.mjs` | Regenerates the raw label inventory from parsed product fixtures |

Regenerate these artifacts with `npm run fixtures:sigma:manifest` and `npm run fixtures:sigma:labels`. Each command builds `sigma-adapter` before using its generated parser output.

---

## 7. Recommendations for M2

### 7.1 Immediate Next Steps

1. **Implement StoreScraperAdapter** interface (TDD §8.1)
2. **Build HTTP client** with retry logic and rate limiting
3. **Implement category seed crawler** to discover subcategories
4. **Add Playwright only if a live route check proves HTTP data is insufficient**

### 7.2 Technical Debt

1. **Category names**: Need to extract from breadcrumbs or RSC data
2. **Pagination semantics**: Verify during M2 live checks that Sigma's `totalPages` source value consistently represents total items
3. **Bundle handling**: Preserve each bundle as one catalog-only product and retain component descriptions as raw display data
4. **Nullable brands**: One captured bundle has no brand and normalization must preserve that source condition

### 7.3 Risks to Monitor

1. **RSC format changes**: Sigma may update Next.js version
2. **Anti-bot measures**: May be added without notice
3. **Dynamic content**: More pages may move to client-side rendering

---

## 8. Conclusion

M1 established a fixture-backed foundation for Sigma parsing and validated the HTTP-first decision for the captured routes. The fixture set now covers the sampled category families, unavailable stock, variant attributes, and first/middle/terminal pagination states.

**M1 Exit Criteria Status:**
- Met: at least one fixture per category plus unavailable, variant, and pagination boundary cases
- Met: HTTP is sufficient for captured routes; Playwright requires route-specific evidence
- Met: parser tests and output snapshots cover every captured fixture
- Met: no full scraper started before parser tests passed

---

## Appendix A: Fixture List

### Category Pages (11)

1. `bundles-category.html`
2. `case-category.html`
3. `cooling-category.html`
4. `cpu-category.html`
5. `gpu-category.html`
6. `motherboard-category.html`
7. `psu-category.html`
8. `ram-category.html`
9. `storage-category.html`
10. `cpu-category-page-2.html` (middle page)
11. `cpu-category-page-8.html` (terminal page)

### Product Pages (20)

1. `aerocool-p500d.html` (Case + PSU bundle)
2. `amd-ryzen-7-9700x.html` (CPU)
3. `amd-ryzen-7-9850x3d.html` (CPU)
4. `antec-flux-m.html` (Case)
5. `corsair-vengeance-16gb-lpx-3200.html` (RAM)
6. `fighter-a62-bundle.html` (Bundle)
7. `gigabyte-x870e-aorus-master-x3d.html` (Motherboard)
8. `id-cooling-frozn-a620.html` (Cooler)
9. `intel-ultra-5-225f-bundle.html` (Bundle)
10. `klevv-bolt-v-32gb-ddr5-6400.html` (RAM)
11. `msi-mag-b850m-mortar-wifi.html` (Motherboard)
12. `msi-rtx-3050-ventus-2x.html` (GPU)
13. `msi-rtx-5070-shadow-2x.html` (GPU)
14. `redragon-rm112-128gb.html` (Storage)
15. `seasonic-core-bc-850.html` (PSU)
16. `seasonic-core-gc-850.html` (PSU)
17. `transcend-esd310-512gb.html` (Storage)
18. `xigmatek-aero-dgt-360.html` (Cooler)
19. `intel-core-i5-13400f-out-of-stock.html` (unavailable CPU)
20. `acer-predator-gp30-2tb-variant.html` (variant attributes)

---

## Appendix B: Documentation References

- ADR-000: Project Foundation Decisions
- ADR-001: MongoDB Atlas Default
- ADR-002: HTTP-First Scraping Strategy
- TDD §8.1: StoreScraperAdapter contract
- TDD §33: Implementation phases M0-M11
