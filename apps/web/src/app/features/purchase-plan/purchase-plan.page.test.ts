import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchasePlanPage } from './purchase-plan.page';
import { BuildService } from '../builder/data-access/build.service';
import { API_BASE_URL } from '../../core/api.config';
import type { BuildDto, PurchasePlanDto } from '@buildsense/contracts';

// Mock storage module (needed by BuildService dependency chain)
vi.mock('../../core/storage', () => ({
  getLatestBuildId: vi.fn().mockReturnValue(null),
  setLatestBuildId: vi.fn(),
  clearLatestBuildId: vi.fn(),
}));

const PURCHASE_PLAN: PurchasePlanDto = {
  buildPublicId: 'b001',
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
    {
      productId: 'prod-ram-1',
      productName: 'DDR5 16GB',
      slot: 'ram',
      quantity: 2,
      unitPrice: 5000,
      totalPrice: 10000,
      sourceUrl: 'https://sigma.com/item/ram-1',
      storeCode: 'SIGMA',
      availability: 'IN_STOCK',
      lastSeenAt: '2025-01-15T10:00:00.000Z',
    },
  ],
  totalPrice: 25000,
  itemCount: 2,
};

const BUILD: BuildDto = {
  publicId: 'b001',
  name: 'Test Build',
  version: 3,
  items: PURCHASE_PLAN.items.map((item) => ({
    productId: item.productId,
    slot: item.slot,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    productName: item.productName,
    thumbnailUrl: `https://img.example.com/${item.productId}.jpg`,
    sourceUrl: item.sourceUrl,
    storeCode: item.storeCode,
  })),
  compatibility: {
    overallStatus: 'WARNING',
    slots: [
      { slot: 'cpu', status: 'COMPATIBLE', triggeredRuleIds: [], topReasons: [], missingFactKeys: [] },
      { slot: 'ram', status: 'WARNING', triggeredRuleIds: ['ram-speed'], topReasons: ['Check supported memory speed'], missingFactKeys: [] },
    ],
  },
  pricing: { totalPrice: 25000, itemCount: 2 },
  createdAt: '2025-01-15T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
};

describe('PurchasePlanPage', () => {
  let fixture: ComponentFixture<PurchasePlanPage>;
  let queryParamSubject: Subject<unknown>;
  let mockBuildService: {
    getPurchasePlan: ReturnType<typeof vi.fn>;
    getBuild: ReturnType<typeof vi.fn>;
  };

  /**
   * Configure the test module and create the component.
   *
   * @param options.buildId - If provided, emitted via queryParamMap after module config.
   * @param options.getPlanResult - Observable returned by BuildService.getPurchasePlan.
   * @param options.emitInitial - Whether to immediately emit the buildId (for tests that
   *   need the component to transition state during the first change detection).
   */
  function configureTestingModule(options: {
    buildId: string | null;
    getPlanResult?: unknown;
    emitInitial?: boolean;
  }): void {
    queryParamSubject = new Subject();
    mockBuildService = {
      getPurchasePlan: vi.fn().mockReturnValue(
        options.getPlanResult ?? { subscribe: (): void => {} },
      ),
      getBuild: vi.fn().mockReturnValue(of(BUILD)),
    };

    TestBed.configureTestingModule({
      imports: [PurchasePlanPage, RouterTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://test-api' },
        { provide: BuildService, useValue: mockBuildService },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamSubject.asObservable(),
            snapshot: {
              queryParamMap: convertToParamMap(
                options.buildId ? { buildId: options.buildId } : {},
              ),
            },
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PurchasePlanPage);

    // Emit before first detectChanges so the subscription in ngOnInit
    // picks up the value during the same change detection cycle.
    if (options.emitInitial && options.buildId) {
      queryParamSubject.next(convertToParamMap({ buildId: options.buildId }));
    }

    fixture.detectChanges();
  }

  // --- Empty state (no buildId) ---

  describe('empty state (no buildId)', () => {
    beforeEach(() => {
      configureTestingModule({ buildId: null });
    });

    it('renders the page heading "Build Review"', () => {
      const heading = fixture.nativeElement.querySelector('h1');
      expect(heading?.textContent?.trim()).toBe('Build Review');
    });

    it('has a region landmark with labelledby', () => {
      const section = fixture.nativeElement.querySelector('section[role="region"]');
      expect(section?.getAttribute('aria-labelledby')).toBe('purchase-plan-heading');
    });

    it('displays "No build configured" heading', () => {
      const heading = fixture.nativeElement.querySelector('.no-build-heading');
      expect(heading?.textContent?.trim()).toBe('No build configured');
    });

    it('explains that no build exists yet', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('not have a PC build configured yet');
    });

    it('provides a link to the Builder', () => {
      const links = Array.from(
        fixture.nativeElement.querySelectorAll('a'),
      ) as HTMLAnchorElement[];
      const builderLink = links.find((a) => a.textContent?.includes('Go to Builder'));
      expect(builderLink).toBeTruthy();
      expect(builderLink!.getAttribute('href')).toBe('/builder');
    });

    it('provides a link to the Catalog', () => {
      const links = Array.from(
        fixture.nativeElement.querySelectorAll('a'),
      ) as HTMLAnchorElement[];
      const catalogLink = links.find((a) => a.textContent?.includes('Browse Catalog'));
      expect(catalogLink).toBeTruthy();
      expect(catalogLink!.getAttribute('href')).toBe('/');
    });

    it('does not contain fixture product names or pricing values', () => {
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('EGP');
      expect(html).not.toContain('Ryzen');
    });

    it('no-build state section has appropriate aria-label', () => {
      const section = fixture.nativeElement.querySelector('.no-build-state');
      expect(section?.getAttribute('aria-label')).toBe('No build available');
    });
  });

  // --- Loaded state ---

  describe('loaded state', () => {
    beforeEach(() => {
      configureTestingModule({
        buildId: null,
        getPlanResult: new Subject(), // placeholder, replaced below
      });

      // Replace with actual mock and re-setup
      mockBuildService.getPurchasePlan = vi.fn();
      (mockBuildService.getPurchasePlan as ReturnType<typeof vi.fn>).mockReturnValue(
        new Subject(), // we'll use this to emit synchronously
      );

      // Create a fresh fixture with proper setup
      TestBed.resetTestingModule();
      configureTestingModule({ buildId: null, emitInitial: false });

      // Now manually drive the flow
      const planSubject = new Subject<PurchasePlanDto>();
      mockBuildService.getPurchasePlan = vi.fn().mockReturnValue(planSubject);
      mockBuildService.getBuild = vi.fn().mockReturnValue(of(BUILD));
      // Re-create fixture after setting the mock
      TestBed.resetTestingModule();

      TestBed.configureTestingModule({
        imports: [PurchasePlanPage, RouterTestingModule],
        providers: [
          { provide: API_BASE_URL, useValue: 'http://test-api' },
          { provide: BuildService, useValue: mockBuildService },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: queryParamSubject.asObservable(),
              snapshot: {
                queryParamMap: convertToParamMap({}),
              },
            },
          },
        ],
      });

      fixture = TestBed.createComponent(PurchasePlanPage);
      fixture.detectChanges(); // subscribes to queryParamMap

      // Emit buildId — component transitions to 'loading'
      queryParamSubject.next(convertToParamMap({ buildId: 'b001' }));
      fixture.detectChanges(); // renders loading state

      // Now emit the plan — component transitions to 'loaded'
      planSubject.next(PURCHASE_PLAN);
      planSubject.complete();
      fixture.detectChanges(); // renders loaded state
    });

    it('fetches the purchase plan when buildId is present', () => {
      expect(mockBuildService.getPurchasePlan).toHaveBeenCalledWith('b001');
    });

    it('renders component count', () => {
      const statValues = fixture.nativeElement.querySelectorAll('.stat-value');
      expect(statValues[0]?.textContent?.trim()).toBe('2 / 8');
    });

    it('renders total price', () => {
      const total = fixture.nativeElement.querySelector('.total-value');
      expect(total?.textContent?.trim()).toContain('25,000');
      expect(total?.textContent?.trim()).toContain('EGP');
    });

    it('renders stacked component cards', () => {
      const rows = fixture.nativeElement.querySelectorAll('.review-row');
      expect(rows).toHaveLength(2);
    });

    it('renders slot display names', () => {
      const slots = fixture.nativeElement.querySelectorAll('.slot-name');
      expect(slots[0]?.textContent?.trim()).toBe('CPU');
      expect(slots[1]?.textContent?.trim()).toBe('RAM');
    });

    it('renders product names', () => {
      const products = fixture.nativeElement.querySelectorAll('.product-name');
      expect(products[0]?.textContent?.trim()).toBe('AMD Ryzen 5 7600');
      expect(products[1]?.textContent?.trim()).toBe('DDR5 16GB');
    });

    it('renders prices with EGP', () => {
      const prices = fixture.nativeElement.querySelectorAll('.price-value');
      expect(prices[0]?.textContent?.trim()).toContain('15,000');
      expect(prices[1]?.textContent?.trim()).toContain('10,000');
    });

    it('renders source links with safe attributes', () => {
      const links = fixture.nativeElement.querySelectorAll('.store-link');
      expect(links).toHaveLength(2);
      for (const link of links) {
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      }
    });

    it('source links have correct href', () => {
      const links = fixture.nativeElement.querySelectorAll('.store-link');
      expect(links[0].getAttribute('href')).toBe('https://sigma.com/item/cpu-1');
      expect(links[1].getAttribute('href')).toBe('https://sigma.com/item/ram-1');
    });

    it('renders Edit Build link', () => {
      const links = Array.from(
        fixture.nativeElement.querySelectorAll('a'),
      ) as HTMLAnchorElement[];
      const backLink = links.find((a) => a.textContent?.includes('Edit Build'));
      expect(backLink).toBeTruthy();
      expect(backLink!.getAttribute('href')).toBe('/builder/b001');
    });
  });

  // --- Error state ---

  describe('error state', () => {
    beforeEach(() => {
      const errorSubject = new Subject();
      mockBuildService = {
        getPurchasePlan: vi.fn().mockReturnValue(errorSubject),
        getBuild: vi.fn().mockReturnValue(of(BUILD)),
      };

      queryParamSubject = new Subject();

      TestBed.configureTestingModule({
        imports: [PurchasePlanPage, RouterTestingModule],
        providers: [
          { provide: API_BASE_URL, useValue: 'http://test-api' },
          { provide: BuildService, useValue: mockBuildService },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: queryParamSubject.asObservable(),
              snapshot: { queryParamMap: convertToParamMap({}) },
            },
          },
        ],
      });

      fixture = TestBed.createComponent(PurchasePlanPage);
      fixture.detectChanges(); // ngOnInit subscribes

      queryParamSubject.next(convertToParamMap({ buildId: 'err-id' }));
      fixture.detectChanges(); // loading state

      // Emit error — the component reads err?.error?.error for the message
      errorSubject.error({ error: { error: 'Server error' } });
      fixture.detectChanges(); // error state
    });

    it('displays error heading', () => {
      const heading = fixture.nativeElement.querySelector('.error-heading');
      expect(heading?.textContent?.trim()).toBe('Error Loading Purchase Plan');
    });

    it('displays error message', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Server error');
    });

    it('has a retry button', () => {
      const btn = fixture.nativeElement.querySelector('.error-actions .btn-primary');
      expect(btn?.textContent?.trim()).toBe('Retry');
    });
  });

  // --- 404 state ---

  describe('404 state', () => {
    beforeEach(() => {
      const errorSubject = new Subject();
      mockBuildService = {
        getPurchasePlan: vi.fn().mockReturnValue(errorSubject),
        getBuild: vi.fn().mockReturnValue(of(BUILD)),
      };

      queryParamSubject = new Subject();

      TestBed.configureTestingModule({
        imports: [PurchasePlanPage, RouterTestingModule],
        providers: [
          { provide: API_BASE_URL, useValue: 'http://test-api' },
          { provide: BuildService, useValue: mockBuildService },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: queryParamSubject.asObservable(),
              snapshot: { queryParamMap: convertToParamMap({}) },
            },
          },
        ],
      });

      fixture = TestBed.createComponent(PurchasePlanPage);
      fixture.detectChanges(); // ngOnInit subscribes

      queryParamSubject.next(convertToParamMap({ buildId: 'missing' }));
      fixture.detectChanges(); // loading state

      // Emit 404 error
      errorSubject.error({ status: 404, error: { error: 'Not found' } });
      fixture.detectChanges(); // not-found state
    });

    it('displays not found heading', () => {
      const heading = fixture.nativeElement.querySelector('.error-heading');
      expect(heading?.textContent?.trim()).toBe('Build Not Found');
    });

    it('displays not found message', () => {
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Build not found');
    });
  });
});
