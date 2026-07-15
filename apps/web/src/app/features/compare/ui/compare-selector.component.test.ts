import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { CompareSelectorComponent } from './compare-selector.component';
import { CompareCandidateSearchService } from '../data-access/compare-candidate-search.service';
import { CatalogService } from '../../catalog/data-access/catalog.service';
import type { CatalogProductListItem } from '../../../shared/contracts/catalog';

const MOCK_PRODUCT_2: CatalogProductListItem = {
  id: '64a000000000000000000002',
  title: 'AMD Ryzen 9 7950X',
  category: 'CPU',
  brand: 'AMD',
  model: 'Ryzen 9 7950X',
  mpn: '100-100000593WOF',
  images: [],
  price: 32000,
  currency: 'EGP',
  availability: 'IN_STOCK',
  sourceUrl: null,
  createdAt: '2024-01-01',
};

describe('CompareSelectorComponent', () => {
  let mockGetProducts: ReturnType<typeof vi.fn>;

  function createComponent(isOpen = false): ComponentFixture<CompareSelectorComponent> {
    mockGetProducts = vi.fn().mockReturnValue(
      Promise.resolve({ items: [], pagination: { totalItems: 0, totalPages: 0, page: 1, pageSize: 12 } }),
    );

    TestBed.configureTestingModule({
      imports: [CompareSelectorComponent],
      providers: [
        CompareCandidateSearchService,
        { provide: CatalogService, useValue: { getProducts: mockGetProducts } },
      ],
    });

    const fixture = TestBed.createComponent(CompareSelectorComponent);

    // Set inputs before first detectChanges
    fixture.componentInstance.isOpen = isOpen;
    fixture.componentInstance.category = 'CPU';
    fixture.componentInstance.currentProductId = '64a000000000000000000001';
    fixture.componentInstance.currentProductTitle = 'Intel Core i7';
    fixture.componentInstance.targetSide = 'right';
    fixture.detectChanges();

    return fixture;
  }

  it('does not call search when isOpen is false', () => {
    createComponent(false);
    // Debounced search won't fire for a while, check immediately
    expect(mockGetProducts).not.toHaveBeenCalled();
  });

  it('opens overlay and renders search UI', () => {
    const fixture = createComponent(true);
    const el: HTMLElement = fixture.nativeElement;
    // The overlay should be open
    expect(el.querySelector('.overlay-backdrop')).toBeTruthy();
    expect(el.querySelector('.selector-search-input')).toBeTruthy();
  });

  it('selectProduct emits with correct side and product', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;

    const selectedSpy = vi.fn();
    comp.productSelected.subscribe(selectedSpy);

    comp.selectProduct(MOCK_PRODUCT_2);

    expect(selectedSpy).toHaveBeenCalledWith({
      side: 'right',
      product: MOCK_PRODUCT_2,
    });
  });

  it('emits closed when overlay reports close', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;

    const closedSpy = vi.fn();
    comp.closed.subscribe(closedSpy);

    comp.onOverlayClose(false);

    expect(closedSpy).toHaveBeenCalled();
  });

  it('does not emit closed when overlay stays open', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;

    const closedSpy = vi.fn();
    comp.closed.subscribe(closedSpy);

    comp.onOverlayClose(true);

    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('ngOnDestroy calls candidateService.reset', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;
    const resetSpy = vi.spyOn(comp.candidateService, 'reset');

    comp.ngOnDestroy();

    expect(resetSpy).toHaveBeenCalled();
  });

  it('onSearchInput updates searchQuery signal', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;

    expect(comp.searchQuery()).toBe('');

    comp.onSearchInput('ryzen');
    expect(comp.searchQuery()).toBe('ryzen');
  });

  it('goToPage delegates to candidateService.search with correct page', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;
    const searchSpy = vi.spyOn(comp.candidateService, 'search');

    comp.goToPage(2);

    expect(searchSpy).toHaveBeenCalledWith('CPU', '', 2, 12, '64a000000000000000000001');
  });

  it('retrySearch delegates to candidateService.search with current state', () => {
    const fixture = createComponent(true);
    const comp = fixture.componentInstance;
    const searchSpy = vi.spyOn(comp.candidateService, 'search');

    comp.retrySearch();

    expect(searchSpy).toHaveBeenCalledWith('CPU', '', 1, 12, '64a000000000000000000001');
  });
});
