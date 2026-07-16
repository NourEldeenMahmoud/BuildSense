import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectInMemoryDatabase, disconnectInMemoryDatabase, clearDatabase } from '../test-utils.js';
import { BuildRepository } from './build-repository.js';
import type { ReplaceItemInput } from './build-repository.js';

describe('BuildRepository', () => {
  let repository: BuildRepository;

  beforeAll(async () => {
    await connectInMemoryDatabase();
    repository = new BuildRepository();
  });

  afterAll(async () => {
    await disconnectInMemoryDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('creates a build with a valid UUID v4 publicId', async () => {
      const build = await repository.create({ name: 'Test Build' });

      expect(build.publicId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(build.name).toBe('Test Build');
      expect(build.version).toBe(1);
      expect(build.items).toEqual([]);
      expect(build.compatibility.overallStatus).toBe('UNKNOWN');
      expect(build.pricing.totalPrice).toBeNull();
      expect(build.pricing.itemCount).toBe(0);
    });

    it('generates unique publicIds across multiple builds', async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const build = await repository.create({ name: `Build ${i}` });
        ids.add(build.publicId);
      }
      expect(ids.size).toBe(20);
    });

    it('initializes compatibility with UNKNOWN status for all 7 slots', async () => {
      const build = await repository.create({ name: 'Slots Check' });

      expect(build.compatibility.slots).toHaveLength(7);
      const slotNames = build.compatibility.slots.map((s) => s.slot);
      expect(slotNames).toEqual([
        'cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case',
      ]);
      for (const slot of build.compatibility.slots) {
        expect(slot.status).toBe('UNKNOWN');
        expect(slot.triggeredRuleIds).toEqual([]);
        expect(slot.topReasons).toEqual([]);
      }
    });

    it('enforces unique publicId constraint', async () => {
      const first = await repository.create({ name: 'First' });
      // Directly insert a duplicate publicId to test the constraint.
      const { BuildModel } = await import('../models/build.js');
      await expect(
        BuildModel.create({
          publicId: first.publicId,
          name: 'Duplicate',
          version: 1,
          items: [],
          compatibility: { overallStatus: 'UNKNOWN', slots: [] },
          pricing: { totalPrice: null, itemCount: 0 },
        }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // findByPublicId
  // -------------------------------------------------------------------------

  describe('findByPublicId', () => {
    it('finds an existing build', async () => {
      const created = await repository.create({ name: 'Find Me' });
      const found = await repository.findByPublicId(created.publicId);

      expect(found).toBeDefined();
      expect(found?.publicId).toBe(created.publicId);
      expect(found?.name).toBe('Find Me');
    });

    it('returns null for non-existent publicId', async () => {
      const found = await repository.findByPublicId('non-existent-id');
      expect(found).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // updateName
  // -------------------------------------------------------------------------

  describe('updateName', () => {
    it('updates name and increments version', async () => {
      const build = await repository.create({ name: 'Old Name' });
      const result = await repository.updateName(build.publicId, 1, 'New Name');

      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.name).toBe('New Name');
      expect(result.build.version).toBe(2);
    });

    it('returns not_found for non-existent build', async () => {
      const result = await repository.updateName('no-such-id', 1, 'X');
      expect(result.kind).toBe('not_found');
    });

    it('returns version_conflict when version does not match', async () => {
      const build = await repository.create({ name: 'Original' });
      const result = await repository.updateName(build.publicId, 999, 'Conflict');

      expect(result.kind).toBe('version_conflict');
      if (result.kind !== 'version_conflict') return;
      expect(result.current.version).toBe(1);
      expect(result.current.name).toBe('Original');
    });

    it('rejects update after an intervening mutation', async () => {
      const build = await repository.create({ name: 'V1' });
      await repository.updateName(build.publicId, 1, 'V2');
      const result = await repository.updateName(build.publicId, 1, 'V3');

      expect(result.kind).toBe('version_conflict');
      if (result.kind !== 'version_conflict') return;
      expect(result.current.version).toBe(2);
      expect(result.current.name).toBe('V2');
    });
  });

  // -------------------------------------------------------------------------
  // replaceItem
  // -------------------------------------------------------------------------

  describe('replaceItem', () => {
    const cpuItem: ReplaceItemInput = {
      productId: 'prod-cpu-1',
      slot: 'cpu',
      quantity: 1,
      productName: 'Ryzen 7 7800X3D',
      thumbnailUrl: 'https://example.com/cpu.jpg',
      sourceUrl: 'https://sigma.com/cpu',
      storeCode: 'SIGMA',
      unitPrice: 12000,
      totalPrice: 12000,
      availability: 'IN_STOCK',
      lastSeenAt: new Date(),
    };

    const gpuItem: ReplaceItemInput = {
      productId: 'prod-gpu-1',
      slot: 'gpu',
      quantity: 1,
      productName: 'RTX 4070',
      thumbnailUrl: null,
      sourceUrl: 'https://sigma.com/gpu',
      storeCode: 'SIGMA',
      unitPrice: 25000,
      totalPrice: 25000,
      availability: 'IN_STOCK',
      lastSeenAt: null,
    };

    it('inserts a new item into an empty slot', async () => {
      const build = await repository.create({ name: 'Add CPU' });
      const result = await repository.replaceItem(build.publicId, 1, cpuItem);

      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.items).toHaveLength(1);
      expect(result.build.items[0]?.slot).toBe('cpu');
      expect(result.build.items[0]?.productId).toBe('prod-cpu-1');
      expect(result.build.items[0]?.quantity).toBe(1);
      expect(result.build.version).toBe(2);
    });

    it('replaces an existing item in the same slot', async () => {
      const build = await repository.create({ name: 'Replace CPU' });
      await repository.replaceItem(build.publicId, 1, cpuItem);

      const newCpu = { ...cpuItem, productId: 'prod-cpu-2', productName: 'Ryzen 9 7950X' };
      const result = await repository.replaceItem(build.publicId, 2, newCpu);

      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.items).toHaveLength(1);
      expect(result.build.items[0]?.productId).toBe('prod-cpu-2');
      expect(result.build.items[0]?.productName).toBe('Ryzen 9 7950X');
      expect(result.build.version).toBe(3);
    });

    it('adds items to multiple slots independently', async () => {
      const build = await repository.create({ name: 'Multi Slot' });
      await repository.replaceItem(build.publicId, 1, cpuItem);
      const r2 = await repository.replaceItem(build.publicId, 2, gpuItem);

      expect(r2.kind).toBe('updated');
      if (r2.kind !== 'updated') return;
      expect(r2.build.items).toHaveLength(2);
      const slots = r2.build.items.map((i) => i.slot).sort();
      expect(slots).toEqual(['cpu', 'gpu']);
    });

    it('returns not_found for non-existent build', async () => {
      const result = await repository.replaceItem('no-such', 1, cpuItem);
      expect(result.kind).toBe('not_found');
    });

    it('returns version_conflict when version does not match', async () => {
      const build = await repository.create({ name: 'Conflict' });
      const result = await repository.replaceItem(build.publicId, 999, cpuItem);

      expect(result.kind).toBe('version_conflict');
      if (result.kind !== 'version_conflict') return;
      expect(result.current.version).toBe(1);
      expect(result.current.items).toHaveLength(0);
    });

    it('rejects item replace after an intervening mutation', async () => {
      const build = await repository.create({ name: 'Race' });
      await repository.replaceItem(build.publicId, 1, cpuItem);
      // Simulate another client updating the name.
      await repository.updateName(build.publicId, 2, 'Other Client');

      const result = await repository.replaceItem(build.publicId, 2, gpuItem);
      expect(result.kind).toBe('version_conflict');
      if (result.kind !== 'version_conflict') return;
      expect(result.current.version).toBe(3);
    });

    it('preserves other slots when replacing one slot', async () => {
      const build = await repository.create({ name: 'Preserve' });
      await repository.replaceItem(build.publicId, 1, cpuItem);
      await repository.replaceItem(build.publicId, 2, gpuItem);

      // Replace CPU again — GPU should be untouched.
      const newCpu = { ...cpuItem, productId: 'prod-cpu-3' };
      const result = await repository.replaceItem(build.publicId, 3, newCpu);

      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.items).toHaveLength(2);
      const gpuStillThere = result.build.items.find((i) => i.slot === 'gpu');
      expect(gpuStillThere?.productId).toBe('prod-gpu-1');
    });
  });

  // -------------------------------------------------------------------------
  // removeItem
  // -------------------------------------------------------------------------

  describe('removeItem', () => {
    it('removes an existing item from a slot', async () => {
      const build = await repository.create({ name: 'Remove' });
      await repository.replaceItem(build.publicId, 1, {
        productId: 'p1',
        slot: 'cpu',
        quantity: 1,
        productName: 'CPU',
        thumbnailUrl: null,
        sourceUrl: 'url',
        storeCode: 'SIGMA',
        unitPrice: null,
        totalPrice: null,
        availability: null,
        lastSeenAt: null,
      });

      const result = await repository.removeItem(build.publicId, 2, 'cpu');
      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.items).toHaveLength(0);
      expect(result.build.version).toBe(3);
    });

    it('returns not_found for non-existent build', async () => {
      const result = await repository.removeItem('no-such', 1, 'cpu');
      expect(result.kind).toBe('not_found');
    });

    it('returns version_conflict when version does not match', async () => {
      const build = await repository.create({ name: 'Conflict' });
      const result = await repository.removeItem(build.publicId, 999, 'cpu');
      expect(result.kind).toBe('version_conflict');
    });

    it('handles removing from an empty slot gracefully', async () => {
      const build = await repository.create({ name: 'Empty Slot' });
      const result = await repository.removeItem(build.publicId, 1, 'cpu');

      // Slot was empty — no change needed, version stays at 1.
      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.version).toBe(1);
      expect(result.build.items).toHaveLength(0);
    });

    it('only removes the targeted slot', async () => {
      const build = await repository.create({ name: 'Selective' });
      await repository.replaceItem(build.publicId, 1, {
        productId: 'p1', slot: 'cpu', quantity: 1, productName: 'CPU',
        thumbnailUrl: null, sourceUrl: 'u', storeCode: 'SIGMA',
        unitPrice: null, totalPrice: null, availability: null, lastSeenAt: null,
      });
      await repository.replaceItem(build.publicId, 2, {
        productId: 'p2', slot: 'gpu', quantity: 1, productName: 'GPU',
        thumbnailUrl: null, sourceUrl: 'u', storeCode: 'SIGMA',
        unitPrice: null, totalPrice: null, availability: null, lastSeenAt: null,
      });

      const result = await repository.removeItem(build.publicId, 3, 'cpu');
      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.items).toHaveLength(1);
      expect(result.build.items[0]?.slot).toBe('gpu');
    });
  });

  // -------------------------------------------------------------------------
  // updateSnapshots
  // -------------------------------------------------------------------------

  describe('updateSnapshots', () => {
    it('updates compatibility and pricing snapshots', async () => {
      const build = await repository.create({ name: 'Snapshots' });
      const compatibility = {
        overallStatus: 'COMPATIBLE' as const,
        slots: [
          { slot: 'cpu' as const, status: 'COMPATIBLE' as const, triggeredRuleIds: ['r1'], topReasons: [] },
        ],
      };
      const pricing = { totalPrice: 37000, itemCount: 2 };

      const updated = await repository.updateSnapshots(
        build.publicId,
        build.version,
        compatibility,
        pricing,
      );

      expect(updated).toBeDefined();
      expect(updated?.compatibility.overallStatus).toBe('COMPATIBLE');
      expect(updated?.pricing.totalPrice).toBe(37000);
      expect(updated?.pricing.itemCount).toBe(2);
    });

    it('returns null for non-existent build', async () => {
      const result = await repository.updateSnapshots(
        'no-such',
        1,
        { overallStatus: 'UNKNOWN', slots: [] },
        { totalPrice: null, itemCount: 0 },
      );
      expect(result).toBeNull();
    });

    it('refuses to write snapshots when version has moved on (concurrency guard)', async () => {
      const build = await repository.create({ name: 'Race' });

      // Simulate: item mutation incremented version to 2.
      await repository.updateName(build.publicId, 1, 'Step 1');

      // Now try to update snapshots with the OLD version (1).
      // This should fail because the current version is 2.
      const staleCompatibility = {
        overallStatus: 'COMPATIBLE' as const,
        slots: [
          { slot: 'cpu' as const, status: 'COMPATIBLE' as const, triggeredRuleIds: ['r1'], topReasons: [] },
        ],
      };

      const result = await repository.updateSnapshots(
        build.publicId,
        1, // stale version
        staleCompatibility,
        { totalPrice: 999, itemCount: 1 },
      );

      expect(result).toBeNull();

      // Verify the build was NOT corrupted — snapshots should still be defaults.
      const fresh = await repository.findByPublicId(build.publicId);
      expect(fresh).toBeDefined();
      expect(fresh?.compatibility.overallStatus).toBe('UNKNOWN');
      expect(fresh?.pricing.totalPrice).toBeNull();
    });

    it('succeeds when version matches (no concurrent mutation)', async () => {
      const build = await repository.create({ name: 'No Race' });

      // Simulate: item mutation incremented version to 2.
      await repository.updateName(build.publicId, 1, 'Step 1');

      // Now update snapshots with the CURRENT version (2).
      const result = await repository.updateSnapshots(
        build.publicId,
        2, // correct version
        { overallStatus: 'COMPATIBLE', slots: [{ slot: 'cpu', status: 'COMPATIBLE', triggeredRuleIds: [], topReasons: [] }] },
        { totalPrice: 5000, itemCount: 1 },
      );

      expect(result).toBeDefined();
      expect(result?.compatibility.overallStatus).toBe('COMPATIBLE');
      expect(result?.pricing.totalPrice).toBe(5000);
    });

    it('persists topReasons through snapshot round-trip', async () => {
      const build = await repository.create({ name: 'TopReasons' });
      const compatibility = {
        overallStatus: 'WARNING' as const,
        slots: [
          {
            slot: 'cpu' as const,
            status: 'WARNING' as const,
            triggeredRuleIds: ['CMP-CPU-MB-001'],
            topReasons: ['Socket mismatch: AM4 vs AM5', 'BIOS update may be required'],
          },
          {
            slot: 'gpu' as const,
            status: 'COMPATIBLE' as const,
            triggeredRuleIds: [],
            topReasons: [],
          },
        ],
      };

      const updated = await repository.updateSnapshots(
        build.publicId,
        build.version,
        compatibility,
        { totalPrice: null, itemCount: 0 },
      );

      expect(updated).toBeDefined();
      const cpuSlot = updated?.compatibility.slots.find((s) => s.slot === 'cpu');
      expect(cpuSlot?.topReasons).toEqual(['Socket mismatch: AM4 vs AM5', 'BIOS update may be required']);
      const gpuSlot = updated?.compatibility.slots.find((s) => s.slot === 'gpu');
      expect(gpuSlot?.topReasons).toEqual([]);
    });

    it('legacy documents without topReasons read as empty array', async () => {
      // Simulate a legacy document that has slots without topReasons.
      // Mongoose schema defaults fill in the missing field.
      const build = await repository.create({ name: 'Legacy' });
      const { BuildModel } = await import('../models/build.js');

      // Directly update with a slot that lacks topReasons (simulating pre-Phase-0 data).
      await BuildModel.findOneAndUpdate(
        { publicId: build.publicId },
        {
          $set: {
            'compatibility.slots': [
              { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [] },
            ],
          },
        },
      );

      const found = await repository.findByPublicId(build.publicId);
      expect(found).toBeDefined();
      expect(found?.compatibility.slots).toHaveLength(1);
      expect(found?.compatibility.slots[0]?.topReasons).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Timestamps
  // -------------------------------------------------------------------------

  describe('timestamps', () => {
    it('sets createdAt and updatedAt on creation', async () => {
      const build = await repository.create({ name: 'Timestamps' });
      expect(build.createdAt).toBeInstanceOf(Date);
      expect(build.updatedAt).toBeInstanceOf(Date);
    });

    it('updates updatedAt on mutation', async () => {
      const build = await repository.create({ name: 'Timestamps' });
      const before = build.updatedAt.getTime();

      // Small delay to ensure timestamp differs.
      await new Promise((r) => setTimeout(r, 50));

      const result = await repository.updateName(build.publicId, 1, 'Updated');
      expect(result.kind).toBe('updated');
      if (result.kind !== 'updated') return;
      expect(result.build.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  // -------------------------------------------------------------------------
  // No expiry/TTL
  // -------------------------------------------------------------------------

  describe('no expiry index', () => {
    it('does not have a TTL index on expiresAt', async () => {
      const build = await repository.create({ name: 'No TTL' });
      const indexes = await build.collection.indexes();
      const ttlIndex = indexes.find(
        (idx) => 'expireAfterSeconds' in idx && idx.expireAfterSeconds !== undefined,
      );
      expect(ttlIndex).toBeUndefined();
    });
  });
});
