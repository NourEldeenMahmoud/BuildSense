import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderPage } from './builder.page';

describe('BuilderPage', () => {
  let fixture: ComponentFixture<BuilderPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuilderPage, RouterTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(BuilderPage);
    fixture.detectChanges();
  });

  it('renders the page heading "PC Builder"', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('PC Builder');
  });

  it('has a main landmark with labelledby', () => {
    const main = fixture.nativeElement.querySelector('main');
    expect(main?.getAttribute('role')).toBe('main');
    expect(main?.getAttribute('aria-labelledby')).toBe('builder-heading');
  });

  it('explains that component selection is not yet available', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('not yet available');
  });

  it('shows the workspace with seven slots', () => {
    const items = fixture.nativeElement.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(7);
  });

  it('first slot is CPU, last is Case', () => {
    const labels = fixture.nativeElement.querySelectorAll('.slot-label');
    expect(labels[0]?.textContent?.trim()).toBe('CPU');
    expect(labels[6]?.textContent?.trim()).toBe('Case');
  });

  it('displays the deferred/unavailable explanation', () => {
    const unavailable = fixture.nativeElement.querySelector('.unavailable-card');
    expect(unavailable).toBeTruthy();
    expect(unavailable.textContent).toContain('deferred');
  });

  it('provides a link to Browse Catalog', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a'),
    ) as HTMLAnchorElement[];
    const catalogLink = links.find(
      (a) => a.textContent?.includes('Browse Catalog'),
    );
    expect(catalogLink).toBeTruthy();
    expect(catalogLink!.getAttribute('href')).toBe('/');
  });

  it('disabled buttons are present with reasons', () => {
    const reasons = fixture.nativeElement.querySelectorAll('.action-reason');
    expect(reasons.length).toBeGreaterThanOrEqual(2);
    expect(reasons[0]?.textContent).toContain('Available later');
    expect(reasons[1]?.textContent).toContain('Requires completed');
  });

  it('does not contain fixture product data or compatibility claims', () => {
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Ryzen');
    expect(html).not.toContain('Intel');
    expect(html).not.toContain('Compatible');
    expect(html).not.toContain('Incompatible');
    expect(html).not.toContain('EGP');
    expect(html).not.toContain('Add to');
    expect(html).not.toContain('Select');
  });

  it('does not contain localStorage or persistence references', () => {
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('localStorage');
    expect(html).not.toContain('saved build');
    // A disabled "Save Build" button with a reason is expected — no active save action.
  });

  it('does not contain export or print functionality', () => {
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('export');
    expect(html).not.toContain('print');
  });
});
