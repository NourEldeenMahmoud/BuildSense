import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PurchasePlanPage } from './purchase-plan.page';

describe('PurchasePlanPage', () => {
  let fixture: ComponentFixture<PurchasePlanPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchasePlanPage, RouterTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PurchasePlanPage);
    fixture.detectChanges();
  });

  it('renders the page heading "Purchase Plan"', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('Purchase Plan');
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

  it('lists deferred capabilities in the disclaimer', () => {
    const listItems = fixture.nativeElement.querySelectorAll('.disclaimer-list li');
    const texts = Array.from(listItems).map((li) => (li as HTMLElement).textContent?.trim());
    expect(texts).toContain('Component summary and row listing');
    expect(texts).toContain('Price estimation and totals');
    expect(texts).toContain('Availability and retailer links');
    expect(texts).toContain('Compatibility status and recommendations');
    expect(texts).toContain('Print and export controls');
  });

  it('does not contain fixture product names or pricing values', () => {
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('EGP');
    expect(html).not.toContain('Ryzen');
    expect(html).not.toContain('Intel');
    expect(html).not.toContain('GeForce');
  });

  it('does not contain active compatibility claims or results', () => {
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('is compatible');
    expect(html).not.toContain('are compatible');
    expect(html).not.toContain('compatibility check');
    expect(html).not.toContain('Compatible with');
  });

  it('does not contain active export, print, or checkout action buttons', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const hasExportButton = buttons.some((b) => b.textContent?.toLowerCase().includes('export'));
    const hasPrintButton = buttons.some((b) => b.textContent?.toLowerCase().includes('print'));
    const hasCheckoutButton = buttons.some((b) => b.textContent?.toLowerCase().includes('checkout'));
    expect(hasExportButton).toBe(false);
    expect(hasPrintButton).toBe(false);
    expect(hasCheckoutButton).toBe(false);
  });

  it('does not reference localStorage or saved builds', () => {
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('saved build');
  });

  it('no-build state section has appropriate aria-label', () => {
    const section = fixture.nativeElement.querySelector('.no-build-state');
    expect(section?.getAttribute('aria-label')).toBe('No build available');
  });
});
