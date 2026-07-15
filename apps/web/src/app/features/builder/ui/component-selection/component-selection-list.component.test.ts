import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentSelectionListComponent } from './component-selection-list.component';
import type { ComponentSelectionViewModel } from './component-selection-view.models';

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

  it('does not contain active selection behavior', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Add to');
    expect(html).not.toContain('Select this');
    expect(html).not.toContain('(click)');
  });

  it('does not contain compatibility claims', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Compatible');
    expect(html).not.toContain('Incompatible');
    expect(html).not.toContain('best');
    expect(html).not.toContain('Recommended');
  });
});
