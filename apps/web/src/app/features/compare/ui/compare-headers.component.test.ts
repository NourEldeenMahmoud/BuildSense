import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { CompareHeadersComponent } from './compare-headers.component';
import type { ProductDetailViewModel } from '../../product/data-access/product-detail.store';

function makeVm(overrides: Partial<ProductDetailViewModel> = {}): ProductDetailViewModel {
  return {
    id: '64a000000000000000000001',
    title: 'Intel Core i7-13700K',
    category: 'CPU',
    brand: 'Intel',
    model: 'Core i7-13700K',
    mpn: 'BX8071513700K',
    images: ['https://img.example.com/1.jpg'],
    primaryImageUrl: 'https://img.example.com/1.jpg',
    rawSpecifications: [],
    currentOffer: {
      id: 'offer-1',
      storeCode: 'SIGMA',
      price: 25000,
      currency: 'EGP',
      availability: 'IN_STOCK',
      sourceUrl: 'https://sigma.store/product/1',
    },
    availabilityText: 'In stock',
    sourceUrl: null,
    allOffers: [],
    hasMultipleOffers: false,
    ...overrides,
  };
}

describe('CompareHeadersComponent', () => {
  function create(vmLeft: ProductDetailViewModel | null, vmRight: ProductDetailViewModel | null, loading = false): ComponentFixture<CompareHeadersComponent> {
    TestBed.configureTestingModule({
      imports: [CompareHeadersComponent],
    });

    const fixture = TestBed.createComponent(CompareHeadersComponent);
    fixture.componentInstance.leftVm = vmLeft;
    fixture.componentInstance.rightVm = vmRight;
    fixture.componentInstance.loading = loading;
    fixture.detectChanges();
    return fixture;
  }

  it('renders both product titles when both VMs are provided', () => {
    const right = makeVm({
      id: '64a000000000000000000002',
      title: 'AMD Ryzen 9 7950X',
      mpn: '100-100000593WOF',
      primaryImageUrl: 'https://img.example.com/2.jpg',
    });

    const fixture = create(makeVm(), right);
    const el: HTMLElement = fixture.nativeElement;

    const titles = el.querySelectorAll('.header-title');
    expect(titles.length).toBe(2);
    expect(titles[0]!.textContent).toContain('Intel Core i7-13700K');
    expect(titles[1]!.textContent).toContain('AMD Ryzen 9 7950X');
  });

  it('renders brand badges and MPN labels', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const el: HTMLElement = fixture.nativeElement;

    const badges = el.querySelectorAll('.header-category-badge');
    expect(badges.length).toBe(2);
    expect(badges[0]!.textContent).toBe('Intel');
    expect(badges[1]!.textContent).toBe('Intel');

    const mpns = el.querySelectorAll('.header-mpn');
    expect(mpns.length).toBe(2);
    expect(mpns[0]!.textContent).toContain('BX8071513700K');
  });

  it('renders price formatted with currency', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const el: HTMLElement = fixture.nativeElement;

    const amounts = el.querySelectorAll('.header-price-amount');
    expect(amounts.length).toBe(2);
    expect(amounts[0]!.textContent).toContain('25,000');

    const currencies = el.querySelectorAll('.header-price-currency');
    expect(currencies.length).toBe(2);
    expect(currencies[0]!.textContent).toBe('EGP');
  });

  it('renders "View on Sigma" link with correct href', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const el: HTMLElement = fixture.nativeElement;

    const links = el.querySelectorAll<HTMLAnchorElement>('.header-source-link');
    expect(links.length).toBe(2);
    expect(links[0]!.href).toContain('https://sigma.store/product/1');
    expect(links[0]!.target).toBe('_blank');
    expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders em dash for null price', () => {
    const vmNoPrice = makeVm({
      id: '64a000000000000000000002',
      title: 'B',
      currentOffer: { id: 'offer-2', storeCode: 'SIGMA', price: null, currency: 'EGP', availability: 'IN_STOCK', sourceUrl: null },
    });
    const fixture = create(makeVm(), vmNoPrice);
    const el: HTMLElement = fixture.nativeElement;

    const unknowns = el.querySelectorAll('.header-price-unknown');
    expect(unknowns.length).toBe(1);
    expect(unknowns[0]!.textContent).toContain('\u2014');
  });

  it('renders "No pricing information available" when currentOffer is null', () => {
    const vmNoOffer = makeVm({
      id: '64a000000000000000000002',
      title: 'B',
      currentOffer: null,
    });
    const fixture = create(makeVm(), vmNoOffer);
    const el: HTMLElement = fixture.nativeElement;

    const noOffer = el.querySelectorAll('.header-no-offer');
    expect(noOffer.length).toBe(1);
    expect(noOffer[0]!.textContent).toContain('No pricing information available');
  });

  it('shows fallback image when primaryImageUrl is null', () => {
    const vmNoImg = makeVm({
      id: '64a000000000000000000002',
      title: 'B',
      primaryImageUrl: null,
    });
    const fixture = create(makeVm(), vmNoImg);
    const el: HTMLElement = fixture.nativeElement;

    const fallbacks = el.querySelectorAll('.header-img-fallback');
    expect(fallbacks.length).toBe(1);
  });

  it('shows skeleton when loading and VM is null', () => {
    const fixture = create(null, null, true);
    const el: HTMLElement = fixture.nativeElement;

    const skeletons = el.querySelectorAll('.header-skeleton');
    expect(skeletons.length).toBe(2);
    expect(skeletons[0]!.getAttribute('aria-label')).toBe('Loading left product');
    expect(skeletons[1]!.getAttribute('aria-label')).toBe('Loading right product');
  });

  it('Change button emits onChangeClick with correct side', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const comp = fixture.componentInstance;

    const changeSpy = vi.fn();
    comp.onChangeClick.subscribe(changeSpy);

    const leftBtn = fixture.nativeElement.querySelector('.header-change-btn') as HTMLButtonElement;
    leftBtn.click();

    expect(changeSpy).toHaveBeenCalledWith('left');
  });

  it('Add to Build emits the selected side', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const addSpy = vi.fn();
    fixture.componentInstance.onAddToBuild.subscribe(addSpy);

    const leftButton = fixture.nativeElement.querySelector('.header-add-btn') as HTMLButtonElement;
    leftButton.click();

    expect(addSpy).toHaveBeenCalledWith('left');
  });

  it('right Change button emits onChangeClick with "right"', () => {
    const fixture = create(makeVm(), makeVm({
      id: '64a000000000000000000002',
      title: 'B',
    }));
    const comp = fixture.componentInstance;

    const changeSpy = vi.fn();
    comp.onChangeClick.subscribe(changeSpy);

    const buttons = fixture.nativeElement.querySelectorAll('.header-change-btn');
    buttons[1]!.click();

    expect(changeSpy).toHaveBeenCalledWith('right');
  });

  it('getAvailabilityLabel maps known statuses correctly', () => {
    const fixture = create(makeVm(), makeVm({ id: '64a000000000000000000002', title: 'B' }));
    const comp = fixture.componentInstance;

    expect(comp.getAvailabilityLabel('IN_STOCK')).toBe('In stock');
    expect(comp.getAvailabilityLabel('OUT_OF_STOCK')).toBe('Out of stock');
    expect(comp.getAvailabilityLabel('PREORDER')).toBe('Pre-order');
    expect(comp.getAvailabilityLabel('')).toBe('Availability unknown');
    expect(comp.getAvailabilityLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});
