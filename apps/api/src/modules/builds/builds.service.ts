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
  CandidateCompatibilityGroupDto,
  CandidateProductDto,
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
};

const VALID_SLOTS = new Set<string>(BUILD_SLOTS);

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
    if (product.category !== expectedCategory) {
      return { kind: 'not_found' };
    }

    // 5. Quantity check
    const constraints = SLOT_QUANTITY_CONSTRAINTS[slot as BuildSlot];
    if (!constraints || quantity < constraints.min || quantity > constraints.max) {
      return { kind: 'not_found' };
    }

    // 6. Load offer
    const offer = await OfferModel.findOne({
      catalogProductId: productId,
      storeCode: 'SIGMA',
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
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
  ): Promise<{ groups: CandidateCompatibilityGroupDto[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } } | null> {
    const build = await this.repo.findByPublicId(publicId);
    if (!build) return null;

    if (!VALID_SLOTS.has(slot)) {
      return { groups: [], pagination: { page, pageSize, totalItems: 0, totalPages: 0 } };
    }

    const category = SLOT_CATEGORY_MAP[slot as BuildSlot];

    // Query eligible products in this category with their SIGMA offer
    const skip = (page - 1) * pageSize;
    const pipeline: mongoose.PipelineStage[] = [
      { $match: { category, buildEligibility: { $ne: 'NOT_ELIGIBLE' } } },
      {
        $lookup: {
          from: 'offers',
          localField: '_id',
          foreignField: 'catalogProductId',
          as: 'offers',
        },
      },
      {
        $addFields: {
          sigmaOffer: {
            $first: {
              $filter: {
                input: '$offers',
                as: 'o',
                cond: { $eq: ['$$o.storeCode', 'SIGMA'] },
              },
            },
          },
        },
      },
      { $match: { sigmaOffer: { $ne: null } } },
      { $sort: { title: 1 } },
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

    const { engine, buildFacts, extractorVersions } = await this.createEvaluationContext(build.items);
    const grouped = new Map<string, { products: CandidateProductDto[]; reasons: string[] }>();
    for (const status of ['COMPATIBLE', 'COMPATIBLE_WITH_WARNINGS', 'UNKNOWN', 'INCOMPATIBLE']) {
      grouped.set(status, { products: [], reasons: [] });
    }

    for (const d of data) {
      const offer = d.sigmaOffer as Record<string, unknown> | undefined;
      const product: CandidateProductDto = {
        productId: String(d._id),
        name: d.title as string,
        thumbnailUrl: (d.images as string[] | undefined)?.[0] ?? null,
        price: (offer?.price as number | null) ?? null,
        sourceUrl: (offer?.sourceUrl as string) ?? '',
        storeCode: (offer?.storeCode as string) ?? 'SIGMA',
      };
      const candidateFacts = this.toFactRecord(
        d.compatibility,
        category,
        extractorVersions.get(category) ?? null,
      );
      const classification = engine.classifyCandidateWithReasons(slot as BuildSlot, candidateFacts, buildFacts);
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
    extractorVersions: ReadonlyMap<string, string>;
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
      const category = SLOT_CATEGORY_MAP[slot];
      const product = productById.get(item.productId);
      const report = latestByCategory.get(category);
      const record = this.toFactRecord(product?.compatibility, category, report?.extractorVersion ?? null);
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
      extractorVersions: new Map(
        [...latestByCategory.entries()].map(([category, report]) => [category, report.extractorVersion]),
      ),
    };
  }

  private toFactRecord(
    compatibility: unknown,
    category: string,
    requiredVersion: string | null,
  ): Record<string, unknown> {
    if (!compatibility || typeof compatibility !== 'object') return {};
    const factSet = compatibility as { category?: unknown; extractorVersion?: unknown; facts?: unknown };
    if (factSet.category !== category || factSet.extractorVersion !== requiredVersion) {
      return {};
    }
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
