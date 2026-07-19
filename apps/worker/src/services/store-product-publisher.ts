import type { StoreCode } from '@buildsense/contracts';
import type { CatalogProductRepository } from '@buildsense/database';
import type { OfferRepository } from '@buildsense/database';
import type { RawProductSnapshotRepository } from '@buildsense/database';

// ---------------------------------------------------------------------------
// Publisher port / result types
// ---------------------------------------------------------------------------

export type PublishResultKind =
  | 'PUBLISHED_NEW_PRODUCT'
  | 'PUBLISHED_ADDED_OFFER'
  | 'PUBLISHED_UPDATED_OFFER'
  | 'SKIPPED_ELIGIBILITY'
  | 'SKIPPED_DUPLICATE_GUARD'
  | 'SKIPPED_VARIABLE_PRICE'
  | 'ERROR';

export interface PublishResult {
  kind: PublishResultKind;
  reason: string;
  productId?: string;
  offerId?: string;
}

export interface PublisherInput {
  storeCode: StoreCode;
  externalId: string;
  canonicalUrl: string;
  sourceUrl: string;
  category: string;
  title: string | null;
  brand: string | null;
  model: string | null;
  mpn: string | null;
  imageUrl: string | null;
  priceText: string | null;
  availabilityText: string | null;
  rawSpecifications: Array<{ label: string; value: string }>;
}

export interface StoreProductPublisherConfig {
  catalogProductRepository: CatalogProductRepository;
  offerRepository: OfferRepository;
  snapshotRepository: RawProductSnapshotRepository;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_CATEGORIES = new Set([
  'CPU',
  'GPU',
  'MOTHERBOARD',
  'RAM',
  'MONITOR',
  'PSU',
  'CASE',
  'COOLING',
  'SSD',
  'HDD',
]);

// Categories that are visible in the catalog but cannot be selected as PC
// builder components. Only MONITOR is ineligible; PSU, Case, and Cooling are
// valid builder slots per the PC builder plan.
const BUILDER_INELIGIBLE_CATEGORIES = new Set(['MONITOR']);

// Common suffixes to strip when extracting the core model token for duplicate
// detection.  Order matters: longest first to avoid partial matches.
const MODEL_SUFFIXES = [
  'desktop processor',
  'tray desktop processor',
  'tray',
  'boxed',
  'oem',
  'wof',
  'cooler edition',
  'with wraith stealth cooler',
  'with wraith prism cooler',
  'with wraith spire cooler',
  'processor',
];

// ---------------------------------------------------------------------------
// Category resolution from breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Arabic (El Nour Tech) breadcrumb label → SUPPORTED_CATEGORY mapping.
 * The store's breadcrumbs use Arabic category names that must be
 * translated before matching against SUPPORTED_CATEGORIES.
 */
const ARABIC_CATEGORY_MAP: Record<string, string> = {
  'باور سبلاي': 'PSU',
  'كيسه كمبيوتر': 'CASE',
  'تبريد': 'COOLING',
};

/**
 * Search breadcrumbs for the first entry matching a recognized hardware
 * category.  Returns the matched category or the provided fallback.
 *
 * The raw breadcrumbs array may start with non-category entries such as
 * "Home", "Shop", or a store name.  This function finds the first entry
 * that matches a SUPPORTED_CATEGORIES member (case-insensitive), either
 * directly or via the Arabic category translation map.
 */
export function resolveCategoryFromBreadcrumbs(
  breadcrumbs: string[],
  fallback: string,
): string {
  for (const crumb of breadcrumbs) {
    const trimmed = crumb.trim();
    const upper = trimmed.toUpperCase();

    // Direct match against SUPPORTED_CATEGORIES
    if (SUPPORTED_CATEGORIES.has(upper)) {
      return upper;
    }

    // Arabic label translation → then check SUPPORTED_CATEGORIES
    const translated = ARABIC_CATEGORY_MAP[trimmed];
    if (translated !== undefined && SUPPORTED_CATEGORIES.has(translated)) {
      return translated;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export function checkEligibility(input: PublisherInput): { eligible: boolean; reason: string } {
  if (!SUPPORTED_CATEGORIES.has(input.category)) {
    return { eligible: false, reason: `UNSUPPORTED_CATEGORY:${input.category}` };
  }
  if (!input.title || input.title.trim().length === 0) {
    return { eligible: false, reason: 'EMPTY_TITLE' };
  }
  if (!input.canonicalUrl || input.canonicalUrl.trim().length === 0) {
    return { eligible: false, reason: 'EMPTY_CANONICAL_URL' };
  }
  if (!input.externalId || input.externalId.trim().length === 0) {
    return { eligible: false, reason: 'EMPTY_EXTERNAL_ID' };
  }

  // Price: must be a fixed positive number in EGP
  const price = parseFixedPrice(input.priceText);
  if (price === null) {
    // Variable/null/invalid price → skip publish but raw is preserved upstream
    return { eligible: false, reason: `INVALID_PRICE:${input.priceText ?? 'null'}` };
  }
  if (price <= 0) {
    return { eligible: false, reason: `NON_POSITIVE_PRICE:${price}` };
  }

  if (!input.availabilityText || input.availabilityText.trim().length === 0) {
    return { eligible: false, reason: 'EMPTY_AVAILABILITY' };
  }

  // OOS + exact 1 EGP is a placeholder price from the store — skip publishing.
  // Positive OOS offers with a real price are allowed.
  const availability = mapAvailability(input.availabilityText);
  if (availability === 'OUT_OF_STOCK' && price === 1) {
    return { eligible: false, reason: 'OOS_PLACEHOLDER_PRICE:1' };
  }

  return { eligible: true, reason: 'OK' };
}

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

export function parseFixedPrice(priceText: string | null): number | null {
  if (priceText == null) return null;
  // Preserve leading minus sign for negative detection, then strip everything else
  const isNegative = priceText.includes('-');
  const cleaned = priceText.replace(/[^0-9.]/g, '').trim();
  if (cleaned.length === 0) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num <= 0) return null;
  if (isNegative) return null;
  return num;
}

// ---------------------------------------------------------------------------
// Availability mapping
// ---------------------------------------------------------------------------

function mapAvailability(
  availabilityText: string,
): 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' {
  const lower = availabilityText.toLowerCase().trim();
  if (lower.includes('in stock') || lower === 'instock') return 'IN_STOCK';
  if (lower.includes('out of stock') || lower === 'outofstock') return 'OUT_OF_STOCK';
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Model normalization for duplicate detection
// ---------------------------------------------------------------------------

/**
 * Extract a core model token from a model string by stripping common suffixes
 * and normalizing whitespace.  Returns lowercase trimmed core.
 *
 * Examples:
 *   "Ryzen 5 8600G Tray Desktop Processor" → "ryzen 5 8600g"
 *   "Ryzen 7 5700 (Tray)" → "ryzen 7 5700"
 *   "Ryzen 5 5600T Desktop Processor" → "ryzen 5 5600t"
 */
export function extractCoreModelToken(model: string | null): string | null {
  if (!model) return null;
  let core = model.toLowerCase().trim();
  // Remove parenthetical qualifiers
  core = core.replace(/\([^)]*\)/g, '').trim();
  // Strip known suffixes
  for (const suffix of MODEL_SUFFIXES) {
    if (core.endsWith(suffix)) {
      core = core.slice(0, core.length - suffix.length).trim();
    }
  }
  return core.length > 0 ? core : null;
}

/**
 * Extract the short alphanumeric model identifier (e.g. "8600G", "5600T", "5700")
 * from a model string.  Returns the first token matching a pattern like
 * digits optionally followed by a letter suffix.
 */
export function extractModelShortToken(model: string | null): string | null {
  if (!model) return null;
  const match = model.match(/\b(\d{4,5}[a-z]?)\b/i);
  return match ? match[1]!.toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Duplicate guard
// ---------------------------------------------------------------------------

export interface DuplicateGuardResult {
  status: 'CLEAR' | 'REVIEW_REQUIRED';
  reason: string;
  candidateId?: string;
}

/**
 * Check whether a new product is a plausible duplicate of an existing one.
 *
 * Rules:
 * 1. Exact MPN + brand match → handled by caller (exact match, not a guard issue)
 * 2. Same category + brand + short model token match → REVIEW_REQUIRED
 * 3. Same category + brand + core model token match → REVIEW_REQUIRED
 * 4. Otherwise → CLEAR
 */
export async function checkDuplicateGuard(
  input: PublisherInput,
  catalogProductRepository: CatalogProductRepository,
): Promise<DuplicateGuardResult> {
  const brand = normalizeBrand(input.brand);
  if (!brand) {
    return { status: 'CLEAR', reason: 'NO_BRAND_FOR_COMPARISON' };
  }

  const shortToken = extractModelShortToken(input.model);
  const coreToken = extractCoreModelToken(input.model);

  // Search for existing products in same category + brand
  const existingProducts = await catalogProductRepository.findByCategoryAndBrand(
    input.category,
    brand,
  );

  if (existingProducts.length === 0) {
    return { status: 'CLEAR', reason: 'NO_SAME_CATEGORY_BRAND_PRODUCTS' };
  }

  for (const existing of existingProducts) {
    const existingShort = extractModelShortToken(existing.model);
    const existingCore = extractCoreModelToken(existing.model);

    // Short token match (e.g. both have "8600G")
    if (shortToken && existingShort && shortToken === existingShort) {
      return {
        status: 'REVIEW_REQUIRED',
        reason: `PLAUSIBLE_DUPLICATE_SHORT_TOKEN:${shortToken}`,
        candidateId: String(existing._id),
      };
    }

    // Core model token match (e.g. both normalize to "ryzen 5 8600g")
    if (coreToken && existingCore && coreToken === existingCore) {
      return {
        status: 'REVIEW_REQUIRED',
        reason: `PLAUSIBLE_DUPLICATE_CORE_TOKEN:${coreToken}`,
        candidateId: String(existing._id),
      };
    }
  }

  return { status: 'CLEAR', reason: 'NO_PLAUSIBLE_DUPLICATE' };
}

// ---------------------------------------------------------------------------
// Brand normalization
// ---------------------------------------------------------------------------

export function normalizeBrand(brand: string | null): string | null {
  if (!brand) return null;
  return brand.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Main publisher
// ---------------------------------------------------------------------------

export class StoreProductPublisher {
  constructor(private readonly config: StoreProductPublisherConfig) {}

  /**
   * Attempt to publish a scraped product into the catalog + offer tables.
   *
   * Semantics:
   * A. Eligibility check
   * B. Idempotent: find existing offer by (storeCode, externalId) and update
   * C. Exact cross-store matching: exact MPN + brand → add offer to existing product
   * D. Plausible duplicate guard before creating new product
   * E. New product creation
   * F. Fail publishing must not invalidate raw snapshot or scrape run
   */
  async publish(input: PublisherInput): Promise<PublishResult> {
    // A. Eligibility
    const eligibility = checkEligibility(input);
    if (!eligibility.eligible) {
      return { kind: 'SKIPPED_ELIGIBILITY', reason: eligibility.reason };
    }

    const price = parseFixedPrice(input.priceText)!;

    // B. Idempotency: check existing offer
    const existingOffer = await this.config.offerRepository.findByStoreExternalId(
      input.storeCode,
      input.externalId,
    );

    if (existingOffer) {
      // Update existing offer
      const updated = await this.config.offerRepository.upsert({
        catalogProductId: existingOffer.catalogProductId,
        storeCode: input.storeCode,
        storeExternalId: input.externalId,
        sourceUrl: input.canonicalUrl,
        price,
        currency: 'EGP',
        availability: mapAvailability(input.availabilityText!),
      });

      return {
        kind: 'PUBLISHED_UPDATED_OFFER',
        reason: 'OFFER_UPDATED',
        productId: String(existingOffer.catalogProductId),
        offerId: String(updated._id),
      };
    }

    // C. Exact cross-store matching: exact brand + MPN
    const normalizedBrand = normalizeBrand(input.brand);
    const normalizedMpn = input.mpn?.trim() ?? null;

    if (normalizedBrand && normalizedMpn) {
      const exactMatch = await this.config.catalogProductRepository.findByBrandAndMpn(
        normalizedBrand,
        normalizedMpn,
      );

      if (exactMatch) {
        // Add offer to existing product
        const newOffer = await this.config.offerRepository.upsert({
          catalogProductId: exactMatch._id,
          storeCode: input.storeCode,
          storeExternalId: input.externalId,
          sourceUrl: input.canonicalUrl,
          price,
          currency: 'EGP',
          availability: mapAvailability(input.availabilityText!),
        });

        return {
          kind: 'PUBLISHED_ADDED_OFFER',
          reason: `EXACT_MPN_MATCH:${normalizedMpn}`,
          productId: String(exactMatch._id),
          offerId: String(newOffer._id),
        };
      }
    }

    // D. Plausible duplicate guard
    const guard = await checkDuplicateGuard(input, this.config.catalogProductRepository);
    if (guard.status === 'REVIEW_REQUIRED') {
      return {
        kind: 'SKIPPED_DUPLICATE_GUARD',
        reason: guard.reason,
        ...(guard.candidateId !== undefined && { productId: guard.candidateId }),
      };
    }

    // E. New product creation
    try {
      const { CatalogProductModel } = await import('@buildsense/database');

      const newProduct = await CatalogProductModel.create({
        title: input.title!.trim(),
        category: input.category,
        brand: normalizedBrand,
        model: input.model?.trim() ?? null,
        mpn: normalizedMpn,
        images: input.imageUrl ? [input.imageUrl] : [],
        rawSpecifications: input.rawSpecifications,
        compatibility: null,
        buildEligibility: BUILDER_INELIGIBLE_CATEGORIES.has(input.category)
          ? 'NOT_ELIGIBLE'
          : 'ELIGIBLE',
      });

      const newOffer = await this.config.offerRepository.upsert({
        catalogProductId: newProduct._id,
        storeCode: input.storeCode,
        storeExternalId: input.externalId,
        sourceUrl: input.canonicalUrl,
        price,
        currency: 'EGP',
        availability: mapAvailability(input.availabilityText!),
      });

      return {
        kind: 'PUBLISHED_NEW_PRODUCT',
        reason: 'NEW_PRODUCT_CREATED',
        productId: String(newProduct._id),
        offerId: String(newOffer._id),
      };
    } catch (error) {
      return {
        kind: 'ERROR',
        reason: `CREATE_FAILED:${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
