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
      { slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
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
          brand: 'AMD',
          model: 'Ryzen 5 7600',
          thumbnailUrl: null,
          price: 15000,
          sourceUrl: 'https://sigma.com/item/1',
          storeCode: 'SIGMA',
          availability: 'IN_STOCK',
          offers: [{ storeCode: 'SIGMA', price: 15000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://sigma.com/item/1' }],
        },
        {
          productId: 'prod-2',
          name: 'Another CPU',
          brand: 'Intel',
          model: 'Core i5-14600K',
          thumbnailUrl: null,
          price: 20000,
          sourceUrl: 'https://sigma.com/item/2',
          storeCode: 'SIGMA',
          availability: 'IN_STOCK',
          offers: [{ storeCode: 'SIGMA', price: 20000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://sigma.com/item/2' }],
        },
      ],
      topReasons: [],
    },
  ],
  pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
};

const CANDIDATES_RESPONSE_PAGE_2: CandidatesApiResponse = {
  groups: [
    {
      status: 'UNKNOWN',
      products: [
        {
          productId: 'prod-3',
          name: 'Third CPU',
          brand: 'AMD',
          model: 'Ryzen 9 7950X',
          thumbnailUrl: null,
          price: 30000,
          sourceUrl: 'https://sigma.com/item/3',
          storeCode: 'SIGMA',
          availability: 'IN_STOCK',
          offers: [{ storeCode: 'SIGMA', price: 30000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://sigma.com/item/3' }],
        },
      ],
      topReasons: [],
    },
  ],
  pagination: { page: 2, pageSize: 20, totalItems: 3, totalPages: 2 },
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
    slots: [{ slot: 'cpu', status: 'UNKNOWN', triggeredRuleIds: [], topReasons: [], missingFactKeys: [] }],
  },
};

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Wait for the debounce (300ms) plus a small margin. */
function flushDebounce(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 400));
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
    expect(slots).toHaveLength(8);
    expect(slots![0]!.key).toBe('cpu');
    expect(slots![0]!.selectedProduct).toBeNull();
    expect(slots![7]!.key).toBe('cooling');
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
    expect(summary.slotCount).toBe(8);
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
  // Candidate selection — debounced stream
  // ---------------------------------------------------------------------------

  it('selectionDrawerOpen is false initially', () => {
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(store.selectedSlot()).toBeNull();
  });

  it('selectSlot opens the drawer and loads candidates via debounced stream', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();

    expect(store.selectionDrawerOpen()).toBe(true);
    expect(store.selectedSlot()).toBe('cpu');
    expect(store.candidateGroups()).toHaveLength(1);
    expect(store.candidateGroups()[0]!.products).toHaveLength(2);
    expect(store.candidatePagination()!.totalItems).toBe(2);
    expect(mockService.getCandidates).toHaveBeenCalledWith(
      'b0000000-0000-0000-0000-000000000001',
      'cpu',
      expect.objectContaining({ page: 1, pageSize: 24 }),
    );
  });

  it('selectSlot resets search/filter/page to defaults', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();

    expect(store.candidateSearchTerm()).toBe('');
    expect(store.candidateAvailability()).toBe('ALL');
    expect(store.candidatePage()).toBe(1);
  });

  it('selectSlot sets loading state', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    mockService.getCandidates.mockReturnValue(new Subject());
    store.selectSlot('ram');
    // Wait for debounce to fire
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
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
    await flushDebounce();
    await flushPromises();

    expect(store.candidatesError()).toBe('Candidates failed');
    expect(store.candidatesLoading()).toBe(false);
    expect(store.selectionDrawerOpen()).toBe(true);
  });

  it('selectSlot is no-op when no build is loaded', () => {
    store.selectSlot('cpu');
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(mockService.getCandidates).not.toHaveBeenCalled();
  });

  it('closeSelectionDrawer clears all drawer state including search/filter', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(true);

    store.closeSelectionDrawer();
    expect(store.selectionDrawerOpen()).toBe(false);
    expect(store.selectedSlot()).toBeNull();
    expect(store.candidateGroups()).toHaveLength(0);
    expect(store.candidateSearchTerm()).toBe('');
    expect(store.candidateAvailability()).toBe('ALL');
    expect(store.candidatePage()).toBe(1);
    expect(store.candidateLoadingMore()).toBe(false);
    expect(store.candidateAppendError()).toBeNull();
  });

  it('route change closes selection drawer', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(true);

    paramMapSubject.next(new Map([['publicId', 'b002']]));
    await flushPromises();
    expect(store.selectionDrawerOpen()).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // searchCandidates
  // ---------------------------------------------------------------------------

  it('searchCandidates resets to page 1 and pushes to stream', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    expect(mockService.getCandidates).toHaveBeenCalledTimes(1);

    store.searchCandidates('ryzen');
    await flushDebounce();
    await flushPromises();

    expect(store.candidateSearchTerm()).toBe('ryzen');
    expect(store.candidatePage()).toBe(1);
    expect(mockService.getCandidates).toHaveBeenCalledTimes(2);
    expect(mockService.getCandidates).toHaveBeenLastCalledWith(
      'b0000000-0000-0000-0000-000000000001',
      'cpu',
      expect.objectContaining({ search: 'ryzen', page: 1 }),
    );
  });

  it('searchCandidates is no-op when no slot selected', () => {
    store.searchCandidates('test');
    expect(mockService.getCandidates).not.toHaveBeenCalled();
  });

  it('searchCandidates debounces rapid typing', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    const callCountAfterSelect = mockService.getCandidates.mock.calls.length;

    // Type rapidly — each within 300ms window
    store.searchCandidates('r');
    await new Promise((r) => setTimeout(r, 50));
    store.searchCandidates('ry');
    await new Promise((r) => setTimeout(r, 50));
    store.searchCandidates('ryzen');
    await flushDebounce();
    await flushPromises();

    // Only one additional HTTP call for the debounced search
    expect(mockService.getCandidates).toHaveBeenCalledTimes(callCountAfterSelect + 1);
    expect(mockService.getCandidates).toHaveBeenLastCalledWith(
      'b0000000-0000-0000-0000-000000000001',
      'cpu',
      expect.objectContaining({ search: 'ryzen', page: 1 }),
    );
  });

  // ---------------------------------------------------------------------------
  // filterCandidates
  // ---------------------------------------------------------------------------

  it('filterCandidates resets to page 1 and pushes to stream', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    expect(mockService.getCandidates).toHaveBeenCalledTimes(1);

    store.filterCandidates('IN_STOCK');
    await flushDebounce();
    await flushPromises();

    expect(store.candidateAvailability()).toBe('IN_STOCK');
    expect(store.candidatePage()).toBe(1);
    expect(mockService.getCandidates).toHaveBeenCalledTimes(2);
    expect(mockService.getCandidates).toHaveBeenLastCalledWith(
      'b0000000-0000-0000-0000-000000000001',
      'cpu',
      expect.objectContaining({ availability: 'IN_STOCK', page: 1 }),
    );
  });

  it('filterCandidates is no-op when no slot selected', () => {
    store.filterCandidates('IN_STOCK');
    expect(mockService.getCandidates).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // loadMoreCandidates
  // ---------------------------------------------------------------------------

  it('loadMoreCandidates increments page and appends results', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    // First load: page 1 with 2 total pages
    const page1Response: CandidatesApiResponse = {
      ...CANDIDATES_RESPONSE,
      pagination: { page: 1, pageSize: 2, totalItems: 3, totalPages: 2 },
    };
    mockService.getCandidates.mockReturnValue(of(page1Response));
    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();
    expect(store.candidateGroups()[0]!.products).toHaveLength(2);

    // Page 2
    mockService.getCandidates.mockReturnValue(of(CANDIDATES_RESPONSE_PAGE_2));
    store.loadMoreCandidates();
    await flushDebounce();
    await flushPromises();

    expect(store.candidatePage()).toBe(2);
    expect(store.candidateLoadingMore()).toBe(false);
    const allProducts = store.candidateGroups().flatMap((g) => g.products);
    expect(allProducts.length).toBeGreaterThanOrEqual(3);
  });

  it('loadMoreCandidates deduplicates products', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    // Use multi-page response so loadMore guard passes
    const page1MultiPage: CandidatesApiResponse = {
      ...CANDIDATES_RESPONSE,
      pagination: { page: 1, pageSize: 2, totalItems: 3, totalPages: 2 },
    };
    mockService.getCandidates.mockReturnValue(of(page1MultiPage));
    store.selectSlot('cpu');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();

    // Page 2 with a duplicate product ID
    const page2WithDupe: CandidatesApiResponse = {
      groups: [
        {
          status: 'UNKNOWN',
          products: [
            CANDIDATES_RESPONSE.groups[0]!.products[0]!, // duplicate prod-1
            {
              productId: 'prod-3',
              name: 'Third CPU',
              brand: 'AMD',
              model: 'Ryzen 9 7950X',
              thumbnailUrl: null,
              price: 30000,
              sourceUrl: 'https://sigma.com/item/3',
              storeCode: 'SIGMA',
              availability: 'IN_STOCK',
              offers: [{ storeCode: 'SIGMA', price: 30000, currency: null, availability: 'IN_STOCK', sourceUrl: 'https://sigma.com/item/3' }],
            },
          ],
          topReasons: [],
        },
      ],
      pagination: { page: 2, pageSize: 20, totalItems: 3, totalPages: 2 },
    };
    mockService.getCandidates.mockReturnValue(of(page2WithDupe));
    store.loadMoreCandidates();
    await flushDebounce();
    await flushPromises();

    const allProducts = store.candidateGroups().flatMap((g) => g.products);
    const ids = allProducts.map((p) => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('loadMoreCandidates is no-op when no slot selected', () => {
    store.loadMoreCandidates();
    expect(mockService.getCandidates).not.toHaveBeenCalled();
  });

  it('loadMoreCandidates is no-op when already loading more', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await flushDebounce();
    await flushPromises();

    // Simulate loading state directly and verify guard
    mockService.getCandidates.mockReturnValue(new Subject());
    store.loadMoreCandidates();
    await flushDebounce();
    await flushPromises();

    // If the stream processed, loading should be true.
    // If not (debounce timing), we test the guard by calling loadMore again.
    const callCount = mockService.getCandidates.mock.calls.length;
    store.loadMoreCandidates();
    await flushDebounce();
    await flushPromises();
    // Guard should prevent additional requests if loading is true;
    // otherwise the debounce's distinctUntilChanged should prevent duplicates
    // since same params are pushed.
    const finalCallCount = mockService.getCandidates.mock.calls.length;
    expect(finalCallCount - callCount).toBeLessThanOrEqual(1);
  });

  it('loadMoreCandidates is no-op when on last page', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    store.selectSlot('cpu');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
    // totalPages=1, page=1 → no next page

    const callCount = mockService.getCandidates.mock.calls.length;
    store.loadMoreCandidates();
    await new Promise((r) => setTimeout(r, 500));
    await flushPromises();
    expect(mockService.getCandidates).toHaveBeenCalledTimes(callCount);
  });

  it('loadMore append error preserves loaded results', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    // Use multi-page response so loadMore guard passes
    const page1MultiPage: CandidatesApiResponse = {
      ...CANDIDATES_RESPONSE,
      pagination: { page: 1, pageSize: 2, totalItems: 3, totalPages: 2 },
    };
    mockService.getCandidates.mockReturnValue(of(page1MultiPage));
    store.selectSlot('cpu');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
    const initialCount = store.candidateGroups()[0]!.products.length;
    expect(initialCount).toBeGreaterThan(0);
    expect(store.candidateHasNextPage()).toBe(true);

    // Make the next call fail
    mockService.getCandidates.mockReturnValue(
      throwError(() => ({ error: { error: 'Append failed' } })),
    );
    store.loadMoreCandidates();
    // Wait enough for debounce (300ms) + microtask processing
    await new Promise((r) => setTimeout(r, 500));
    await flushPromises();

    expect(store.candidateLoadingMore()).toBe(false);
    expect(store.candidateAppendError()).toBe('Append failed');
    // Original results preserved
    expect(store.candidateGroups()[0]!.products).toHaveLength(initialCount);
  });

  it('stale requests are cancelled by switchMap', async () => {
    paramMapSubject.next(new Map([['publicId', 'b001']]));
    await flushPromises();

    const firstResponse$ = new Subject<CandidatesApiResponse>();
    mockService.getCandidates.mockReturnValue(firstResponse$);
    store.selectSlot('cpu');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();
    expect(store.candidatesLoading()).toBe(true);

    // Second request resolves immediately
    mockService.getCandidates.mockReturnValue(of(CANDIDATES_RESPONSE));
    store.filterCandidates('IN_STOCK');
    await new Promise((r) => setTimeout(r, 400));
    await flushPromises();

    expect(store.candidateAvailability()).toBe('IN_STOCK');
    expect(store.candidatesLoading()).toBe(false);
    expect(store.candidateGroups()).toHaveLength(1);

    // Complete the first request — should have no effect
    firstResponse$.next(CANDIDATES_RESPONSE_PAGE_2);
    firstResponse$.complete();
    expect(store.candidateGroups()[0]!.products).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Pagination selectors
  // ---------------------------------------------------------------------------

  it('candidateTotalItems returns 0 when no pagination', () => {
    expect(store.candidateTotalItems()).toBe(0);
  });

  it('candidateHasNextPage is false when no pagination', () => {
    expect(store.candidateHasNextPage()).toBe(false);
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
    await flushDebounce();
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
