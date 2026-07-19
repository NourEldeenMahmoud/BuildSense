import {
  BuildRepository,
  CatalogProductModel,
  OfferModel,
  CategoryQualityReportModel,
  ReferenceDatasetModel,
} from '@buildsense/database';
import type { MutateBuildResult } from '@buildsense/database';
import { createDefaultCompatibilityEngine, type CompatibilityEngine } from '@buildsense/compatibility-engine';
import {
  BUILD_SLOTS,
  SLOT_QUANTITY_CONSTRAINTS,
  type BuildSlot,
  type CategoryQualityReport,
  type ReferenceDataset,
} from '@buildsense/domain';
import type {
  BuildDto,
  BuildSlotName,
  CandidateAvailabilityFilter,
  CandidateCompatibilityGroupDto,
  CandidateOfferDto,
  CandidateProductDto,
  OfferAvailability,
  PurchasePlanDto,
} from '@buildsense/contracts';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Slot ↔ category mapping
// ---------------------------------------------------------------------------

const SLOT_CATEGORY_MAP: Record<BuildSlot, string> = {
  cpu: 'CPU',
  motherboard: 'Motherboard',
  ram: 'RAM',
  gpu: 'GPU',
  storage: 'Storage',
  psu: 'PSU',
  case: 'Case',
  cooling: 'COOLING',
};

/**
 * Canonical categories accepted for each slot's category filter.
 * Storage accepts Storage/SSD/HDD to match live catalog data.
 * Other slots accept exactly one canonical category.
 */
const SLOT_ACCEPTED_CATEGORIES: Record<BuildSlot, readonly string[]> = {
  cpu: ['CPU'],
  motherboard: ['Motherboard'],
  ram: ['RAM'],
  gpu: ['GPU'],
  storage: ['Storage', 'SSD', 'HDD'],
  psu: ['PSU'],
  case: ['Case'],
  cooling: ['COOLING'],
};

const VALID_SLOTS = new Set<string>(BUILD_SLOTS);

function categoryMatches(actual: string, expected: string): boolean {
  return actual.toLocaleLowerCase() === expected.toLocaleLowerCase();
}

// ---------------------------------------------------------------------------
// DTO mapper
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function toBuildDto(doc: any): BuildDto {
  return {
    publicId: doc.publicId as string,
    name: doc.name as string,
    version: doc.version as number,
    items: (doc.items as any[]).map((i: any) => ({
      productId: i.productId as string,
      slot: i.slot as BuildSlotName,
      quantity: i.quantity as number,
      unitPrice: i.unitPrice as number | null,
      totalPrice: i.totalPrice as number | null,
      productName: i.productName as string,
      thumbnailUrl: i.thumbnailUrl as string | null,
      sourceUrl: i.sourceUrl as string,
      storeCode: i.storeCode as string,
    })),
    compatibility: {
      overallStatus: doc.compatibility.overallStatus as BuildDto['compatibility']['overallStatus'],
      slots: (doc.compatibility.slots as any[]).map((s: any) => ({
        slot: s.slot as BuildSlotName,
        status: s.status as BuildDto['compatibility']['slots'][number]['status'],
        triggeredRuleIds: s.triggeredRuleIds as string[],
        topReasons: (s.topReasons as string[] | undefined) ?? [],
        missingFactKeys: (s.missingFactKeys as string[] | undefined) ?? [],
      })),
    },
    pricing: {
      totalPrice: doc.pricing.totalPrice as number | null,
      itemCount: doc.pricing.itemCount as number,
    },
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BuildService {
  private readonly repo = new BuildRepository();

  // -- Create ----------------------------------------------------------------

  async createBuild(name: string): Promise<BuildDto> {
    const doc = await this.repo.create({ name: name || 'Untitled Build' });
    return toBuildDto(doc);
  }

  // -- Read ------------------------------------------------------------------

  async getBuild(publicId: string): Promise<BuildDto | null> {
    const doc = await this.repo.findByPublicId(publicId);
    return doc ? toBuildDto(doc) : null;
  }

  // -- Update name -----------------------------------------------------------

  async updateBuild(
    publicId: string,
    expectedVersion: number,
    name: string,
  ): Promise<MutateBuildResult> {
    return this.repo.updateName(publicId, expectedVersion, name);
  }

  // -- Put item --------------------------------------------------------------

  async putItem(
    publicId: string,
    expectedVersion: number,
    slot: string,
    productId: string,
    quantity: number,
  ): Promise<MutateBuildResult> {
    // 1. Validate slot
    if (!VALID_SLOTS.has(slot)) {
      return { kind: 'not_found' };
    }

    // 2. Load product
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return { kind: 'not_found' };
    }
    const product = await CatalogProductModel.findById(productId).lean().exec();
    if (!product) {
      return { kind: 'not_found' };
    }

    // 3. Bundle check
    if (product.buildEligibility === 'NOT_ELIGIBLE') {
      return { kind: 'not_found' };
    }

    // 4. Category check
    const expectedCategory = SLOT_CATEGORY_MAP[slot as BuildSlot];
    if (!categoryMatches(product.category, expectedCategory)) {
      return { kind: 'not_found' };
    }

    // 5. Quantity check
    const constraints = SLOT_QUANTITY_CONSTRAINTS[slot as BuildSlot];
    if (!constraints || quantity < constraints.min || quantity > constraints.max) {
      return { kind: 'not_found' };
    }

    // 6. Load best offer (prefer in-stock, cheapest; fallback to any)
    const offers = await OfferModel.find({
      catalogProductId: productId,
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
    const offer = pickBestOffer(offers);
    if (!offer) {
      return { kind: 'not_found' };
    }

    // 7. Create item snapshot
    const item = {
      productId: String(product._id),
      slot,
      quantity,
      productName: product.title,
      thumbnailUrl: product.images[0] ?? null,
      sourceUrl: offer.sourceUrl,
      storeCode: offer.storeCode,
      unitPrice: offer.price,
      totalPrice: offer.price !== null ? offer.price * quantity : null,
      availability: offer.availability,
      lastSeenAt: offer.updatedAt,
    };

    // 8. Atomic replace
    const result = await this.repo.replaceItem(publicId, expectedVersion, item);

    if (result.kind !== 'updated') {
      return result;
    }

    // 9. Evaluate & persist snapshots (version-protected)
    const doc = result.build;
    const { engine, buildFacts } = await this.createEvaluationContext(doc.items);
    const evaluation = engine.evaluate(buildFacts, [...BUILD_SLOTS]);
    const pricing = this.calculatePricing(doc.items);
    const updated = await this.repo.updateSnapshots(doc.publicId, doc.version, {
      overallStatus: evaluation.overallStatus,
      slots: evaluation.slots.map((s) => ({
        slot: s.slot,
        status: s.status,
        triggeredRuleIds: [...s.triggeredRuleIds],
        topReasons: [...s.topReasons],
        missingFactKeys: [...s.missingFactKeys],
      })),
    }, pricing);

    return updated ? { kind: 'updated', build: updated } : result;
  }

  // -- Delete item -----------------------------------------------------------

  async deleteItem(
    publicId: string,
    expectedVersion: number,
    slot: string,
  ): Promise<MutateBuildResult> {
    if (!VALID_SLOTS.has(slot)) {
      return { kind: 'not_found' };
    }

    const result = await this.repo.removeItem(publicId, expectedVersion, slot);

    if (result.kind !== 'updated') {
      return result;
    }

    // Re-evaluate & persist (version-protected)
    const doc = result.build;
    const { engine, buildFacts } = await this.createEvaluationContext(doc.items);
    const evaluation = engine.evaluate(buildFacts, [...BUILD_SLOTS]);
    const pricing = this.calculatePricing(doc.items);
    const updated = await this.repo.updateSnapshots(doc.publicId, doc.version, {
      overallStatus: evaluation.overallStatus,
      slots: evaluation.slots.map((s) => ({
        slot: s.slot,
        status: s.status,
        triggeredRuleIds: [...s.triggeredRuleIds],
        topReasons: [...s.topReasons],
        missingFactKeys: [...s.missingFactKeys],
      })),
    }, pricing);

    return updated ? { kind: 'updated', build: updated } : result;
  }

  // -- Validate --------------------------------------------------------------

  async validateBuild(publicId: string): Promise<BuildDto | null> {
    const doc = await this.repo.findByPublicId(publicId);
    if (!doc) return null;

    const { engine, buildFacts } = await this.createEvaluationContext(doc.items);
    const evaluation = engine.evaluate(buildFacts, [...BUILD_SLOTS]);
    const pricing = this.calculatePricing(doc.items);
    const updated = await this.repo.updateSnapshots(doc.publicId, doc.version, {
      overallStatus: evaluation.overallStatus,
      slots: evaluation.slots.map((s) => ({
        slot: s.slot,
        status: s.status,
        triggeredRuleIds: [...s.triggeredRuleIds],
        topReasons: [...s.topReasons],
        missingFactKeys: [...s.missingFactKeys],
      })),
    }, pricing);

    return toBuildDto(updated ?? doc);
  }

  // -- Candidates ------------------------------------------------------------

  async getCandidates(
    publicId: string,
    slot: string,
    page: number,
    pageSize: number,
    options?: { search?: string | null; availability?: CandidateAvailabilityFilter },
  ): Promise<{ groups: CandidateCompatibilityGroupDto[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } } | null> {
    const build = await this.repo.findByPublicId(publicId);
    if (!build) return null;

    if (!VALID_SLOTS.has(slot)) {
      return { groups: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const buildSlot = slot as BuildSlot;
    const acceptedCategories = SLOT_ACCEPTED_CATEGORIES[buildSlot];
    const availabilityFilter: CandidateAvailabilityFilter = options?.availability ?? 'ALL';
    const searchRegex = options?.search ? new RegExp(options.search, 'i') : null;

    // Build the category match filter
    const categoryPatterns = acceptedCategories.map((c) => new RegExp(`^${c}$`, 'i'));

    // -- Step 1: Find all eligible products in matching categories ------------
    const productMatch: Record<string, unknown> = {
      category: { $in: categoryPatterns },
      buildEligibility: { $ne: 'NOT_ELIGIBLE' },
    };

    // Search filter (before facet)
    if (searchRegex) {
      productMatch.$or = [
        { title: searchRegex },
        { brand: searchRegex },
        { model: searchRegex },
      ];
    }

    // -- Step 2: Lookup all offers for matching products ----------------------
    const skip = (page - 1) * pageSize;
    const pipeline: mongoose.PipelineStage[] = [
      { $match: productMatch },
      {
        $lookup: {
          from: 'offers',
          localField: '_id',
          foreignField: 'catalogProductId',
          as: 'allOffers',
        },
      },
      // Filter to valid offers: finite positive price, non-empty storeCode, non-empty sourceUrl
      {
        $addFields: {
          validOffers: {
            $filter: {
              input: '$allOffers',
              as: 'o',
              cond: {
                $and: [
                  { $gt: ['$$o.price', 0] },
                  { $ne: ['$$o.price', null] },
                  { $ne: ['$$o.storeCode', ''] },
                  { $ne: ['$$o.storeCode', null] },
                  { $ne: ['$$o.sourceUrl', ''] },
                  { $ne: ['$$o.sourceUrl', null] },
                ],
              },
            },
          },
        },
      },
      // Apply availability filter on valid offers
      ...this.buildAvailabilityStage(availabilityFilter),
      // Only keep products that have at least one offer remaining
      { $match: { filteredOffers: { $ne: [] } } },
      // Sort: title ascending for deterministic ordering
      { $sort: { title: 1 } },
      // Facet: count total, then paginate
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skip }, { $limit: pageSize }],
        },
      },
    ];

    const [result] = await CatalogProductModel.aggregate(pipeline);
    const data: Array<Record<string, unknown>> = result?.data ?? [];
    const totalItems: number = result?.metadata?.[0]?.total ?? 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 0;

    // -- Step 3: Build compatibility context ----------------------------------
    const { engine, buildFacts } = await this.createEvaluationContext(build.items);
    const grouped = new Map<string, { products: CandidateProductDto[]; reasons: string[] }>();
    for (const status of ['COMPATIBLE', 'COMPATIBLE_WITH_WARNINGS', 'UNKNOWN', 'INCOMPATIBLE']) {
      grouped.set(status, { products: [], reasons: [] });
    }

    // -- Step 4: Map each product to a candidate DTO -------------------------
    for (const d of data) {
      const allOffers = (d.filteredOffers ?? d.validOffers ?? []) as Array<Record<string, unknown>>;

      // Sort offers deterministically: IN_STOCK first, then UNKNOWN, then OUT_OF_STOCK; within same rank lowest price
      const sortedOffers = this.sortOffers(allOffers);

      // Pick best offer
      const best = sortedOffers[0] ?? null;

      // Build offers array
      const offers: CandidateOfferDto[] = sortedOffers.map((o) => ({
        storeCode: String(o.storeCode),
        price: Number(o.price),
        currency: (o.currency as string | null) ?? null,
        availability: this.toOfferAvailability(o.availability),
        sourceUrl: String(o.sourceUrl),
      }));

      const bestOffer = best ? {
        price: Number(best.price),
        sourceUrl: String(best.sourceUrl),
        storeCode: String(best.storeCode),
        availability: this.toOfferAvailability(best.availability),
      } : { price: null, sourceUrl: '', storeCode: '', availability: 'UNKNOWN' as OfferAvailability };

      const product: CandidateProductDto = {
        productId: String(d._id),
        name: d.title as string,
        brand: (d.brand as string | null) ?? null,
        model: (d.model as string | null) ?? null,
        thumbnailUrl: (d.images as string[] | undefined)?.[0] ?? null,
        price: bestOffer.price,
        sourceUrl: bestOffer.sourceUrl,
        storeCode: bestOffer.storeCode,
        availability: bestOffer.availability,
        offers,
      };

      const candidateFacts = this.toFactRecord(d.compatibility);
      const classification = engine.classifyCandidateWithReasons(buildSlot, candidateFacts, buildFacts);
      const group = grouped.get(classification.group)!;
      group.products.push(product);
      for (const reason of classification.topReasons) {
        if (!group.reasons.includes(reason) && group.reasons.length < 3) group.reasons.push(reason);
      }
    }

    const groups: CandidateCompatibilityGroupDto[] = [];
    for (const status of ['COMPATIBLE', 'COMPATIBLE_WITH_WARNINGS', 'UNKNOWN', 'INCOMPATIBLE'] as const) {
      const group = grouped.get(status)!;
      if (group.products.length > 0) {
        groups.push({ status, products: group.products, topReasons: group.reasons });
      }
    }

    return {
      groups,
      pagination: { page, pageSize, totalItems, totalPages },
    };
  }

  // -- Purchase plan ---------------------------------------------------------

  async getPurchasePlan(publicId: string): Promise<PurchasePlanDto | null> {
    const doc = await this.repo.findByPublicId(publicId);
    if (!doc) return null;

    let totalPrice = 0;
    let hasNullPrice = false;

    const items = doc.items.map((item) => {
      if (item.totalPrice === null) hasNullPrice = true;
      else totalPrice += item.totalPrice;

      return {
        productId: item.productId,
        productName: item.productName,
        slot: item.slot as BuildSlotName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        sourceUrl: item.sourceUrl,
        storeCode: item.storeCode,
        availability: item.availability,
        lastSeenAt: item.lastSeenAt?.toISOString() ?? null,
      };
    });

    return {
      buildPublicId: doc.publicId,
      items,
      totalPrice: hasNullPrice ? null : totalPrice,
      itemCount: items.length,
    };
  }

  // -- Helpers ---------------------------------------------------------------

  /**
   * Builds a MongoDB aggregation pipeline stage that filters the `validOffers`
   * array into `filteredOffers` based on the availability filter.
   *
   * ALL includes IN_STOCK, OUT_OF_STOCK, UNKNOWN.
   * IN_STOCK includes only IN_STOCK.
   * OUT_OF_STOCK includes only OUT_OF_STOCK.
   */
  private buildAvailabilityStage(filter: CandidateAvailabilityFilter): mongoose.PipelineStage[] {
    let availabilityCondition: Record<string, unknown>;
    if (filter === 'IN_STOCK') {
      availabilityCondition = { $eq: ['$$o.availability', 'IN_STOCK'] };
    } else if (filter === 'OUT_OF_STOCK') {
      availabilityCondition = { $eq: ['$$o.availability', 'OUT_OF_STOCK'] };
    } else {
      // ALL: IN_STOCK, OUT_OF_STOCK, or UNKNOWN
      availabilityCondition = {
        $in: ['$$o.availability', ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN']],
      };
    }

    return [
      {
        $addFields: {
          filteredOffers: {
            $filter: {
              input: '$validOffers',
              as: 'o',
              cond: availabilityCondition,
            },
          },
        },
      },
    ];
  }

  /**
   * Sort offers deterministically:
   * 1. IN_STOCK first, UNKNOWN second, OUT_OF_STOCK last.
   * 2. Within the same rank, lowest positive price first.
   * 3. Stable tiebreak by storeCode, sourceUrl, _id.
   */
  private sortOffers(
    offers: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const availabilityRank: Record<string, number> = {
      IN_STOCK: 0,
      UNKNOWN: 1,
      OUT_OF_STOCK: 2,
    };

    return [...offers].sort((a, b) => {
      const rankA = availabilityRank[this.toOfferAvailability(a.availability)] ?? 3;
      const rankB = availabilityRank[this.toOfferAvailability(b.availability)] ?? 3;
      if (rankA !== rankB) return rankA - rankB;

      const priceA = typeof a.price === 'number' && a.price > 0 ? a.price : Infinity;
      const priceB = typeof b.price === 'number' && b.price > 0 ? b.price : Infinity;
      if (priceA !== priceB) return priceA - priceB;

      const storeA = String(a.storeCode ?? '');
      const storeB = String(b.storeCode ?? '');
      if (storeA !== storeB) return storeA.localeCompare(storeB);

      const urlA = String(a.sourceUrl ?? '');
      const urlB = String(b.sourceUrl ?? '');
      if (urlA !== urlB) return urlA.localeCompare(urlB);

      const idA = String(a._id ?? '');
      const idB = String(b._id ?? '');
      return idA.localeCompare(idB);
    });
  }

  /**
   * Normalize offer availability to the OfferAvailability type.
   */
  private toOfferAvailability(raw: unknown): OfferAvailability {
    if (raw === 'IN_STOCK' || raw === 'OUT_OF_STOCK') return raw;
    return 'UNKNOWN';
  }

  private calculatePricing(items: Array<{ totalPrice: number | null }>): { totalPrice: number | null; itemCount: number } {
    let total = 0;
    let hasNull = false;
    for (const item of items) {
      if (item.totalPrice === null) hasNull = true;
      else total += item.totalPrice;
    }
    return { totalPrice: hasNull ? null : total, itemCount: items.length };
  }

  private async createEvaluationContext(
    items: Array<{ productId: string; slot: string; quantity: number }>,
  ): Promise<{
    engine: CompatibilityEngine;
    buildFacts: ReadonlyMap<BuildSlot, Record<string, unknown>>;
  }> {
    const [qualityDocuments, referenceDocument, products] = await Promise.all([
      CategoryQualityReportModel.find({}).sort({ evaluatedAt: -1 }).lean().exec(),
      ReferenceDatasetModel.findOne({}).sort({ publishedAt: -1 }).lean().exec(),
      CatalogProductModel.find({ _id: { $in: items.map((item) => item.productId) } }).lean().exec(),
    ]);

    const latestByCategory = new Map<string, CategoryQualityReport>();
    for (const report of qualityDocuments) {
      if (!latestByCategory.has(report.category)) {
        latestByCategory.set(report.category, {
          category: report.category,
          extractorVersion: report.extractorVersion,
          totalProducts: report.totalProducts,
          factMetrics: report.factMetrics.map((metric) => ({ ...metric })),
          allGatesPass: report.allGatesPass,
          evaluatedAt: report.evaluatedAt.toISOString(),
        });
      }
    }

    const referenceDataset: ReferenceDataset | null = referenceDocument
      ? {
          version: referenceDocument.version,
          publishedAt: referenceDocument.publishedAt.toISOString(),
          citation: referenceDocument.citation,
          chipsetCpuSupport: referenceDocument.chipsetCpuSupport.map((entry) => ({
            chipset: entry.chipset,
            supportedFamilies: entry.supportedFamilies,
            biosUpdateRequired: entry.biosUpdateRequired,
            source: entry.source,
            verifiedAt: entry.verifiedAt.toISOString(),
          })),
        }
      : null;

    const productById = new Map(products.map((product) => [String(product._id), product]));
    const buildFacts = new Map<BuildSlot, Record<string, unknown>>();
    for (const item of items) {
      const slot = item.slot as BuildSlot;
      const product = productById.get(item.productId);
      const record = this.toFactRecord(product?.compatibility);
      if (slot === 'ram' && item.quantity > 1) {
        if (typeof record['ram.moduleCount'] === 'number') record['ram.moduleCount'] *= item.quantity;
        if (typeof record['ram.capacityGB'] === 'number') record['ram.capacityGB'] *= item.quantity;
      }
      if (product) buildFacts.set(slot, record);
    }

    return {
      engine: createDefaultCompatibilityEngine({
        qualityReports: [...latestByCategory.values()],
        referenceDataset,
      }),
      buildFacts,
    };
  }

  /**
   * Extract a flat key→value fact record from a product's compatibility
   * sub-document. The engine only needs the fact keys and values — category
   * and extractorVersion are metadata tracked by the quality report layer
   * and do not gate runtime fact flow.
   */
  private toFactRecord(
    compatibility: unknown,
  ): Record<string, unknown> {
    if (!compatibility || typeof compatibility !== 'object') return {};
    const factSet = compatibility as { facts?: unknown };
    const facts = factSet.facts;
    if (!Array.isArray(facts)) return {};
    return Object.fromEntries(
      facts.flatMap((fact) => {
        if (!fact || typeof fact !== 'object') return [];
        const entry = fact as { key?: unknown; value?: unknown };
        return typeof entry.key === 'string' && entry.value !== null
          ? [[entry.key, entry.value] as const]
          : [];
      }),
    );
  }
}

/**
 * Pick the best offer deterministically:
 * 1. Among in-stock offers, choose the cheapest.
 * 2. If none in-stock, among all offers, choose the cheapest.
 * 3. If none have a valid price, return any offer (first).
 */
interface OfferForPicking {
  price: number | null;
  availability: string;
  sourceUrl: string;
  storeCode: string;
  updatedAt: Date;
}

function pickBestOffer(
  offers: OfferForPicking[],
): OfferForPicking | null {
  if (offers.length === 0) return null;

  const inStock = offers.filter((o) => o.availability === 'IN_STOCK' && o.price !== null && o.price >= 0);
  if (inStock.length > 0) {
    return inStock.reduce((best, cur) => (cur.price! < best.price! ? cur : best));
  }

  const anyWithPrice = offers.filter((o) => o.price !== null && o.price >= 0);
  if (anyWithPrice.length > 0) {
    return anyWithPrice.reduce((best, cur) => (cur.price! < best.price! ? cur : best));
  }

  return offers[0]!;
}
