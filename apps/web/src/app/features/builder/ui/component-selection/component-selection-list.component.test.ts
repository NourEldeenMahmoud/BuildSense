import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentSelectionListComponent } from './component-selection-list.component';
import type { ComponentSelectionViewModel } from './component-selection-view.models';
import type { CandidateCompatibilityGroup } from '@buildsense/contracts';

function makeSelection(overrides: Partial<ComponentSelectionViewModel> = {}): ComponentSelectionViewModel {
  return {
    slotDisplayName: 'CPU',
    candidates: [
      {
        id: 'test-001',
        name: 'Test CPU Alpha',
        brand: 'TestBrand',
        priceLabel: '—',
        availabilityLabel: 'Unavailable',
      },
      {
        id: 'test-002',
        name: 'Test CPU Beta',
        brand: 'OtherBrand',
        priceLabel: '—',
        availabilityLabel: 'Unavailable',
      },
    ],
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
            priceLabel: '—',
            availabilityLabel: 'Unavailable',
          },
          {
            id: 'test-002',
            name: 'Test CPU Beta',
            brand: 'OtherBrand',
            priceLabel: '—',
            availabilityLabel: 'Unavailable',
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

  it('displays candidate count', () => {
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

  it('renders candidate brands', () => {
    fixture.detectChanges();
    const brands = fixture.nativeElement.querySelectorAll('.product-brand');
    expect(brands[0]?.textContent?.trim()).toBe('TestBrand');
    expect(brands[1]?.textContent?.trim()).toBe('OtherBrand');
  });

  it('renders candidate prices', () => {
    fixture.detectChanges();
    const prices = fixture.nativeElement.querySelectorAll('.product-price');
    expect(prices[0]?.textContent?.trim()).toBe('—');
    expect(prices[1]?.textContent?.trim()).toBe('—');
  });

  it('renders candidate availability', () => {
    fixture.detectChanges();
    const avail = fixture.nativeElement.querySelectorAll('.product-availability');
    expect(avail[0]?.textContent?.trim()).toBe('Unavailable');
    expect(avail[1]?.textContent?.trim()).toBe('Unavailable');
  });

  it('search input is disabled', () => {
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="search"]');
    expect(input?.disabled).toBe(true);
    expect(input?.getAttribute('aria-disabled')).toBe('true');
  });

  it('has a search hint indicating search is not active', () => {
    fixture.detectChanges();
    const hint = fixture.nativeElement.querySelector('.search-hint');
    expect(hint?.textContent?.trim()).toContain('not yet active');
  });

  it('filter chips are present with "All" as active', () => {
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.filter-chip');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips[0]?.textContent?.trim()).toBe('All');
    expect(chips[0]?.getAttribute('aria-selected')).toBe('true');
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

  it('renders group header with status badge', () => {
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.status-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('Unknown Compatibility');
    expect(badge.getAttribute('data-status')).toBe('UNKNOWN');
    expect(badge.getAttribute('aria-label')).toBe('Unknown Compatibility');
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

  // --- Close button ---

  it('renders close button with appropriate aria-label', () => {
    fixture.detectChanges();
    const closeBtn = fixture.nativeElement.querySelector('.drawer-close-btn');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.getAttribute('aria-label')).toBe('Close selection');
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
              priceLabel: '—',
              availabilityLabel: 'Unavailable',
            },
          ],
        },
      ],
      candidates: [
        {
          id: 'warn-001',
          name: 'Warning CPU',
          brand: 'WarnBrand',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
      ],
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
              priceLabel: '—',
              availabilityLabel: 'Unavailable',
            },
          ],
        },
      ],
      candidates: [
        {
          id: 'warn-001',
          name: 'Warning CPU',
          brand: 'WarnBrand',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
      ],
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
              priceLabel: '—',
              availabilityLabel: 'Unavailable',
            },
          ],
        },
      ],
      candidates: [
        {
          id: 'warn-001',
          name: 'Warning CPU',
          brand: 'WarnBrand',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
      ],
    });
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.product-row');
    expect(rows).toHaveLength(1);
    const name = fixture.nativeElement.querySelector('.product-name');
    expect(name?.textContent?.trim()).toBe('Warning CPU');
  });

  it('UNKNOWN and COMPATIBLE_WITH_WARNINGS render distinct badges', () => {
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
              priceLabel: '—',
              availabilityLabel: 'Unavailable',
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
              priceLabel: '—',
              availabilityLabel: 'Unavailable',
            },
          ],
        },
      ],
      candidates: [
        {
          id: 'unk-001',
          name: 'Unknown CPU',
          brand: 'UnkBrand',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
        {
          id: 'warn-001',
          name: 'Warning CPU',
          brand: 'WarnBrand',
          priceLabel: '—',
          availabilityLabel: 'Unavailable',
        },
      ],
    });
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]?.getAttribute('data-status')).toBe('UNKNOWN');
    expect(badges[0]?.textContent?.trim()).toBe('Unknown Compatibility');
    expect(badges[1]?.getAttribute('data-status')).toBe('COMPATIBLE_WITH_WARNINGS');
    expect(badges[1]?.textContent?.trim()).toBe('Compatible with Warnings');
  });
});
