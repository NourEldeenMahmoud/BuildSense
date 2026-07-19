import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentSelectionListComponent } from './component-selection-list.component';
import type { ComponentSelectionViewModel } from './component-selection-view.models';
import type { CandidateCompatibilityGroup } from '@buildsense/contracts';

function makeSelection(overrides: Partial<ComponentSelectionViewModel> = {}): ComponentSelectionViewModel {
  return {
    slotDisplayName: 'CPU',
    totalItems: 2,
    page: 1,
    totalPages: 1,
    hasNextPage: false,
    groups: [
      {
        status: 'UNKNOWN' as CandidateCompatibilityGroup,
        statusLabel: 'Unknown Compatibility',
        topReasons: [],
        candidates: [
          {
            id: 'test-001',
            name: 'Test CPU Alpha',
            brand: 'TestBrand',
            model: 'Alpha Model',
            priceLabel: '15,000 EGP',
            availabilityLabel: 'In Stock',
            storeLabel: 'Sigma Computer',
            sourceUrl: 'https://sigma.com/1',
            offers: [
              { storeLabel: 'Sigma Computer', priceLabel: '15,000 EGP', availabilityLabel: 'In Stock', sourceUrl: 'https://sigma.com/1' },
            ],
          },
          {
            id: 'test-002',
            name: 'Test CPU Beta',
            brand: 'OtherBrand',
            model: 'Beta Model',
            priceLabel: '20,000 EGP',
            availabilityLabel: 'Out of Stock',
            storeLabel: 'El Nour Tech',
            sourceUrl: 'https://elnour.com/2',
            offers: [
              { storeLabel: 'El Nour Tech', priceLabel: '20,000 EGP', availabilityLabel: 'Out of Stock', sourceUrl: 'https://elnour.com/2' },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('ComponentSelectionListComponent', () => {
  let fixture: ComponentFixture<ComponentSelectionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentSelectionListComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ComponentSelectionListComponent);
    fixture.componentInstance.selection = makeSelection();
  });

  it('renders the drawer heading with slot display name', () => {
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.drawer-title');
    expect(heading?.textContent?.trim()).toBe('Select CPU');
  });

  it('displays API totalItems as option count', () => {
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('.drawer-count');
    expect(count?.textContent?.trim()).toBe('2 options');
  });

  it('renders all candidate product rows', () => {
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.product-row');
    expect(rows).toHaveLength(2);
  });

  it('renders candidate product names', () => {
    fixture.detectChanges();
    const names = fixture.nativeElement.querySelectorAll('.product-name');
    expect(names[0]?.textContent?.trim()).toBe('Test CPU Alpha');
    expect(names[1]?.textContent?.trim()).toBe('Test CPU Beta');
  });

  it('renders candidate brand and model', () => {
    fixture.detectChanges();
    const brands = fixture.nativeElement.querySelectorAll('.product-brand-model');
    expect(brands[0]?.textContent?.trim()).toBe('TestBrand Alpha Model');
    expect(brands[1]?.textContent?.trim()).toBe('OtherBrand Beta Model');
  });

  it('renders candidate prices as source links', () => {
    fixture.detectChanges();
    const prices = fixture.nativeElement.querySelectorAll('.product-price');
    expect(prices[0]?.textContent?.trim()).toBe('15,000 EGP');
    expect(prices[0]?.getAttribute('href')).toBe('https://sigma.com/1');
    expect(prices[0]?.getAttribute('target')).toBe('_blank');
  });

  it('renders candidate availability', () => {
    fixture.detectChanges();
    const avail = fixture.nativeElement.querySelectorAll('.product-availability');
    expect(avail[0]?.textContent?.trim()).toBe('In Stock');
    expect(avail[1]?.textContent?.trim()).toBe('Out of Stock');
  });

  it('renders store label for each candidate', () => {
    fixture.detectChanges();
    const stores = fixture.nativeElement.querySelectorAll('.product-store');
    expect(stores[0]?.textContent?.trim()).toBe('Sigma Computer');
    expect(stores[1]?.textContent?.trim()).toBe('El Nour Tech');
  });

  it('search input is enabled and emits searchChange on input', () => {
    const spy = vi.fn();
    fixture.componentInstance.searchChange.subscribe(spy);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input[type="search"]');
    expect(input?.disabled).toBe(false);
    expect(input?.getAttribute('aria-disabled')).toBeNull();

    input.value = 'ryzen';
    input.dispatchEvent(new Event('input'));
    expect(spy).toHaveBeenCalledWith('ryzen');
  });

  it('filter chips are clickable buttons with correct aria-pressed', () => {
    const spy = vi.fn();
    fixture.componentInstance.filterChange.subscribe(spy);
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.filter-chip');
    expect(chips.length).toBe(3);
    expect(chips[0]?.tagName).toBe('BUTTON');
    expect(chips[0]?.textContent?.trim()).toBe('All');
    expect(chips[0]?.getAttribute('aria-pressed')).toBe('true');

    chips[1].click();
    expect(spy).toHaveBeenCalledWith('IN_STOCK');

    chips[2].click();
    expect(spy).toHaveBeenCalledWith('OUT_OF_STOCK');
  });

  it('active filter chip reflects currentAvailability input', () => {
    fixture.componentInstance.currentAvailability = 'IN_STOCK';
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.filter-chip');
    expect(chips[0]?.classList.contains('active')).toBe(false);
    expect(chips[0]?.getAttribute('aria-pressed')).toBe('false');
    expect(chips[1]?.classList.contains('active')).toBe(true);
    expect(chips[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(chips[2]?.classList.contains('active')).toBe(false);
    expect(chips[2]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('drawer has appropriate role and aria-label', () => {
    fixture.detectChanges();
    const drawer = fixture.nativeElement.querySelector('.selection-drawer');
    expect(drawer?.getAttribute('role')).toBe('dialog');
    expect(drawer?.getAttribute('aria-label')).toBe('CPU selection');
  });

  it('product list has appropriate role and aria-label', () => {
    fixture.detectChanges();
    const list = fixture.nativeElement.querySelector('.product-list');
    expect(list?.getAttribute('role')).toBe('listbox');
    expect(list?.getAttribute('aria-label')).toBe('CPU candidates');
  });

  it('does not render a status header for unevaluated candidates', () => {
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.product-row')).toHaveLength(2);
  });

  it('does not invent "Recommended" or "Best" claims', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Recommended');
    expect(html).not.toContain('best');
  });

  // --- Interactive behavior ---

  it('emits selectCandidate with product ID when a candidate is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.selectCandidate.subscribe(spy);
    fixture.detectChanges();

    const btns = fixture.nativeElement.querySelectorAll('.product-select-btn');
    btns[0]!.click();

    expect(spy).toHaveBeenCalledWith('test-001');
  });

  it('emits close when close button is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.close.subscribe(spy);
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector('.drawer-close-btn');
    closeBtn!.click();

    expect(spy).toHaveBeenCalled();
  });

  it('renders close button with appropriate aria-label', () => {
    fixture.detectChanges();
    const closeBtn = fixture.nativeElement.querySelector('.drawer-close-btn');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('aria-label')).toBe('Close selection');
  });

  // --- Loading state ---

  it('shows loading spinner when loading is true', () => {
    fixture.componentInstance.loading = true;
    fixture.detectChanges();

    const spinner = fixture.nativeElement.querySelector('.loading-spinner');
    expect(spinner).toBeTruthy();
    const list = fixture.nativeElement.querySelector('.product-list');
    expect(list).toBeNull();
  });

  // --- Error state ---

  it('shows error message when errorMessage is provided', () => {
    fixture.componentInstance.errorMessage = 'Failed to load';
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.drawer-error');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Failed to load');
    const list = fixture.nativeElement.querySelector('.product-list');
    expect(list).toBeNull();
  });

  // --- Load more ---

  it('shows Load more button when hasNextPage is true', () => {
    fixture.componentInstance.selection = makeSelection({ hasNextPage: true, totalPages: 3 });
    fixture.detectChanges();

    const loadMoreBtn = fixture.nativeElement.querySelector('.load-more-btn');
    expect(loadMoreBtn).toBeTruthy();
    expect(loadMoreBtn.textContent?.trim()).toBe('Load more');
  });

  it('does not show Load more button when hasNextPage is false', () => {
    fixture.componentInstance.selection = makeSelection({ hasNextPage: false, totalPages: 1 });
    fixture.detectChanges();

    const loadMoreBtn = fixture.nativeElement.querySelector('.load-more-btn');
    expect(loadMoreBtn).toBeNull();
  });

  it('emits loadMore when Load more button is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.loadMore.subscribe(spy);
    fixture.componentInstance.selection = makeSelection({ hasNextPage: true });
    fixture.detectChanges();

    const loadMoreBtn = fixture.nativeElement.querySelector('.load-more-btn');
    loadMoreBtn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('shows loading state on Load more button when loadingMore is true', () => {
    fixture.componentInstance.loadingMore = true;
    fixture.componentInstance.selection = makeSelection({ hasNextPage: true });
    fixture.detectChanges();

    const loadMoreBtn = fixture.nativeElement.querySelector('.load-more-btn');
    expect(loadMoreBtn?.disabled).toBe(true);
    expect(loadMoreBtn?.textContent).toContain('Loading');
  });

  it('shows append error without clearing existing results', () => {
    fixture.componentInstance.appendError = 'Failed to load next page';
    fixture.detectChanges();

    const appendErrorEl = fixture.nativeElement.querySelector('.drawer-append-error');
    expect(appendErrorEl).toBeTruthy();
    expect(appendErrorEl.textContent).toContain('Failed to load next page');
    // Existing results should still be visible
    const rows = fixture.nativeElement.querySelectorAll('.product-row');
    expect(rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Warning group rendering
// ---------------------------------------------------------------------------

describe('ComponentSelectionListComponent — COMPATIBLE_WITH_WARNINGS', () => {
  let fixture: ComponentFixture<ComponentSelectionListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentSelectionListComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ComponentSelectionListComponent);
  });

  it('renders warning badge with distinct label', () => {
    fixture.componentInstance.selection = makeSelection({
      groups: [
        {
          status: 'COMPATIBLE_WITH_WARNINGS',
          statusLabel: 'Compatible with Warnings',
          topReasons: ['RAM speed may exceed board maximum'],
          candidates: [
            {
              id: 'warn-001',
              name: 'Warning CPU',
              brand: 'WarnBrand',
              model: 'Warn Model',
              priceLabel: '10,000 EGP',
              availabilityLabel: 'In Stock',
              storeLabel: 'Sigma Computer',
              sourceUrl: 'https://sigma.com/warn',
              offers: [
                { storeLabel: 'Sigma Computer', priceLabel: '10,000 EGP', availabilityLabel: 'In Stock', sourceUrl: 'https://sigma.com/warn' },
              ],
            },
          ],
        },
      ],
      totalItems: 1,
    });
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('Compatible with Warnings');
    expect(badge.getAttribute('data-status')).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(badge.getAttribute('aria-label')).toBe('Compatible with Warnings');
  });

  it('renders top reason for warning group', () => {
    fixture.componentInstance.selection = makeSelection({
      groups: [
        {
          status: 'COMPATIBLE_WITH_WARNINGS',
          statusLabel: 'Compatible with Warnings',
          topReasons: ['RAM speed may exceed board maximum'],
          candidates: [
            {
              id: 'warn-001',
              name: 'Warning CPU',
              brand: 'WarnBrand',
              model: 'Warn Model',
              priceLabel: '10,000 EGP',
              availabilityLabel: 'In Stock',
              storeLabel: 'Sigma Computer',
              sourceUrl: 'https://sigma.com/warn',
              offers: [
                { storeLabel: 'Sigma Computer', priceLabel: '10,000 EGP', availabilityLabel: 'In Stock', sourceUrl: 'https://sigma.com/warn' },
              ],
            },
          ],
        },
      ],
      totalItems: 1,
    });
    fixture.detectChanges();

    const reasons = fixture.nativeElement.querySelector('.group-reasons');
    expect(reasons).toBeTruthy();
    expect(reasons.textContent?.trim()).toBe('RAM speed may exceed board maximum');
  });

  it('renders warning candidate product row', () => {
    fixture.componentInstance.selection = makeSelection({
      groups: [
        {
          status: 'COMPATIBLE_WITH_WARNINGS',
          statusLabel: 'Compatible with Warnings',
          topReasons: [],
          candidates: [
            {
              id: 'warn-001',
              name: 'Warning CPU',
              brand: 'WarnBrand',
              model: 'Warn Model',
              priceLabel: '10,000 EGP',
              availabilityLabel: 'In Stock',
              storeLabel: 'Sigma Computer',
              sourceUrl: 'https://sigma.com/warn',
              offers: [
                { storeLabel: 'Sigma Computer', priceLabel: '10,000 EGP', availabilityLabel: 'In Stock', sourceUrl: 'https://sigma.com/warn' },
              ],
            },
          ],
        },
      ],
      totalItems: 1,
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.product-row');
    expect(rows).toHaveLength(1);
    const name = fixture.nativeElement.querySelector('.product-name');
    expect(name?.textContent?.trim()).toBe('Warning CPU');
  });

  it('shows only the evaluated status badge when UNKNOWN and warning groups coexist', () => {
    fixture.componentInstance.selection = makeSelection({
      groups: [
        {
          status: 'UNKNOWN',
          statusLabel: 'Unknown Compatibility',
          topReasons: [],
          candidates: [
            {
              id: 'unk-001',
              name: 'Unknown CPU',
              brand: 'UnkBrand',
              model: 'Unk Model',
              priceLabel: '—',
              availabilityLabel: 'Availability Unknown',
              storeLabel: 'Sigma Computer',
              sourceUrl: 'https://sigma.com/unk',
              offers: [
                { storeLabel: 'Sigma Computer', priceLabel: '—', availabilityLabel: 'Availability Unknown', sourceUrl: 'https://sigma.com/unk' },
              ],
            },
          ],
        },
        {
          status: 'COMPATIBLE_WITH_WARNINGS',
          statusLabel: 'Compatible with Warnings',
          topReasons: [],
          candidates: [
            {
              id: 'warn-001',
              name: 'Warning CPU',
              brand: 'WarnBrand',
              model: 'Warn Model',
              priceLabel: '10,000 EGP',
              availabilityLabel: 'In Stock',
              storeLabel: 'Sigma Computer',
              sourceUrl: 'https://sigma.com/warn',
              offers: [
                { storeLabel: 'Sigma Computer', priceLabel: '10,000 EGP', availabilityLabel: 'In Stock', sourceUrl: 'https://sigma.com/warn' },
              ],
            },
          ],
        },
      ],
      totalItems: 2,
    });
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]?.getAttribute('data-status')).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(badges[0]?.textContent?.trim()).toBe('Compatible with Warnings');
  });
});
