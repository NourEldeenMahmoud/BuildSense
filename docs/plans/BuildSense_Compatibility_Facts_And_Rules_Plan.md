# BuildSense — Compatibility Facts & Rules Follow-on Plan

**Status:** Follow-on — Ready for Review  
**Created:** 16 July 2026  
**Scope:** Compatibility fact extraction, quality-gated rule implementation, candidate warning group, and real evaluation for the seven-slot builder  
**Owner:** Nour Eldeen Mahmoud  
**Depends on:** Fast Track foundation (commits `72fdb0f`, `1bfca9b`, `439426c`)

---

## 1. Objective

Wire real compatibility facts and rules into the existing Build API and Builder UI. Worker extracts structured facts from `CatalogProduct.rawSpecifications` into typed `CatalogProduct.compatibility` documents. A pure `packages/compatibility-facts` package owns seven-category extractors and normalization aliases scoped to compatibility. The `compatibility-engine` gains typed rule implementations with quality and reference-data activation gates. The Build API evaluates real facts at item mutation and validation time. The Builder UI displays four candidate groups including `COMPATIBLE_WITH_WARNINGS` with top reasons and evidence.

---

## 2. Success Metrics

- All seven categories produce structured facts from raw specifications with versioned extractor evidence.
- Every active-scope rule produces PASS, ERROR, WARNING, or UNKNOWN deterministically — never hangs, never fabricates facts, never passes with missing required data.
- `CatalogProduct.compatibility` is typed and populated; `CategoryQualityReport` is a separate store with per-fact coverage/precision metrics.
- Build API snapshots contain real statuses. Candidate products group into four categories with top reasons.
- Builder UI shows real compatibility status, evidence, and warning group without replanning persistent builder logic.
- No architectural boundary violations. No snapshot identity traversal. No payment processing. No reimplementation of Build CRUD.
- All focused validation passes. Phase-completion validation passes.

---

## 3. Completed Baseline (Do Not Repeat)

| Component | Status | Key Files |
|-----------|--------|-----------|
| Domain types | Complete | `packages/domain/src/build.ts` — `BuildSlot`, `CompatibilitySlotStatus`, `BuildCompatibilityStatus`, `SLOT_QUANTITY_CONSTRAINTS` |
| Contracts | Complete | `packages/contracts/src/build.ts` — `BuildDto`, `SlotCompatibilityDto`, `CandidateCompatibilityGroupDto` (3-group status), `PurchasePlanDto` |
| Compatibility engine scaffold | Complete, zero rules | `packages/compatibility-engine/src/types.ts`, `engine.ts` — `CompatibilityEngine`, `reduceBuildStatus`, registry/classifier interfaces |
| Catalog product model | Complete, untyped compatibility | `packages/database/src/models/catalog-product.ts` — `rawSpecifications`, `compatibility: Record<string, unknown>` |
| Build model/repository | Complete | `packages/database` — Build model with optimistic concurrency, `updateSnapshots` |
| Build API (8 endpoints) | Complete, empty-facts evaluation | `apps/api/src/modules/builds/builds.service.ts` — currently passes `new Map()` to engine, candidates all UNKNOWN |
| Builder UI + Purchase Plan | Complete, real API-driven | `apps/web/src/app/features/builder/`, `features/purchase-plan/` |
| Persistent journey E2E | Complete | E2E tests pass |

---

## 4. Non-Goals (Explicitly Deferred)

| Item | Reason |
|------|--------|
| Cooler / Case Fans slots, rules, extractors | Slots deferred from active 7-slot model |
| Production scraper closure | Deferred |
| M2 pagination | Deferred; gates production coverage claims, not implementation |
| Admin backend | M7 scope |
| Scheduler / deployment | Deferred |
| Second store | Deferred |
| Advanced scoring / ranking | Deferred |
| `RawProductSnapshot` identity traversal | Future fallback after scraper/identity-linking production readiness |
| General production normalization/matching pipeline | Deferred; only compatibility-specific aliases scoped here |
| Persistent Builder / Purchase Plan reimplementation | Already complete; this plan adds only status display |
| Payment processing | Never in scope |

---

## 5. Source & Decision Traceability

### Documentation Sections Consulted

- **ADR-000** §2, §3 (ADR-000.1–.23), §9, §10: compatibility rules typed, missing data → UNKNOWN, Worker owns ingestion, raw-first/immutable, architecture boundaries
- **TDD §15.1–15.9**: compatibility statuses, rule evaluation, registry, candidates, suggestion score
- **TDD §15.5**: Rule Registry — instantiates 15 classes (omits CMP-MB-RAM-002 and CMP-MB-RAM-005)
- **TDD §15.7**: Rule Catalog P0 — defines 17 coded behaviors
- **TDD §15.8**: Candidate Classification — defines four groups including `COMPATIBLE_WITH_WARNINGS`
- **TDD §17**: Bundles (deferred as builder-ineligible)
- **TDD §23**: Reference data / change control
- **TDD §24**: Database
- **Existing plan**: `docs/plans/BuildSense_Compatibility_And_Builder_Plan.md` §3 (fact/quality schema design), §4 (UNKNOWN invariant), §7 (engine scaffold)
- **ADR-002**: HTTP-first scraping (not consulted — extraction in this plan reads `rawSpecifications`, not live scraping)

### §15.5 / §15.7 Discrepancy (Explicit — Do Not Silently Edit TDD)

TDD §15.5 registers 15 rule classes. TDD §15.7 defines 17 coded behaviors. The two missing from §15.5 are:

| Rule | TDD §15.7 | TDD §15.5 Registry | Plan Action |
|------|-----------|---------------------|-------------|
| **CMP-MB-RAM-002** Module Type | Defined | **Missing** | Include in registry and implementation. SODIMM vs DIMM check. |
| **CMP-MB-RAM-005** Speed | Defined | **Missing** | Include in registry and implementation. RAM speed vs board max. |

This plan covers all 17 TDD §15.7 behaviors. The discrepancy is documented here without editing source TDD.

### Decisions That Override or Clarify Source Documents

| Decision | Supersedes | Detail |
|----------|-----------|--------|
| PSU formula: `cpuWatts + gpuBoardPowerWatts + 100W` platform allowance | TDD §15.7 granular formula with `ramAllowance`, `storageAllowance`, `fanAllowance`, `fixedMiscAllowance`, `roundUpTo50`, `gpuRecommendedPsu` | Simplified for P0. ERROR below estimate; WARNING at estimate up to below 20% headroom; PASS at/above 20%; UNKNOWN when required facts missing. Recorded here; no TDD edit. |
| CMP-CPU-MB-002 included in registry but inactive/UNKNOWN | TDD §15.7 defines it as active P0 | Authoritative versioned chipset/family reference data does not exist. Rule registered, returns UNKNOWN, never fabricated. |
| `COMPATIBLE_WITH_WARNINGS` added to engine, contracts, API, Builder | Current implementation has 3-group candidate classification | 4-group classification per TDD §15.8 |
| Quality gate per category/fact, not per product | TDD §23 implied broader reference data | Coverage ≥80%, precision ≥95%, verified sample ≥50 or all products when fewer. Dependent rules inactive/UNKNOWN when gate fails. |

---

## 6. Architecture & Data Flow

```
CatalogProduct.rawSpecifications
        │
        ▼
packages/compatibility-facts (pure, zero-infrastructure)
  └─ per-category extractors → CompatibilityFactSet per product
        │
        ▼
CatalogProduct.compatibility (typed, structured)
        │
        ├──────────────────────────┐
        ▼                          ▼
CategoryQualityReport          Build API
(separate collection)         reads product facts per build item
  per-fact coverage/           │
  precision/sample             ▼
        │               packages/compatibility-engine (pure)
        │               typed rules, quality/ref gates
        │                     │
        │                     ▼
        │               BuildEvaluationResult
        │               (real statuses, top reasons, evidence)
        │                     │
        │                     ▼
        │               Build snapshot persisted
        │               Candidate groups (4-way)
        │                     │
        │                     ▼
        │               Builder UI
        │               (real status, warning group, evidence)
        │
        ▼
Worker backfill command
  reads CatalogProduct.rawSpecifications
  writes CatalogProduct.compatibility + CategoryQualityReport
  idempotent, versioned, batch/resume
```

### Boundary Constraints

- `packages/compatibility-facts`: pure, no infrastructure. Imports from `@buildsense/domain` only. May contain compatibility-scoped normalization aliases (label mapping, unit normalization) — this is a milestone-specific scope, not a general normalization pipeline.
- `packages/compatibility-engine`: pure, no infrastructure. Imports from `@buildsense/domain`. Consumes facts provided by API; does not read database.
- `apps/api`: reads `CatalogProduct.compatibility` for build items/candidates; never scrapes. Never imports `sigma-adapter` or `scraping-core`.
- `apps/worker`: owns extraction, backfill, quality report generation. Never called by API.
- `apps/web`: receives real statuses via API DTOs. No database or store-adapter imports.

---

## 7. Schemas & Contracts

### 7.1 Product Compatibility Facts

```ts
// packages/domain/src/compatibility.ts

/** Per-fact evidence captured at extraction time. */
export interface FactEvidence {
  /** Source spec label from rawSpecifications (e.g., "Socket", "Memory Type"). */
  readonly sourceLabel: string;
  /** Raw string value from rawSpecifications before normalization. */
  readonly rawValue: string;
  /** Normalized value after alias/unit resolution (e.g., "AM5", "DDR5"). */
  readonly normalizedValue: string | null;
  /** 0.0–1.0 confidence in the extraction for this fact. */
  readonly confidence: number;
  /** Human-readable extractor version that produced this evidence. */
  readonly extractorVersion: string;
  /** Issues encountered during extraction (e.g., ambiguous label, unit mismatch). Empty array = clean. */
  readonly extractionIssues: readonly string[];
}

/** A single extracted compatibility fact with its evidence chain. */
export interface CompatibilityFact {
  /** Fact key, e.g. "cpu.socket", "mb.socket", "mb.maxMemoryGB". */
  readonly key: string;
  /** Typed value. null means explicitly absent/unknown — never guessed. */
  readonly value: unknown;
  /** Evidence for this specific fact. At least one entry per extracted fact. */
  readonly evidence: readonly FactEvidence[];
}

/**
 * Complete compatibility fact set for a single CatalogProduct.
 * Stored on CatalogProduct.compatibility as a typed document.
 */
export interface CompatibilityFactSet {
  /** Category scope (e.g., "CPU", "Motherboard"). One fact set per category. */
  readonly category: string;
  /** Semantic version of the extractor that produced this fact set. */
  readonly extractorVersion: string;
  /** All extracted facts for this product. Empty array = extraction ran but found nothing. */
  readonly facts: readonly CompatibilityFact[];
  /** When extraction ran. ISO-8601. */
  readonly extractedAt: string;
  /** Top-level issues from the extraction pass (e.g., "no specifications found"). */
  readonly extractionIssues: readonly string[];
}
```

**Key rules:**
- `CompatibilityFactSet` replaces the current untyped `Record<string, unknown>` on `CatalogProduct.compatibility`.
- A product has one `CompatibilityFactSet` per relevant category. The `compatibility` field becomes `CompatibilityFactSet | null`.
- Fact absence is explicit: `value: null` with empty or diagnostic `extractionIssues`. No fact is ever guessed or inferred without evidence.
- `rawSpecifications` is never mutated. Evidence preserves the raw source label and value.

### 7.2 Category Quality Report

```ts
// packages/domain/src/quality-report.ts

/** Per-fact quality metrics within a category. */
export interface FactQualityMetrics {
  /** Fact key (e.g., "cpu.socket", "mb.maxMemoryGB"). */
  readonly factKey: string;
  /** Number of products in category where this fact was extracted with value != null. */
  readonly extractableCount: number;
  /** Coverage = extractableCount / totalProductsInCategory. */
  readonly coverage: number;
  /** Number of products in verified sample where fact value was correct. null if not yet verified. */
  readonly verifiedCorrect: number | null;
  /** Total verified sample size for this fact. null if not yet verified. */
  /** verifiedSampleSize >= 50 or == all products when fewer. */
  readonly verifiedSampleSize: number | null;
  /** Precision = verifiedCorrect / verifiedSampleSize. null if not yet verified. */
  readonly precision: number | null;
}

/** Quality report for a category at a specific extractor version. */
export interface CategoryQualityReport {
  /** MongoDB _id (auto-generated). */
  readonly _id?: unknown;
  /** Category name (e.g., "CPU", "Motherboard"). */
  readonly category: string;
  /** Extractor version this report evaluates. */
  readonly extractorVersion: string;
  /** Total products in this category in the catalog. */
  readonly totalProducts: number;
  /** Per-fact metrics. */
  readonly factMetrics: readonly FactQualityMetrics[];
  /** Whether all fact gates pass for this category (coverage ≥80%, precision ≥95%). */
  readonly allGatesPass: boolean;
  /** When this report was generated. ISO-8601. */
  readonly evaluatedAt: string;
}
```

**Key rules:**
- Separate MongoDB collection (`category_quality_reports`), not embedded in products.
- Keyed by `(category, extractorVersion)` — a unique compound index.
- Worker writes; API reads only (diagnostic surface, not gating logic).
- Quality gate thresholds: coverage ≥80%, precision ≥95%, verified sample ≥50 or all products when fewer.

### 7.3 Reference Data (Versioned, Authoritative)

```ts
// packages/domain/src/reference-data.ts

/** A chipset/family support entry for CMP-CPU-MB-002. */
export interface ChipsetCpuSupportEntry {
  /** Chipset name (e.g., "B650", "Z790"). */
  readonly chipset: string;
  /** Supported CPU families (e.g., ["Ryzen 7000", "Ryzen 9000"]). */
  readonly supportedFamilies: readonly string[];
  /** CPU families requiring BIOS update to be supported. */
  readonly biosUpdateRequired: readonly string[];
  /** Source URL or citation for this entry. */
  readonly source: string;
  /** When this entry was last verified. ISO-8601. */
  readonly verifiedAt: string;
}

/** Versioned reference dataset. */
export interface ReferenceDataset {
  /** Semantic version of the dataset (e.g., "1.0.0"). */
  readonly version: string;
  /** When this version was published. ISO-8601. */
  readonly publishedAt: string;
  /** Chipset → CPU support mappings. Empty until authoritative source is sourced. */
  readonly chipsetCpuSupport: readonly ChipsetCpuSupportEntry[];
  /** Source citation for the entire dataset. */
  readonly citation: string;
}
```

**Key rules:**
- No fabricated support data. `chipsetCpuSupport` starts as an empty array.
- CMP-CPU-MB-002 returns UNKNOWN until this dataset has ≥1 entry and quality gate passes.
- Change control: new versions require a changelog entry in the reference data document. API/engine reads the latest version.
- Stored in a MongoDB collection (`reference_datasets`) or a static JSON loaded at worker startup — final storage TBD at implementation.

### 7.4 Contracts Updates

```ts
// packages/contracts/src/build.ts — additions

/** Four-group candidate classification per TDD §15.8. */
export type CandidateCompatibilityGroup =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_WARNINGS'
  | 'UNKNOWN'
  | 'INCOMPATIBLE';

/** Updated CandidateCompatibilityGroupDto */
export interface CandidateCompatibilityGroupDto {
  readonly status: CandidateCompatibilityGroup;
  readonly products: readonly CandidateProductDto[];
  readonly topReasons: readonly string[];
}

/** Per-slot compatibility result with top reasons for display. */
export interface SlotCompatibilityDto {
  readonly slot: BuildSlotName;
  readonly status: CompatibilityStatus;
  readonly triggeredRuleIds: readonly string[];
  readonly topReasons: readonly string[];
}
```

**Backward compatibility:** Adding `topReasons` to `SlotCompatibilityDto` is additive. Existing consumers ignore unknown fields. The `CandidateCompatibilityGroup` type widens from 3 to 4 values — existing switch statements on `COMPATIBLE | INCOMPATIBLE | UNKNOWN` must add a case or default for `COMPATIBLE_WITH_WARNINGS`.

---

## 8. Fact Matrix — Seven Categories

### 8.1 Fact Keys by Category

| Category | Fact Key | Type | Required Rules | Aliases / Units | Notes |
|----------|----------|------|----------------|-----------------|-------|
| **CPU** | `cpu.socket` | `string` | CMP-CPU-MB-001, CMP-CPU-MB-002 | Socket name normalization (e.g., "Socket AM5" → "AM5") | Primary socket fact |
| **CPU** | `cpu.family` | `string` | CMP-CPU-MB-002 | Family name normalization | For chipset support lookup |
| **CPU** | `cpu.iGpu` | `boolean \| null` | CMP-GRAPHICS-001 | null = unknown (not "no iGPU") | Integrated graphics presence |
| **CPU** | `cpu.tdpWatts` | `number \| null` | CMP-PSU-001 | Watts | For PSU power estimate |
| **Motherboard** | `mb.socket` | `string` | CMP-CPU-MB-001, CMP-CPU-MB-002 | Same normalization as cpu.socket | |
| **Motherboard** | `mb.chipset` | `string` | CMP-CPU-MB-002 | Chipset name | For reference data lookup |
| **Motherboard** | `mb.formFactor` | `string` | CMP-MB-CASE-001 | ATX, Micro-ATX, Mini-ITX, etc. | |
| **Motherboard** | `mb.ramGeneration` | `string` | CMP-MB-RAM-001 | "DDR4", "DDR5" | |
| **Motherboard** | `mb.ramType` | `string` | CMP-MB-RAM-002 | "DIMM", "SO-DIMM" | Module type expected |
| **Motherboard** | `mb.dimmSlots` | `number \| null` | CMP-MB-RAM-003 | Count | Physical slot count |
| **Motherboard** | `mb.maxMemoryGB` | `number \| null` | CMP-MB-RAM-004 | GB | Maximum supported memory |
| **Motherboard** | `mb.maxMemorySpeedMHz` | `number \| null` | CMP-MB-RAM-005 | MHz | Maximum RAM speed without OC |
| **Motherboard** | `mb.sataPorts` | `number \| null` | CMP-STORAGE-MB-001 | Count | Available SATA ports |
| **Motherboard** | `mb.m2Slots` | `number \| null` | CMP-STORAGE-MB-001 | Count | Available M.2 slots |
| **Motherboard** | `mb.m2FormFactors` | `readonly string[]` | CMP-STORAGE-MB-001 | ["2280", "2242", ...] | Supported M.2 form factors |
| **RAM** | `ram.generation` | `string` | CMP-MB-RAM-001 | "DDR4", "DDR5" | |
| **RAM** | `ram.moduleType` | `string` | CMP-MB-RAM-002 | "DIMM", "SO-DIMM" | |
| **RAM** | `ram.moduleCount` | `number` | CMP-MB-RAM-003 | Count per kit | Kit module count |
| **RAM** | `ram.capacityGB` | `number` | CMP-MB-RAM-004 | GB total capacity of kit | |
| **RAM** | `ram.speedMHz` | `number \| null` | CMP-MB-RAM-005 | MHz | Rated speed |
| **GPU** | `gpu.lengthMM` | `number \| null` | CMP-GPU-CASE-001 | mm | Physical length |
| **GPU** | `gpu.slotWidth` | `number` | CMP-GPU-CASE-002 | Expansion slots occupied | 2, 2.5, 3, etc. |
| **GPU** | `gpu.connectorTypes` | `readonly string[]` | CMP-PSU-GPU-001 | ["8-pin", "12VHPWR", ...] | Required power connectors |
| **GPU** | `gpu.connectorCount` | `number` | CMP-PSU-GPU-001 | Total connectors needed | |
| **GPU** | `gpu.boardPowerWatts` | `number \| null` | CMP-PSU-001 | Watts | TDP / board power |
| **Storage** | `storage.interface` | `string` | CMP-STORAGE-MB-001 | "SATA", "NVMe", "PCIe" | |
| **Storage** | `storage.formFactor` | `string \| null` | CMP-STORAGE-MB-001 | "2.5\"", "3.5\"", "M.2 2280" | Physical form factor |
| **PSU** | `psu.wattage` | `number` | CMP-PSU-001 | Watts | Rated wattage |
| **Case** | `case.maxGpuLengthMM` | `number \| null` | CMP-GPU-CASE-001 | mm | Maximum GPU clearance |
| **Case** | `case.expansionSlots` | `number \| null` | CMP-GPU-CASE-002 | Count | Available expansion slots |
| **Case** | `case.supportedFormFactors` | `readonly string[]` | CMP-MB-CASE-001 | ["ATX", "Micro-ATX", ...] | Supported motherboard form factors |

### 8.2 Extraction Source & Confidence

Every extracted fact carries `FactEvidence` with:
- `sourceLabel`: the exact label from `rawSpecifications` (e.g., "Socket", "Memory Type", "GPU Length")
- `rawValue`: the original string value before normalization
- `normalizedValue`: alias-resolved, unit-normalized value or null if unresolvable
- `confidence`: 0.0–1.0 based on label match quality and value parseability
- `extractorVersion`: e.g., `"cpu/v1.0.0"`, `"mb/v1.0.0"`
- `extractionIssues`: e.g., `["ambiguous label 'Type' matched to ram.moduleType with 0.7 confidence"]`

### 8.3 Alias & Unit Normalization (Compatibility-Facts Scoped)

`packages/compatibility-facts` contains normalization mappings limited to compatibility-relevant categories:

- **Socket normalization**: "Socket AM5" → "AM5", "LGA1700" → "LGA1700", "Socket sTR5" → "sTR5"
- **RAM generation**: "DDR 5" → "DDR5", "DDR5-5600" → speed extracted separately
- **Form factor**: "Micro ATX" → "Micro-ATX", "mATX" → "Micro-ATX"
- **Interface**: "SATA III" → "SATA", "NVMe PCIe 4.0" → "NVMe"

These are NOT a general production normalization pipeline. They are compatibility-scoped, category-specific mappings within `packages/compatibility-facts`. The general normalization/matching pipeline remains deferred.

---

## 9. Rule Delivery & Activation Matrix

### 9.1 Summary

| Status | Count | Rules |
|--------|-------|-------|
| Active-scope (implement + activate when gates pass) | 13 | CMP-CPU-MB-001, CMP-MB-RAM-001 through -005, CMP-MB-CASE-001, CMP-GPU-CASE-001/-002, CMP-PSU-001, CMP-PSU-GPU-001, CMP-STORAGE-MB-001, CMP-GRAPHICS-001 |
| Registered but inactive (UNKNOWN until reference data) | 1 | CMP-CPU-MB-002 |
| Deferred (cooler slots) | 3 | CMP-COOLER-CPU-001, CMP-AIR-CASE-001, CMP-AIO-CASE-001 |
| **Total TDD §15.7** | **17** | |

### 9.2 Per-Rule Specification

Each rule entry specifies: required facts, PASS/ERROR/WARNING/UNKNOWN semantics, quality/reference gate, and top reasons for candidate display.

---

#### CMP-CPU-MB-001 — CPU ↔ Motherboard Socket

- **Slots:** `cpu`, `motherboard`
- **Required facts:** `cpu.socket`, `mb.socket`
- **Semantics:**
  - PASS: both present, values equal (after normalization)
  - ERROR: both present, values differ
  - UNKNOWN: either fact missing or null
- **Quality gate:** Category gate for `cpu.socket` and `mb.socket` (CPU and Motherboard categories)
- **Top reasons:** "Socket mismatch: {cpu.socket} vs {mb.socket}" / "Socket data missing"

---

#### CMP-CPU-MB-002 — CPU Support / BIOS (Inactive)

- **Slots:** `cpu`, `motherboard`
- **Required facts:** `cpu.family`, `mb.chipset`, plus authoritative `ReferenceDataset.chipsetCpuSupport`
- **Semantics:**
  - PASS: explicit support found in reference data
  - ERROR: explicitly unsupported
  - WARNING: support requires BIOS update
  - UNKNOWN: no reference data entry exists → **always UNKNOWN in this milestone**
- **Quality gate:** `ReferenceDataset.chipsetCpuSupport` must have ≥1 entry AND pass category gates. Until then, rule is **inactive** — returns UNKNOWN, never evaluated.
- **Activation:** Requires sourcing an authoritative chipset/family reference dataset. No fabricated or scraped-from-text data.
- **Top reasons:** "No chipset support data available" (always, in this milestone)

---

#### CMP-MB-RAM-001 — Memory Generation

- **Slots:** `motherboard`, `ram`
- **Required facts:** `mb.ramGeneration`, `ram.generation`
- **Semantics:**
  - PASS: both present, generation matches (e.g., both DDR5)
  - ERROR: generation mismatch (e.g., DDR4 board + DDR5 RAM)
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and RAM category gates for generation facts
- **Top reasons:** "RAM generation {ram.generation} incompatible with motherboard {mb.ramGeneration}"

---

#### CMP-MB-RAM-002 — Module Type

- **Slots:** `motherboard`, `ram`
- **Required facts:** `mb.ramType`, `ram.moduleType`
- **Semantics:**
  - PASS: both present, types compatible (DIMM + desktop board)
  - ERROR: SO-DIMM on desktop motherboard (DIMM-required board)
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and RAM category gates for type facts
- **Top reasons:** "SO-DIMM RAM on desktop motherboard requires DIMM"
- **Note:** Missing from TDD §15.5 registry. Included here per TDD §15.7 definition.

---

#### CMP-MB-RAM-003 — Slot Count

- **Slots:** `motherboard`, `ram`
- **Required facts:** `mb.dimmSlots`, `ram.moduleCount`
- **Context:** RAM slot quantity (1–4 per build) × moduleCount per kit vs. `mb.dimmSlots`
- **Semantics:**
  - PASS: total modules ≤ dimmSlots
  - ERROR: total modules > dimmSlots
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and RAM category gates
- **Top reasons:** "Total RAM modules ({total}) exceed motherboard slots ({dimmSlots})"

---

#### CMP-MB-RAM-004 — Capacity

- **Slots:** `motherboard`, `ram`
- **Required facts:** `mb.maxMemoryGB`, `ram.capacityGB`
- **Context:** RAM slot quantity (1–4) × capacityGB vs. `mb.maxMemoryGB`
- **Semantics:**
  - PASS: total capacity ≤ max
  - ERROR: total capacity > max
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and RAM category gates
- **Top reasons:** "Total RAM capacity ({total}GB) exceeds motherboard max ({max}GB)"

---

#### CMP-MB-RAM-005 — Speed

- **Slots:** `motherboard`, `ram`
- **Required facts:** `mb.maxMemorySpeedMHz`, `ram.speedMHz`
- **Semantics:**
  - WARNING: RAM speed > board max (will run at lower speed or needs OC profile)
  - PASS: RAM speed ≤ board max
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and RAM category gates
- **Top reasons:** "RAM speed {speed}MHz exceeds board max {max}MHz — will downclock or need XMP/EXPO"
- **Note:** Missing from TDD §15.5 registry. Included here per TDD §15.7 definition.

---

#### CMP-MB-CASE-001 — Form Factor

- **Slots:** `motherboard`, `case`
- **Required facts:** `mb.formFactor`, `case.supportedFormFactors`
- **Semantics:**
  - PASS: case supports the motherboard form factor
  - ERROR: case does not support the form factor
  - UNKNOWN: either fact missing
- **Quality gate:** Motherboard and Case category gates
- **Top reasons:** "Motherboard form factor {formFactor} not supported by case"

---

#### CMP-GPU-CASE-001 — GPU Length

- **Slots:** `gpu`, `case`
- **Required facts:** `gpu.lengthMM`, `case.maxGpuLengthMM`
- **Semantics:**
  - ERROR: gpu.lengthMM > case.maxGpuLengthMM
  - WARNING: clearance 0–9mm (tight fit)
  - PASS: clearance ≥10mm
  - UNKNOWN: either fact missing
- **Quality gate:** GPU and Case category gates
- **Top reasons:** "GPU length {length}mm exceeds case max {max}mm" / "GPU fits with only {clearance}mm clearance"

---

#### CMP-GPU-CASE-002 — Expansion Slots

- **Slots:** `gpu`, `case`
- **Required facts:** `gpu.slotWidth`, `case.expansionSlots`
- **Semantics:**
  - ERROR: gpu.slotWidth > case.expansionSlots
  - WARNING: close fit (within 1 slot)
  - PASS: sufficient slots
  - UNKNOWN: either fact missing
- **Quality gate:** GPU and Case category gates
- **Top reasons:** "GPU requires {width} slots but case has only {available}"

---

#### CMP-PSU-001 — Wattage

- **Slots:** `psu`, `cpu`, `gpu`
- **Required facts:** `psu.wattage`, `cpu.tdpWatts`, `gpu.boardPowerWatts`
- **Power estimate formula (this milestone — supersedes TDD §15.7 granular formula):**
  ```
  estimatedLoad = cpu.tdpWatts + gpu.boardPowerWatts + 100  // platform allowance
  headroomPercent = (psu.wattage - estimatedLoad) / estimatedLoad * 100
  ```
- **Semantics:**
  - ERROR: psu.wattage < estimatedLoad
  - WARNING: psu.wattage >= estimatedLoad but headroomPercent < 20%
  - PASS: headroomPercent >= 20%
  - UNKNOWN: any required fact missing or null
- **Quality gate:** PSU, CPU, GPU category gates for wattage facts
- **Top reasons:** "PSU wattage {watts}W insufficient for estimated {estimate}W load" / "PSU provides only {headroom}% headroom (20% recommended)"

---

#### CMP-PSU-GPU-001 — GPU Power Connectors

- **Slots:** `psu`, `gpu`
- **Required facts:** `gpu.connectorTypes`, `gpu.connectorCount`
- **Context:** Requires PSU connector inventory (future fact) or heuristic from PSU wattage tier. For P0, if connector facts are missing → UNKNOWN.
- **Semantics:**
  - PASS: PSU can supply required connectors (when connector inventory fact available)
  - ERROR: missing required connector type
  - WARNING: adapter needed or connector inventory unknown but inferred from wattage tier
  - UNKNOWN: required facts missing
- **Quality gate:** GPU category gate for connector facts
- **Top reasons:** "GPU requires {count}x {type} connector(s)" / "GPU power connector inventory unknown"

---

#### CMP-STORAGE-MB-001 — Storage Interface

- **Slots:** `storage`, `motherboard`
- **Required facts:** `storage.interface`, `storage.formFactor`, `mb.sataPorts`, `mb.m2Slots`, `mb.m2FormFactors`
- **Activation gate:** Both Storage and Motherboard fact categories must pass their quality gates before this rule is activated. Until then, rule returns UNKNOWN.
- **Semantics:**
  - PASS: compatible interface and form factor available on motherboard
  - ERROR: no compatible slot/port available
  - WARNING: higher PCIe generation on lower slot (backward compatible but slower)
  - UNKNOWN: required facts missing or quality gate not passed
- **Top reasons:** "Storage {interface} requires {slotType} not available on motherboard" / "Storage interface data incomplete"

---

#### CMP-GRAPHICS-001 — Display Capability

- **Slots:** `gpu` (primary), `cpu` (secondary)
- **Required facts:** `gpu` presence (is a GPU selected?), `cpu.iGpu`
- **Semantics:**
  - PASS: GPU selected (any discrete GPU)
  - PASS: no GPU + cpu.iGpu = true (integrated graphics available)
  - WARNING: no GPU + cpu.iGpu = false (build incomplete, will ERROR at final validation if user declares build complete)
  - UNKNOWN: cpu.iGpu is null (unknown)
- **Quality gate:** CPU category gate for iGpu fact
- **Top reasons:** "No GPU selected and CPU has no integrated graphics" / "Display output unknown"

---

#### CMP-COOLER-CPU-001, CMP-AIR-CASE-001, CMP-AIO-CASE-001 — Cooler (Deferred)

- **Status:** DEFERRED. Cooler and Case Fan slots are not in the active 7-slot model.
- **Registry:** Rules are NOT registered in this milestone. They exist only in TDD §15.7 for future reference.
- **Reason:** Cooler/Cooler slot deferred per Phase Context decision #4.

---

## 10. COMPATIBLE_WITH_WARNINGS Migration

### Engine (`packages/compatibility-engine`)

- `CandidateCompatibilityGroup` type: add `'COMPATIBLE_WITH_WARNINGS'`
- `reduceBuildStatus`: already handles `WARNING` — no change needed for overall status
- Engine `evaluate`: when a slot has at least one WARNING rule result among otherwise COMPATIBLE results, the slot status is WARNING (already implemented)
- `classifyCandidate`: add logic to return `'COMPATIBLE_WITH_WARNINGS'` when candidate passes all rules but triggers at least one WARNING

### Contracts (`packages/contracts`)

- `CandidateCompatibilityGroupDto.status`: widen to include `'COMPATIBLE_WITH_WARNINGS'`
- Add `topReasons: readonly string[]` to `SlotCompatibilityDto`
- Add `topReasons: readonly string[]` to `CandidateCompatibilityGroupDto` (already present)

### API (`apps/api`)

- `builds.service.ts`: candidate grouping logic produces four groups instead of one UNKNOWN blob
- Top reasons extracted from rule evaluation results

### Builder UI (`apps/web`)

- Selection drawer: display four groups with visual distinction for `COMPATIBLE_WITH_WARNINGS`
- Existing group badge components: add warning-styled variant
- Top reasons shown on candidate cards

### Backward Compatibility

- API consumers receiving `CandidateCompatibilityGroupDto` with `status: 'COMPATIBLE_WITH_WARNINGS'` must handle it. Existing code that only checked `COMPATIBLE | INCOMPATIBLE | UNKNOWN` will not break if it has a default case, but the Builder UI must explicitly render the warning group.
- The `CompatibilityStatus` union on `SlotCompatibilityDto` already includes `'WARNING'` — no change needed.

---

## 11. Worker Backfill & Quality Workflow

### 11.1 New Worker Command: `compatibility:extract`

Follows the existing Commander pattern from `apps/worker/src/commands/sigma.ts`.

**Options:**
- `--category <name>`: Extract for a single category (e.g., "CPU", "Motherboard")
- `--all`: Extract for all seven categories
- `--dry-run`: Run extraction without persisting (report only)
- `--batch-size <n>`: Products per batch (default 100)
- `--resume-from <productId>`: Resume from a specific product ID
- `--extractor-version <ver>`: Override extractor version (for testing)

**Flow:**
1. Connect to MongoDB.
2. Load extractor for target category from `packages/compatibility-facts`.
3. Query `CatalogProduct` by category, ordered by `_id`.
4. For each product (or batch):
   a. Read `rawSpecifications`.
   b. Run category-specific extractor → `CompatibilityFactSet`.
   c. Write `CompatibilityFactSet` to `CatalogProduct.compatibility`.
   d. Record extraction stats (success, issues, skipped).
5. After all products: compute `CategoryQualityReport` for this category/version.
6. Write `CategoryQualityReport` to separate collection.
7. Report summary: total processed, extracted, skipped, issues, gate status.
8. Disconnect.

**Idempotency:**
- Re-running extraction for the same product overwrites `compatibility` with the latest extractor version.
- `extractedAt` timestamp records when extraction last ran.
- Quality reports are versioned: a new run at the same extractor version overwrites the previous report.

**Raw data immutability:**
- `rawSpecifications` is never read-write. Extraction reads it; never modifies it.
- Evidence preserves the original label and value.

**Batch/resume:**
- `--resume-from` allows restarting from a specific product ID.
- Batch size controls how many products are processed before writing quality reports.
- Failure in mid-batch: completed products are persisted; failed products logged; batch resume starts from next unprocessed.

**Failure reporting:**
- Per-product extraction issues logged to stdout and stored in `extractionIssues`.
- Command exits with code 1 if >50% of products in batch fail extraction.
- Quality report includes extraction failure rate.

### 11.2 Extraction Process (Per Category)

Each category has an extractor function in `packages/compatibility-facts`:

```ts
// packages/compatibility-facts/src/extractors/cpu.ts
export function extractCpuFacts(
  rawSpecs: readonly { label: string; value: string }[],
  extractorVersion: string,
): CompatibilityFactSet;
```

Extractor responsibilities:
1. Match `rawSpecs` labels to known fact keys using alias maps.
2. Parse/normalize values (unit conversion, string normalization).
3. Assign confidence based on label match quality.
4. Record all evidence including raw values and issues.
5. Return `CompatibilityFactSet` with all facts, even null-valued ones (explicit absence).

### 11.3 Safe Rollout / Rollback

- **Rollout:** Run extraction with `--dry-run` first. Inspect output. Then run for real. Quality report gates determine rule activation.
- **Rollback:** Set `CatalogProduct.compatibility = null` for affected products. Clear quality reports. Engine falls back to UNKNOWN for all slots (existing behavior).
- **No migration required:** `compatibility` field is `Schema.Types.Mixed` with default `{}`. Typed `CompatibilityFactSet` writes are backward-compatible with the existing untyped schema.

---

## 12. API Integration

### 12.1 Build Item Fact Loading

When the API evaluates compatibility (PUT item, DELETE item, POST validate):

1. For each occupied slot, load the `CatalogProduct` and read `product.compatibility` (typed `CompatibilityFactSet`).
2. Extract facts into `Record<string, unknown>` per slot (flat key → value map for rule consumption).
3. Pass to `engine.evaluate(buildFacts, slots)`.

**Efficiency:**
- Load only occupied slots (not all 7).
- Batch-load products in a single query when multiple slots are occupied.
- Cache facts within a single request (no N+1).

### 12.2 Candidate Fact Loading

When the API classifies candidates (GET candidates):

1. For the candidate slot, load all candidate products' `compatibility` facts.
2. For each candidate, extract facts into `Record<string, unknown>`.
3. Classify each candidate against the build's facts.
4. Group into four categories: `COMPATIBLE`, `COMPATIBLE_WITH_WARNINGS`, `UNKNOWN`, `INCOMPATIBLE`.
5. Compute `topReasons` per group from triggered rule evaluations.

**Efficiency:**
- Candidate products are already batch-queried. Add `compatibility` to the projection.
- Classification runs in-memory (pure engine, no I/O).
- Pagination already implemented; fact loading scales with page size.

### 12.3 Snapshot Persistence (Existing)

The existing `updateSnapshots` call persists evaluation results with optimistic concurrency. No change to this mechanism — only the data passed to it changes (real statuses instead of all-UNKNOWN).

### 12.4 Build CRUD Preservation

No changes to Build create, read, update, delete, or purchase plan endpoints. Only the evaluation and candidate classification logic changes.

---

## 13. Builder UI Changes

Scope is limited to displaying real statuses and the warning group. No replanning of persistent builder or purchase plan.

### Changes

1. **Candidate drawer:** Display four groups with visual badges (green COMPATIBLE, yellow COMPATIBLE_WITH_WARNINGS, gray UNKNOWN, red INCOMPATIBLE).
2. **Candidate cards:** Show top 1–3 reasons from `topReasons`. Full evidence in expandable drawer.
3. **Slot compatibility indicator:** Real status from API (not always UNKNOWN).
4. **Overall build status banner:** Real status from `overallStatus`.
5. **Evidence drawer:** Show triggered rule IDs and top reasons per slot.

### No Changes

- Build CRUD flow (create, resume, 409 handling)
- Purchase plan page
- localStorage behavior
- Bundle ineligibility

---

## 14. Delivery Phases

### Phase 0: Contracts, Fact Schema, Reference Data Schema, Warning Group Migration

**Entry conditions:** Fast Track foundation complete (current state).

**Exit conditions:** All domain types, contracts, and engine types updated. `COMPATIBLE_WITH_WARNINGS` present across engine/contracts/API/UI. All existing tests still pass. No new behavior added.

**Affected projects/files (planning level):**
- `packages/domain/src/compatibility.ts` — NEW: `CompatibilityFactSet`, `CompatibilityFact`, `FactEvidence` types
- `packages/domain/src/quality-report.ts` — NEW: `CategoryQualityReport`, `FactQualityMetrics` types
- `packages/domain/src/reference-data.ts` — NEW: `ReferenceDataset`, `ChipsetCpuSupportEntry` types
- `packages/contracts/src/build.ts` — Widen `CandidateCompatibilityGroupDto.status`, add `topReasons` to `SlotCompatibilityDto`
- `packages/compatibility-engine/src/types.ts` — Add `COMPATIBLE_WITH_WARNINGS` to `CandidateCompatibilityGroup`, add `topReasons` to slot result
- `packages/database/src/models/catalog-product.ts` — Type `compatibility` field as `CompatibilityFactSet | null`
- `apps/web/` — Candidate group badge for `COMPATIBLE_WITH_WARNINGS` (default renders as UNKNOWN until Phase 4 wires real data)

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P0-1 | Create `packages/domain/src/compatibility.ts` with `CompatibilityFactSet`, `CompatibilityFact`, `FactEvidence` | — |
| P0-2 | Create `packages/domain/src/quality-report.ts` with `CategoryQualityReport`, `FactQualityMetrics` | — |
| P0-3 | Create `packages/domain/src/reference-data.ts` with `ReferenceDataset`, `ChipsetCpuSupportEntry` | — |
| P0-4 | Widen `CandidateCompatibilityGroup` in engine to include `COMPATIBLE_WITH_WARNINGS` | — |
| P0-5 | Add `topReasons` to `SlotEvaluationResult` in engine types | — |
| P0-6 | Update `CandidateCompatibilityGroupDto` in contracts, add `topReasons` to `SlotCompatibilityDto` | P0-4, P0-5 |
| P0-7 | Type `CatalogProduct.compatibility` as `CompatibilityFactSet \| null` in database model | P0-1 |
| P0-8 | Add `COMPATIBLE_WITH_WARNINGS` badge variant to Builder UI candidate drawer (default: same as UNKNOWN until real data) | P0-6 |
| P0-9 | Add `CategoryQualityReport` Mongoose schema and model in `packages/database` | P0-2 |
| P0-10 | Add `ReferenceDataset` Mongoose schema and model in `packages/database` (or static JSON loader) | P0-3 |

**Focused validation:**
- `nx run domain:typecheck` — new types compile
- `nx run compatibility-engine:typecheck` — widened types compile
- `nx run contracts:typecheck` — widened DTOs compile
- `nx run database:typecheck` — typed compatibility compiles
- `nx run api:test` — existing tests still pass (no behavior change)
- `nx run web:test` — existing tests still pass

**Stop gate:** All type checks pass. All existing tests pass. No runtime behavior changed — only type widenings and new type definitions.

---

### Phase 1: Pure Seven-Category Extractors & Fixtures

**Entry conditions:** Phase 0 complete. Domain types, schemas, and engine types available.

**Exit conditions:** All seven extractors implemented in `packages/compatibility-facts`. Fixtures for each category. Extractor unit tests pass. No persistence or worker integration yet.

**Affected projects/files (planning level):**
- `packages/compatibility-facts` — NEW package: extractors, alias maps, unit tests
- `packages/compatibility-facts/src/extractors/cpu.ts`
- `packages/compatibility-facts/src/extractors/motherboard.ts`
- `packages/compatibility-facts/src/extractors/ram.ts`
- `packages/compatibility-facts/src/extractors/gpu.ts`
- `packages/compatibility-facts/src/extractors/storage.ts`
- `packages/compatibility-facts/src/extractors/psu.ts`
- `packages/compatibility-facts/src/extractors/case.ts`
- `packages/compatibility-facts/src/aliases/` — socket, form factor, generation, interface maps
- `packages/compatibility-facts/src/index.ts` — public API
- `packages/compatibility-facts/src/__fixtures__/` — raw spec fixtures per category

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P1-1 | Create `packages/compatibility-facts` package scaffold (package.json, tsconfig, project.json) | P0-1 |
| P1-2 | Implement socket alias/normalization map | P1-1 |
| P1-3 | Implement form factor, generation, interface alias maps | P1-1 |
| P1-4 | Implement CPU extractor (`extractCpuFacts`) | P1-1, P1-2 |
| P1-5 | Implement Motherboard extractor (`extractMotherboardFacts`) | P1-1, P1-2, P1-3 |
| P1-6 | Implement RAM extractor (`extractRamFacts`) | P1-1, P1-3 |
| P1-7 | Implement GPU extractor (`extractGpuFacts`) | P1-1 |
| P1-8 | Implement Storage extractor (`extractStorageFacts`) | P1-1, P1-3 |
| P1-9 | Implement PSU extractor (`extractPsuFacts`) | P1-1 |
| P1-10 | Implement Case extractor (`extractCaseFacts`) | P1-1, P1-3 |
| P1-11 | Create per-category fixture sets (realistic rawSpecifications) | P1-4 through P1-10 |
| P1-12 | Write extractor unit tests: happy path, missing specs, ambiguous labels, edge cases | P1-4 through P1-11 |
| P1-13 | Write normalization/alias unit tests | P1-2, P1-3 |
| P1-14 | Export public API from `packages/compatibility-facts/src/index.ts` | P1-4 through P1-10 |

**Focused validation:**
- `nx run compatibility-facts:test` — all extractor tests pass
- `nx run compatibility-facts:lint` — clean
- `nx run compatibility-facts:typecheck` — clean

**Stop gate:** All seven extractors produce correct `CompatibilityFactSet` for fixture data. All evidence fields populated. Alias maps cover known Sigma label variations.

---

### Phase 2: Persistence Migration, Worker Backfill, Quality Reports

**Entry conditions:** Phase 1 complete. Extractors working with fixtures.

**Exit conditions:** Worker `compatibility:extract` command runs against real catalog data. `CatalogProduct.compatibility` populated. `CategoryQualityReport` generated. Idempotency verified.

**Affected projects/files (planning level):**
- `apps/worker/src/commands/compatibility.ts` — NEW: extract command
- `apps/worker/src/index.ts` — Register new command
- `packages/database/src/models/catalog-product.ts` — Schema migration (typed compatibility)
- `packages/database/src/models/category-quality-report.ts` — NEW: quality report model
- `packages/database/src/index.ts` — Export new model
- `packages/compatibility-facts/src/__fixtures__/` — Expand with broader fixture set

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P2-1 | Create `CategoryQualityReport` Mongoose model and repository | P0-9 |
| P2-2 | Create `compatibility:extract` worker command skeleton (Commander, connect/disconnect, options) | P1-14 |
| P2-3 | Implement batch extraction loop: query products, run extractor, write `compatibility` | P2-1, P2-2 |
| P2-4 | Implement `--dry-run` mode (report without persisting) | P2-3 |
| P2-5 | Implement `--resume-from` and `--batch-size` options | P2-3 |
| P2-6 | Implement quality report generation after extraction completes | P2-1, P2-3 |
| P2-7 | Implement per-fact quality metrics calculation (coverage, precision, sample size) | P2-6 |
| P2-8 | Register command in worker index | P2-2 |
| P2-9 | Run extraction against real catalog data (fixture-driven first, then live) | P2-8 |
| P2-10 | Verify idempotency: re-run produces same results | P2-9 |
| P2-11 | Verify rawSpecifications immutability after extraction | P2-9 |

**Focused validation:**
- `nx run worker:test` — extract command tests pass
- `nx run database:test` — quality report CRUD tests pass
- `nx run worker:lint`, `nx run worker:typecheck` — clean
- Manual: run `compatibility:extract --all --dry-run`, inspect output
- Manual: run `compatibility:extract --category CPU`, verify CatalogProduct.compatibility populated

**Stop gate:** Extraction produces typed facts for all seven categories. Quality reports generated. Idempotency verified. No rawSpecifications mutations.

---

### Phase 3: Typed Rule Implementation & Registry + Quality/Reference Gates

**Entry conditions:** Phase 2 complete. Real facts populated for representative catalog. Quality reports generated.

**Exit conditions:** All 14 active-scope rules implemented, registered, and quality-gated. CMP-CPU-MB-002 registered but inactive. Engine evaluates real facts. All rule unit tests pass.

**Affected projects/files (planning level):**
- `packages/compatibility-engine/src/rules/` — NEW: rule implementations
- `packages/compatibility-engine/src/rules/cpu-motherboard-socket.ts` — CMP-CPU-MB-001
- `packages/compatibility-engine/src/rules/cpu-motherboard-support.ts` — CMP-CPU-MB-002
- `packages/compatibility-engine/src/rules/mb-ram-generation.ts` — CMP-MB-RAM-001
- `packages/compatibility-engine/src/rules/mb-ram-module-type.ts` — CMP-MB-RAM-002
- `packages/compatibility-engine/src/rules/mb-ram-slot-count.ts` — CMP-MB-RAM-003
- `packages/compatibility-engine/src/rules/mb-ram-capacity.ts` — CMP-MB-RAM-004
- `packages/compatibility-engine/src/rules/mb-ram-speed.ts` — CMP-MB-RAM-005
- `packages/compatibility-engine/src/rules/mb-case-form-factor.ts` — CMP-MB-CASE-001
- `packages/compatibility-engine/src/rules/gpu-case-length.ts` — CMP-GPU-CASE-001
- `packages/compatibility-engine/src/rules/gpu-case-expansion.ts` — CMP-GPU-CASE-002
- `packages/compatibility-engine/src/rules/psu-wattage.ts` — CMP-PSU-001
- `packages/compatibility-engine/src/rules/psu-gpu-connectors.ts` — CMP-PSU-GPU-001
- `packages/compatibility-engine/src/rules/storage-mb-interface.ts` — CMP-STORAGE-MB-001
- `packages/compatibility-engine/src/rules/graphics-capability.ts` — CMP-GRAPHICS-001
- `packages/compatibility-engine/src/rules/registry.ts` — Default registry factory with activation gates
- `packages/compatibility-engine/src/gates/` — Quality gate checker, reference data gate checker
- `packages/compatibility-engine/src/classifier.ts` — Candidate classification with 4 groups

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P3-1 | Implement quality gate checker: loads `CategoryQualityReport`, checks thresholds | P2-7 |
| P3-2 | Implement reference data gate checker: loads `ReferenceDataset`, checks non-empty | P0-10 |
| P3-3 | Implement CMP-CPU-MB-001 (socket equality) | P1-2 |
| P3-4 | Implement CMP-CPU-MB-002 (support/BIOS, always UNKNOWN) | P3-2 |
| P3-5 | Implement CMP-MB-RAM-001 (generation match) | P1-3 |
| P3-6 | Implement CMP-MB-RAM-002 (module type) | P1-3 |
| P3-7 | Implement CMP-MB-RAM-003 (slot count) | — |
| P3-8 | Implement CMP-MB-RAM-004 (capacity) | — |
| P3-9 | Implement CMP-MB-RAM-005 (speed) | — |
| P3-10 | Implement CMP-MB-CASE-001 (form factor) | P1-3 |
| P3-11 | Implement CMP-GPU-CASE-001 (GPU length) | — |
| P3-12 | Implement CMP-GPU-CASE-002 (expansion slots) | — |
| P3-13 | Implement CMP-PSU-001 (wattage with simplified formula) | — |
| P3-14 | Implement CMP-PSU-GPU-001 (connectors) | — |
| P3-15 | Implement CMP-STORAGE-MB-001 (interface, gated on both quality gates) | P3-1 |
| P3-16 | Implement CMP-GRAPHICS-001 (display capability) | — |
| P3-17 | Implement default registry factory: registers all rules, applies activation gates | P3-1 through P3-16 |
| P3-18 | Implement `classifyCandidate` with 4-group logic and `topReasons` extraction | P3-17 |
| P3-19 | Update `evaluate` to populate `topReasons` in slot results | P3-17 |
| P3-20 | Write rule unit tests: PASS, ERROR, WARNING, UNKNOWN paths for each rule | P3-3 through P3-16 |
| P3-21 | Write gate integration tests: quality gate blocks activation, reference data gate blocks CMP-CPU-MB-002 | P3-1, P3-2, P3-17 |
| P3-22 | Write candidate classifier tests: four groups, top reasons | P3-18 |

**Focused validation:**
- `nx run compatibility-engine:test` — all rule tests, gate tests, classifier tests pass
- `nx run compatibility-engine:lint`, `nx run compatibility-engine:typecheck` — clean
- `nx run compatibility-facts:test` — extractor tests still pass (no regression)

**Stop gate:** All 17 rules tested (14 active + 1 inactive/UNKNOWN + 3 deferred/absent). Quality gates block activation correctly. Candidate classifier produces four groups with reasons.

---

### Phase 4: API / Build / Candidate Integration + Limited Builder Status UI

**Entry conditions:** Phase 3 complete. Engine evaluates real facts. Phase 2 data available.

**Exit conditions:** Build API evaluates real compatibility on item mutation and validation. Candidates grouped into four categories with top reasons. Builder UI displays real statuses. All API and web tests pass.

**Affected projects/files (planning level):**
- `apps/api/src/modules/builds/builds.service.ts` — Load product facts, pass real facts to engine, 4-group candidate classification
- `apps/api/src/modules/builds/builds.service.test.ts` — Integration tests with real fact evaluation
- `apps/web/src/app/features/builder/` — Candidate drawer with 4-group display, real status badges, top reasons

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P4-1 | In `putItem`: load `CatalogProduct.compatibility` for all occupied slots, build `buildFacts` map, evaluate | P3-17, P2-3 |
| P4-2 | In `deleteItem`: same fact loading and evaluation | P3-17 |
| P4-3 | In `validateBuild`: same fact loading and evaluation | P3-17 |
| P4-4 | In `getCandidates`: load candidate `compatibility`, classify into 4 groups, extract top reasons | P3-18, P3-19 |
| P4-5 | Avoid N+1: batch-load CatalogProducts for all occupied slots in single query | P4-1 |
| P4-6 | Persist real evaluation snapshots via existing `updateSnapshots` | P4-1 |
| P4-7 | Update `toBuildDto` mapper to include `topReasons` in slot compatibility | P4-1 |
| P4-8 | Write API integration tests: PUT item triggers real evaluation, missing facts → UNKNOWN | P4-1 through P4-7 |
| P4-9 | Write API integration tests: candidates grouped into 4 categories | P4-4 |
| P4-10 | Builder UI: candidate drawer renders 4 groups with badges and top reasons | P4-4 |
| P4-11 | Builder UI: slot indicator shows real status from API | P4-6 |
| P4-12 | Builder UI: evidence drawer shows triggered rule IDs and reasons | P4-7 |

**Focused validation:**
- `nx run api:test` — integration tests with real fact evaluation pass
- `nx run api:lint`, `nx run api:typecheck` — clean
- `nx run web:test` — component tests for 4-group display pass
- `nx run web:lint`, `nx run web:typecheck`, `nx run web:build` — clean

**Stop gate:** PUT/DELETE/validate produce real statuses. Candidates show 4 groups. Builder UI displays real data. No N+1 queries. No boundary violations.

---

### Phase 5: Representative Backfill, Changed-Flow E2E, Rollout Evidence

**Entry conditions:** Phase 4 complete. All code changes done. Representative catalog data available.

**Exit conditions:** Full E2E journey works with real compatibility data. Quality gates pass for all categories. Rollout evidence documented. All validation passes.

**Affected projects/files (planning level):**
- `apps/web/e2e/` — Updated E2E tests with real compatibility flow
- `apps/api/src/modules/builds/builds.test.ts` — Additional edge-case tests
- E2E tests covering: create build → select products → real compatibility evaluation → warning group → evidence display → purchase plan

**Tasks:**

| ID | Task | Dependencies |
|----|------|--------------|
| P5-1 | Run full backfill: `compatibility:extract --all` against production-like catalog | P2-8, P4-1 |
| P5-2 | Verify quality gates pass for all seven categories | P5-1, P2-7 |
| P5-3 | E2E: build with compatible products → all PASS | P4-1 through P4-12 |
| P5-4 | E2E: build with incompatible products → ERROR shown | P4-1 through P4-12 |
| P5-5 | E2E: build with warning products → WARNING shown | P4-1 through P4-12 |
| P5-6 | E2E: candidate drawer shows 4 groups with correct ordering | P4-10 |
| P5-7 | E2E: missing facts → UNKNOWN displayed, not PASS | P4-11 |
| P5-8 | E2E: full journey create → select → validate → purchase plan → redirect | P5-3 through P5-7 |
| P5-9 | Document rollout evidence: extraction stats, quality metrics, rule activation status | P5-2 |
| P5-10 | Verify CMP-CPU-MB-002 returns UNKNOWN (reference data absent) | P5-1 |
| P5-11 | Verify CMP-STORAGE-MB-001 activation only after both quality gates pass | P5-2 |
| P5-12 | Full monorepo lint, typecheck, test, build at phase completion | P5-1 through P5-11 |

**Focused validation:**
- `nx run web:e2e` — full E2E flow with real compatibility
- `nx run api:test` — all integration tests
- Full monorepo: `nx run-many --target=lint`, `nx run-many --target=typecheck`, `nx run-many --target=test`, `nx run-many --target=build`

**Stop gate:** All E2E tests pass with real data. Quality gates documented. No regressions. Phase complete.

---

## 15. Risk-Based Validation Strategy

| Phase | Validation Scope | Tests Priority |
|-------|-----------------|----------------|
| 0 | Affected packages only: domain, engine, contracts, database, web | Type checks, existing test regression |
| 1 | `compatibility-facts` only | Extractor correctness, alias normalization, fixture coverage |
| 2 | `worker` + `database` only | Extraction pipeline, idempotency, quality report math |
| 3 | `compatibility-engine` only | Rule PASS/ERROR/WARNING/UNKNOWN paths, gate activation, classifier |
| 4 | `api` + `web` only | Real evaluation integration, 4-group candidates, UI rendering |
| 5 | Full monorepo | E2E journey, quality gate evidence, no regressions |

**Test priority ordering within each phase:**
1. Parsing / fact evidence correctness
2. Unit normalization / aliases
3. Missing facts → UNKNOWN (never PASS)
4. Quality math (coverage, precision, sample thresholds)
5. Rule outcomes (PASS/ERROR/WARNING/UNKNOWN for each rule)
6. Persistence / migration / idempotency
7. API contracts (response shapes, 409 behavior)
8. Main journey (create → select → validate → purchase plan)

**No tests for:** trivial getters, static mappings (alias maps tested only for known edge cases), framework behavior.

---

## 16. Blockers & Dependencies

| Blocker | Impact | Mitigation |
|---------|--------|------------|
| No authoritative chipset/family reference data | CMP-CPU-MB-002 inactive/UNKNOWN indefinitely | Rule registered, returns UNKNOWN. Plan explicitly includes it. Activation requires future sourcing. |
| Production scraper closure deferred | Production coverage claims require M2 pagination | Implementation uses fixture/bootstrap data. Production activation gated on M2. |
| M2 pagination deferred | Cannot claim full catalog quality gates pass | Quality gates computed over available data. Claims scoped to "products with rawSpecifications." |
| `CatalogProduct.compatibility` currently untyped | Schema migration needed in Phase 0 | `Schema.Types.Mixed` default `{}` allows typed writes without destructive migration. |

---

## 17. Rollout Gates

1. **Phase 0 gate:** All type checks pass. No behavior change. Existing tests pass.
2. **Phase 1 gate:** All extractors produce correct output for fixtures. No production impact.
3. **Phase 2 gate:** Extraction runs against real catalog. Quality reports generated. No API/UI change yet.
4. **Phase 3 gate:** All rules tested. Gate logic verified. Engine evaluates real facts correctly.
5. **Phase 4 gate:** API returns real statuses. Builder UI renders 4 groups. No regression in existing functionality.
6. **Phase 5 gate (final):** Full E2E passes. Quality gates documented. Monorepo clean.

### Rollback Strategy

- **Phase 0–3:** No production impact. Rollback = revert commits.
- **Phase 4:** If real evaluation causes issues, set `CatalogProduct.compatibility = null` for all products → engine falls back to UNKNOWN (existing behavior).
- **Phase 5:** Same as Phase 4. Quality report collection can be dropped without affecting functionality.

---

## 18. Definition of Done

- [ ] `packages/domain` has typed `CompatibilityFactSet`, `FactEvidence`, `CategoryQualityReport`, `ReferenceDataset`
- [ ] `packages/compatibility-facts` package exists with 7 category extractors, alias maps, fixtures, and tests
- [ ] `packages/compatibility-engine` has 14 active rules + 1 inactive (CMP-CPU-MB-002) + 3 deferred (cooler)
- [ ] `CandidateCompatibilityGroup` includes `COMPATIBLE_WITH_WARNINGS` across engine/contracts/API/UI
- [ ] `CatalogProduct.compatibility` typed as `CompatibilityFactSet | null`, populated by worker
- [ ] `CategoryQualityReport` stored in separate collection with per-fact metrics
- [ ] Worker `compatibility:extract` command with dry-run, batch, resume, idempotency
- [ ] Build API evaluates real facts on PUT/DELETE/validate
- [ ] Candidates classified into 4 groups with top reasons
- [ ] Builder UI displays real statuses, warning group, and evidence
- [ ] CMP-CPU-MB-002 registered but returns UNKNOWN (no reference data)
- [ ] CMP-STORAGE-MB-001 gated on both Storage and Motherboard quality gates
- [ ] PSU uses simplified formula: `cpuWatts + gpuBoardPower + 100W`
- [ ] No architectural boundary violations
- [ ] No rawSpecifications mutations
- [ ] No snapshot identity traversal
- [ ] No payment processing
- [ ] No Build CRUD reimplementation
- [ ] Bundles remain builder-ineligible
- [ ] Cooler/Case Fans remain deferred
- [ ] All focused validation passes per phase
- [ ] Full monorepo validation passes at Phase 5

---

## 19. Documentation Sections Consulted

- ADR-000 §2, §3 (ADR-000.1–.23), §9, §10
- TDD §15.1–15.9 (Compatibility Engine: statuses, evaluation, registry, rules, candidates, score)
- TDD §15.5 (Rule Registry — 15 classes, discrepancy documented)
- TDD §15.7 (Rule Catalog P0 — 17 coded behaviors)
- TDD §15.8 (Candidate Classification — 4 groups)
- TDD §17 (Bundles)
- TDD §23 (Reference Data / Change Control)
- TDD §24 (Database)
- Existing plan: `docs/plans/BuildSense_Compatibility_And_Builder_Plan.md` §3, §4, §7
- Source: `packages/compatibility-engine/src/types.ts`, `engine.ts`
- Source: `packages/domain/src/build.ts`
- Source: `packages/contracts/src/build.ts`
- Source: `packages/database/src/models/catalog-product.ts`
- Source: `apps/api/src/modules/builds/builds.service.ts`
- Source: `apps/worker/src/commands/sigma.ts`
