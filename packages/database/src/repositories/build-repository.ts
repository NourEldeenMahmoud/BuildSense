import crypto from 'node:crypto';
import { BuildModel, type BuildDocument, type BuildCompatibility, type BuildPricing } from '../models/build.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateBuildInput {
  name: string;
}

export interface ReplaceItemInput {
  productId: string;
  slot: string;
  quantity: number;
  productName: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  storeCode: string;
  unitPrice: number | null;
  totalPrice: number | null;
  availability: string | null;
  lastSeenAt: Date | null;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result of an atomic build mutation guarded by optimistic concurrency. */
export type MutateBuildResult =
  | { kind: 'updated'; build: BuildDocument }
  | { kind: 'not_found' }
  | { kind: 'version_conflict'; current: BuildDocument };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_SLOTS = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
] as const;

function defaultCompatibility(): BuildCompatibility {
  return {
    overallStatus: 'UNKNOWN',
    slots: ALL_SLOTS.map((slot) => ({
      slot,
      status: 'UNKNOWN' as const,
      triggeredRuleIds: [],
      topReasons: [],
    })),
  };
}

function defaultPricing(): BuildPricing {
  return { totalPrice: null, itemCount: 0 };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class BuildRepository {
  /**
   * Create a new build with a cryptographically random publicId (≥128-bit
   * entropy via UUID v4), version 1, empty items, and default UNKNOWN
   * compatibility.
   */
  async create(input: CreateBuildInput): Promise<BuildDocument> {
    return BuildModel.create({
      publicId: crypto.randomUUID(),
      name: input.name,
      version: 1,
      items: [],
      compatibility: defaultCompatibility(),
      pricing: defaultPricing(),
    });
  }

  /** Find a build by its public ID. */
  async findByPublicId(publicId: string): Promise<BuildDocument | null> {
    return BuildModel.findOne({ publicId });
  }

  /**
   * Atomically update the build name, guarded by optimistic concurrency.
   * Increments version only when the document is actually modified.
   */
  async updateName(
    publicId: string,
    expectedVersion: number,
    name: string,
  ): Promise<MutateBuildResult> {
    const updated = await BuildModel.findOneAndUpdate(
      { publicId, version: expectedVersion },
      { $set: { name }, $inc: { version: 1 } },
      { new: true },
    );

    if (updated) return { kind: 'updated', build: updated };

    return this.resolveConflict(publicId, expectedVersion);
  }

  /**
   * Atomically replace (or insert) the single selected product in a slot.
   * If the slot already has an item it is replaced; otherwise the new item
   * is pushed. Version is incremented on success.
   */
  async replaceItem(
    publicId: string,
    expectedVersion: number,
    item: ReplaceItemInput,
  ): Promise<MutateBuildResult> {
    // Try to replace an existing item in the slot.
    const replaced = await BuildModel.findOneAndUpdate(
      {
        publicId,
        version: expectedVersion,
        'items.slot': item.slot,
      },
      {
        $set: { 'items.$': item },
        $inc: { version: 1 },
      },
      { new: true },
    );

    if (replaced) return { kind: 'updated', build: replaced };

    // Slot may be empty — try to push the new item.
    const pushed = await BuildModel.findOneAndUpdate(
      {
        publicId,
        version: expectedVersion,
      },
      {
        $push: { items: item },
        $inc: { version: 1 },
      },
      { new: true },
    );

    if (pushed) return { kind: 'updated', build: pushed };

    return this.resolveConflict(publicId, expectedVersion);
  }

  /**
   * Atomically remove the item from a slot. If the slot is already empty
   * the document is returned unchanged (version is not incremented).
   */
  async removeItem(
    publicId: string,
    expectedVersion: number,
    slot: string,
  ): Promise<MutateBuildResult> {
    const removed = await BuildModel.findOneAndUpdate(
      {
        publicId,
        version: expectedVersion,
        'items.slot': slot,
      },
      {
        $pull: { items: { slot } },
        $inc: { version: 1 },
      },
      { new: true },
    );

    if (removed) return { kind: 'updated', build: removed };

    return this.resolveConflict(publicId, expectedVersion);
  }

  /**
   * Update the compatibility and pricing snapshots with version protection.
   * Only writes if the current version matches `expectedVersion`, preventing
   * a stale snapshot update from overwriting a newer concurrent mutation's
   * evaluated snapshots. Does NOT increment version — the item mutation
   * already incremented it.
   *
   * Returns null when the version has moved on (caller should treat as
   * no-op — the next mutation will re-evaluate).
   */
  async updateSnapshots(
    publicId: string,
    expectedVersion: number,
    compatibility: BuildCompatibility,
    pricing: BuildPricing,
  ): Promise<BuildDocument | null> {
    return BuildModel.findOneAndUpdate(
      { publicId, version: expectedVersion },
      { $set: { compatibility, pricing } },
      { new: true },
    );
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * After an atomic update returns null, determine whether the build was
   * not found or whether the version did not match (conflict).
   */
  private async resolveConflict(
    publicId: string,
    expectedVersion: number,
  ): Promise<MutateBuildResult> {
    const current = await BuildModel.findOne({ publicId });
    if (!current) return { kind: 'not_found' };
    if (current.version !== expectedVersion) {
      return { kind: 'version_conflict', current };
    }
    // Version matched but the filter still didn't match — this can happen
    // for removeItem when the slot is already empty. Return the build
    // without treating it as a conflict.
    return { kind: 'updated', build: current };
  }
}
