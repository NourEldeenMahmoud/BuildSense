import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BuilderWorkspaceComponent } from './builder-workspace.component';
import {
  createEmptySlotViewModels,
  type BuilderSummaryViewModel,
} from '../builder-view.models';

function makeSummary(): BuilderSummaryViewModel {
  return {
    slotCount: 8,
    filledCount: 0,
    totalEstimateLabel: null,
    compatibilityStatusLabel: null,
  };
}

describe('BuilderWorkspaceComponent', () => {
  let fixture: ComponentFixture<BuilderWorkspaceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuilderWorkspaceComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BuilderWorkspaceComponent);
    fixture.componentInstance.slots = createEmptySlotViewModels();
    fixture.componentInstance.summary = makeSummary();
  });

  it('renders all eight slots', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('[role="listitem"]');
    expect(items).toHaveLength(8);
  });

  it('slots list has role="list" and aria-label', () => {
    fixture.detectChanges();
    const list = fixture.nativeElement.querySelector('[role="list"]');
    expect(list).toBeTruthy();
    expect(list.getAttribute('aria-label')).toBe('Component slots');
  });

  it('renders slots in correct order: CPU first, Cooling last', () => {
    fixture.detectChanges();
    const labels = fixture.nativeElement.querySelectorAll('.slot-label');
    expect(labels[0]?.textContent?.trim()).toBe('CPU');
    expect(labels[7]?.textContent?.trim()).toBe('Cooling');
  });

  it('renders the summary panel', () => {
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.summary-panel');
    expect(panel).toBeTruthy();
  });

  it('workspace has aria-label "PC Builder workspace"', () => {
    fixture.detectChanges();
    const workspace = fixture.nativeElement.querySelector('.builder-workspace');
    expect(workspace?.getAttribute('aria-label')).toBe('PC Builder workspace');
  });

  it('does not contain fixture product names in empty state', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('ryzen');
    expect(html).not.toContain('intel');
    expect(html).not.toContain('nvidia');
    expect(html).not.toContain('geforce');
  });

  it('does not contain pricing or totals in empty state', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('EGP');
  });
});
