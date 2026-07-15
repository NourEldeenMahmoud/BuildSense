import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildStore } from './build.store';
import { BuildService } from './build.service';
import type { BuildDto, CandidatesApiResponse, PurchasePlanDto } from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Mock storage module
// ---------------------------------------------------------------------------

const mockGetLatestBuildId = vi.fn((): string | null => null);
const mockSetLatestBuildId = vi.fn((_id: string): void => {});
const mockClearLatestBuildId = vi.fn((): void => {});

vi.mock('../../../core/storage', () => ({
  getLatestBuildId: (): string | null => mockGetLatestBuildId(),
  setLatestBuildId: (id: string): void => mockSetLatestBuildId(id),
  clearLatestBuildId: (): void => mockClearLatestBuildId(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EMPTY_BUILD: BuildDto = {
  publicId: 'b0000000-0000-0000-0000-000000000001',
  name: 'Untitled Build',
  version: 1,
  items: [],
  compatibility: {
    overallStatus: 'UNKNOWN',
    slots: [],
  },
  pricing: { totalPrice: null, itemCount: 0 },
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

const BUILD_WITH_CPU: BuildDto = {
  ...EMPTY_BUILD,
  publicId: 'b0000000-0000-0000-0000-000000000002',
  version: 2,
  items: [
    {
      productId: 'prod-cpu-1',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 15000,
      totalPrice: 15000,
      productName: 'AMD Ryzen 5 7600',
      thumbnailUrl: null,
      sourceUrl: 'https://sigma.com/item/cpu-1',
      storeCode: 'SIGMA',
    },
  ],
  pricing: { totalPrice: 15000, itemCount: 1 },
  compatibility: {
    overallStatus: 'UNKNOWN',
    slots: [
      { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [] },
    ],
  },
};

const CANDIDATES_RESPONSE: CandidatesApiResponse = {
  groups: [
    {
      status: 'UNKNOWN',
      products: [
        {
          productId: 'prod-1',
          name: 'Test CPU',
          thumbnailUrl: null,
          price: 15000,
          sourceUrl: 'https://sigma.com/item/1',
          storeCode: 'SIGMA',
        },
        {
          productId: 'prod-2',
          name: 'Another CPU',
          thumbnailUrl: null,
          price: 20000,
          sourceUrl: 'https://sigma.com/item/2',
          storeCode: 'SIGMA',
        },
      ],
      topReasons: [],
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
};

const PURCHASE_PLAN: PurchasePlanDto = {
  buildPublicId: 'b0000000-0000-0000-0000-000000000001',
  items: [
    {
      productId: 'prod-cpu-1',
      productName: 'AMD Ryzen 5 7600',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 15000,
      totalPrice: 15000,
      sourceUrl: 'https://sigma.com/item/cpu-1',
      storeCode: 'SIGMA',
      availability: 'IN_STOCK',
      lastSeenAt: '2025-01-15T10:00:00.000Z',
    },
  ],
  totalPrice: 15000,
  itemCount: 1,
};

const BUILD_AFTER_PUT: BuildDto = {
  ...EMPTY_BUILD,
  version: 3,
  items: [
    {
      productId: 'prod-1',
      slot: 'cpu',
      quantity: 1,
      unitPrice: 15000,
      totalPrice: 15000,
      productName: 'Test CPU',
      thumbnailUrl: null,
      sourceUrl: 'https://sigma.com/item/1',
      storeCode: 'SIGMA',
    },
  ],
  pricing: { totalPrice: 15000, itemCount: 1 },
  compatibility: {
    overallStatus: 'UNKNOWN',
    slots: [{ slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [] }],
  },
};

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BuildStore', () => {
  let store: BuildStore;
  let mockService: {
    createBuild: ReturnType<typeof vi.fn>;
    getBuild: ReturnType<typeof vi.fn>;
    putItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
    getCandidates: ReturnType<typeof vi.fn>;
    getPurchasePlan: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let paramMapSubject: Subject<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    paramMapSubject = new Subject();
    mockService = {
      createBuild: vi.fn().mockReturnValue(of(EMPTY_BUILD)),
      getBuild: vi.fn().mockReturnValue(of(EMPTY_BUILD)),
      putItem: vi.fn().mockReturnValue(of(BUILD_AFTER_PUT)),
      deleteItem: vi.fn().mockReturnValue(of(EMPTY_BUILD)),
      getCandidates: vi.fn().mockReturnValue(of(CANDIDATES_RESPONSE)),
      getPurchasePlan: vi.fn().mockReturnValue(of(PURCHASE_PLAN)),
    };
    mockRouter = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
    };

    mockGetLatestBuildId.mockReturnValue(null);

    TestBed.configureTestingModule({
      providers: [
        BuildStore,
        { provide: BuildService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
          },
        },
      ],
    });

    store = TestBed.inject(BuildStore);
  });

  // ---------------------------------------------------------------------------
  // Route loading
  // ---------------------------------------------------------------------------

  it('starts in idle state', () => {
    expect(store.status()).toBe('idle');
    expect(store.build()).toBeNull();
    expect(store.loaded()).toBe(false);
  });

  it('loads build on valid route param', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    expect(mockService.getBuild).toHaveBeenCalledWith('b001');
    expect(store.loaded()).toBe(true);
    expect(store.build()?.publicId).toBe(EMPTY_BUILD.publicId);
    expect(mockSetLatestBuildId).toHaveBeenCalledWith(EMPTY_BUILD.publicId);
  });

  it('shows not-found for 404 error', async () => {
    mockService.getBuild.mockReturnValue(
      throwError(() => ({ status: 404, error: { error: 'Not found' } })),
    );
    paramMapSubject.next(new Map([['publicId', 'missing']]));
    await flushPromises();

    expect(store.notFound()).toBe(true);
    expect(store.errorMessage()).toBe('Build not found.');
    expect(mockClearLatestBuildId).toHaveBeenCalled();
  });

  it('shows api-error for 500 error', async () => {
    mockService.getBuild.mockReturnValue(
      throwError(() => ({ status: 500, error: { error: 'Server error' } })),
    );
    paramMapSubject.next(new Map([['publicId', 'err-id']]));
    await flushPromises();

    expect(store.apiError()).toBe(true);
    expect(store.errorMessage()).toBe('Server error');
  });

  it('retry re-fetches the current build', async () => {
    mockService.getBuild
      .mockReturnValueOnce(throwError(() => ({ status: 500, error: { error: 'fail' } })))
      .mockReturnValueOnce(of(EMPTY_BUILD));

    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();
    expect(store.apiError()).toBe(true);

    store.retry();
    await flushPromises();
    expect(store.loaded()).toBe(true);
    expect(mockService.getBuild).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // Recovery / creation (no route param)
  // ---------------------------------------------------------------------------

  it('/builder with saved ID loads that build and navigates', async () => {
    mockGetLatestBuildId.mockReturnValue('saved-123');
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));

    paramMapSubject.next(new Map()); // no publicId param
    await flushPromises();

    expect(mockService.getBuild).toHaveBeenCalledWith('saved-123');
    expect(store.loaded()).toBe(true);
    expect(store.build()?.publicId).toBe(BUILD_WITH_CPU.publicId);
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/builder', BUILD_WITH_CPU.publicId],
      { replaceUrl: true },
    );
    expect(mockSetLatestBuildId).toHaveBeenCalledWith(BUILD_WITH_CPU.publicId);
  });

  it('/builder with saved ID returning 404 clears ID and creates new build', async () => {
    mockGetLatestBuildId.mockReturnValue('stale-id');
    mockService.getBuild.mockReturnValue(
      throwError(() => ({ status: 404, error: { error: 'Not found' } })),
    );
    mockService.createBuild.mockReturnValue(of(EMPTY_BUILD));

    paramMapSubject.next(new Map()); // no publicId param
    await flushPromises();

    expect(mockClearLatestBuildId).toHaveBeenCalled();
    expect(mockService.createBuild).toHaveBeenCalled();
    expect(store.loaded()).toBe(true);
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/builder', EMPTY_BUILD.publicId],
      { replaceUrl: true },
    );
    expect(mockSetLatestBuildId).toHaveBeenCalledWith(EMPTY_BUILD.publicId);
  });

  it('/builder with no saved ID creates new build', async () => {
    mockGetLatestBuildId.mockReturnValue(null);
    mockService.createBuild.mockReturnValue(of(EMPTY_BUILD));

    paramMapSubject.next(new Map()); // no publicId param
    await flushPromises();

    expect(mockService.createBuild).toHaveBeenCalled();
    expect(store.loaded()).toBe(true);
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['/builder', EMPTY_BUILD.publicId],
      { replaceUrl: true },
    );
  });

  it('/builder create failure shows api-error', async () => {
    mockGetLatestBuildId.mockReturnValue(null);
    mockService.createBuild.mockReturnValue(
      throwError(() => ({ error: { error: 'Create failed' } })),
    );

    paramMapSubject.next(new Map());
    await flushPromises();

    expect(store.apiError()).toBe(true);
    expect(store.errorMessage()).toBe('Create failed');
  });

  // ---------------------------------------------------------------------------
  // View model derivation
  // ---------------------------------------------------------------------------

  it('slots are null when no build is loaded', () => {
    expect(store.slots()).toBeNull();
  });

  it('summary is null when no build is loaded', () => {
    expect(store.summary()).toBeNull();
  });

  it('slots derive from loaded build with correct count', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    const slots = store.slots();
    expect(slots).toHaveLength(7);
    expect(slots![0]!.key).toBe('cpu');
    expect(slots![0]!.selectedProduct).toBeNull(); // empty build
    expect(slots![6]!.key).toBe('case');
  });

  it('slots populate selectedProduct for filled slots', async () => {
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();

    const slots = store.slots()!;
    expect(slots[0]!.selectedProduct).not.toBeNull();
    expect(slots[0]!.selectedProduct!.name).toBe('AMD Ryzen 5 7600');
    expect(slots[0]!.selectedProduct!.priceLabel).toContain('15,000');
    expect(slots[0]!.selectedProduct!.availabilityLabel).toBe('SIGMA');
  });

  it('summary derives correct filledCount and pricing', async () => {
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();

    const summary = store.summary()!;
    expect(summary.slotCount).toBe(7);
    expect(summary.filledCount).toBe(1);
    expect(summary.totalEstimateLabel).toContain('15,000');
    expect(summary.compatibilityStatusLabel).toBe('Unknown');
  });

  // ---------------------------------------------------------------------------
  // handleConflict
  // ---------------------------------------------------------------------------

  it('handleConflict replaces state with latestBuild and shows conflict notice', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();
    expect(store.loaded()).toBe(true);
    expect(store.version()).toBe(1);

    const replacement: BuildDto = { ...BUILD_WITH_CPU, version: 5 };
    const result = store.handleConflict(replacement);

    expect(result).toBe(true);
    expect(store.build()?.publicId).toBe(BUILD_WITH_CPU.publicId);
    expect(store.version()).toBe(5);
    expect(store.conflictMessage()).toContain('modified by another request');
    expect(mockSetLatestBuildId).toHaveBeenCalledWith(BUILD_WITH_CPU.publicId);
  });

  it('handleConflict returns false when latestBuild is null', () => {
    const result = store.handleConflict(null);
    expect(result).toBe(false);
  });

  it('clearConflictNotice removes the conflict message', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.handleConflict(BUILD_WITH_CPU);
    expect(store.conflictMessage()).not.toBeNull();

    store.clearConflictNotice();
    expect(store.conflictMessage()).toBeNull();
  });

  it('conflict message is cleared on route change', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.handleConflict(BUILD_WITH_CPU);
    expect(store.conflictMessage()).not.toBeNull();

    mockService.getBuild.mockReturnValue(of(EMPTY_BUILD));
    paramMapSubject.next(new Map([['publicId', 'b003']]));
    await flushPromises();

    expect(store.conflictMessage()).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // publicId / version computed
  // ---------------------------------------------------------------------------

  it('publicId is null when no build loaded', () => {
    expect(store.publicId()).toBeNull();
  });

  it('version is 0 when no build loaded', () => {
    expect(store.version()).toBe(0);
  });

  it('publicId and version update after load', async () => {
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();
    expect(store.publicId()).toBe(BUILD_WITH_CPU.publicId);
    expect(store.version()).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Route change
  // ---------------------------------------------------------------------------

  it('clears previous build when route changes to new ID', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();
    expect(store.loaded()).toBe(true);

    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();

    expect(store.build()?.publicId).toBe(BUILD_WITH_CPU.publicId);
    expect(store.version()).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Candidate selection
  // ---------------------------------------------------------------------------

  it('selectionDrawerOpen is false initially', () => {
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(store.selectedSlot()).toBeNull();
  });

  it('selectSlot opens the drawer and loads candidates', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushPromises();

    expect(store.selectionDrawerOpen()).toBe(true);
    expect(store.selectedSlot()).toBe('cpu');
    expect(store.candidateGroups()).toHaveLength(1);
    expect(store.candidateGroups()[0]!.products).toHaveLength(2);
    expect(store.candidatePagination()!.totalItems).toBe(2);
    expect(mockService.getCandidates).toHaveBeenCalledWith('b0000000-0000-0000-0000-000000000001', 'cpu');
  });

  it('selectSlot sets loading state', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    // Make getCandidates return a never-resolving observable to test loading
    mockService.getCandidates.mockReturnValue(new Subject());
    store.selectSlot('ram');
    // Check loading before flush
    expect(store.candidatesLoading()).toBe(true);
    expect(store.selectedSlot()).toBe('ram');
  });

  it('selectSlot handles error', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    mockService.getCandidates.mockReturnValue(
      throwError(() => ({ error: { error: 'Candidates failed' } })),
    );
    store.selectSlot('cpu');
    await flushPromises();

    expect(store.candidatesError()).toBe('Candidates failed');
    expect(store.candidatesLoading()).toBe(false);
    // Drawer stays open so user can see the error
    expect(store.selectionDrawerOpen()).toBe(true);
  });

  it('selectSlot is no-op when no build is loaded', () => {
    store.selectSlot('cpu');
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(mockService.getCandidates).not.toHaveBeenCalled();
  });

  it('closeSelectionDrawer clears drawer state', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(true);

    store.closeSelectionDrawer();
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(store.selectedSlot()).toBeNull();
    expect(store.candidateGroups()).toHaveLength(0);
  });

  it('route change closes selection drawer', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(true);

    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // putItem
  // ---------------------------------------------------------------------------

  it('putItem sends correct request and updates build', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();
    expect(store.version()).toBe(1);

    store.putItem('cpu', 'prod-1', 1);
    await flushPromises();

    expect(mockService.putItem).toHaveBeenCalledWith(
      'b0000000-0000-0000-0000-000000000001',
      'cpu',
      { productId: 'prod-1', quantity: 1, expectedVersion: 1 },
    );
    expect(store.version()).toBe(3);
    expect(store.loaded()).toBe(true);
  });

  it('putItem closes drawer on success', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(true);

    store.putItem('cpu', 'prod-1', 1);
    await flushPromises();

    expect(store.selectionDrawerOpen()).toBe(false);
  });

  it('putItem clears conflict message on success', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.handleConflict(BUILD_WITH_CPU);
    expect(store.conflictMessage()).not.toBeNull();

    store.putItem('cpu', 'prod-1', 1);
    await flushPromises();

    expect(store.conflictMessage()).toBeNull();
  });

  it('putItem handles 409 conflict', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    const latestBuild: BuildDto = { ...BUILD_WITH_CPU, version: 5 };
    mockService.putItem.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          error: 'Build version conflict',
          code: 'BUILD_VERSION_CONFLICT',
          details: {
            expectedVersion: 1,
            currentVersion: 3,
            latestBuild,
          },
        },
      })),
    );

    store.putItem('cpu', 'prod-1', 1);
    await flushPromises();

    expect(store.conflictMessage()).toContain('modified by another request');
    expect(store.version()).toBe(5);
  });

  it('putItem is no-op when no build loaded', () => {
    store.putItem('cpu', 'prod-1', 1);
    expect(mockService.putItem).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // deleteItem
  // ---------------------------------------------------------------------------

  it('deleteItem sends correct request and updates build', async () => {
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();
    expect(store.version()).toBe(2);

    store.deleteItem('cpu');
    await flushPromises();

    expect(mockService.deleteItem).toHaveBeenCalledWith(
      'b0000000-0000-0000-0000-000000000002',
      'cpu',
      { expectedVersion: 2 },
    );
    expect(store.loaded()).toBe(true);
  });

  it('deleteItem handles 409 conflict', async () => {
    mockService.getBuild.mockReturnValue(of(BUILD_WITH_CPU));
    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();

    const latestBuild: BuildDto = { ...BUILD_WITH_CPU, version: 6 };
    mockService.deleteItem.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: {
          error: 'Build version conflict',
          code: 'BUILD_VERSION_CONFLICT',
          details: {
            expectedVersion: 2,
            currentVersion: 4,
            latestBuild,
          },
        },
      })),
    );

    store.deleteItem('cpu');
    await flushPromises();

    expect(store.conflictMessage()).toContain('modified by another request');
    expect(store.version()).toBe(6);
  });

  it('deleteItem is no-op when no build loaded', () => {
    store.deleteItem('cpu');
    expect(mockService.deleteItem).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Purchase plan
  // ---------------------------------------------------------------------------

  it('purchasePlan is null initially', () => {
    expect(store.purchasePlan()).toBeNull();
    expect(store.purchasePlanLoading()).toBe(false);
  });

  it('loadPurchasePlan fetches the plan', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.loadPurchasePlan();
    await flushPromises();

    expect(mockService.getPurchasePlan).toHaveBeenCalledWith(
      'b0000000-0000-0000-0000-000000000001',
    );
    expect(store.purchasePlan()).not.toBeNull();
    expect(store.purchasePlan()!.items).toHaveLength(1);
    expect(store.purchasePlan()!.totalPrice).toBe(15000);
  });

  it('loadPurchasePlan handles error', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    mockService.getPurchasePlan.mockReturnValue(
      throwError(() => ({ error: { error: 'Plan failed' } })),
    );
    store.loadPurchasePlan();
    await flushPromises();

    expect(store.purchasePlanError()).toBe('Plan failed');
    expect(store.purchasePlan()).toBeNull();
  });

  it('loadPurchasePlan is no-op when no build loaded', () => {
    store.loadPurchasePlan();
    expect(mockService.getPurchasePlan).not.toHaveBeenCalled();
  });

  it('loadPurchasePlan sets loading state', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    mockService.getPurchasePlan.mockReturnValue(new Subject());
    store.loadPurchasePlan();
    expect(store.purchasePlanLoading()).toBe(true);
  });
});
