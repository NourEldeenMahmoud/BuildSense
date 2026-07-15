import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogPaginationComponent } from './catalog-pagination.component';
import { CatalogStore } from '../data-access/catalog.store';
import { CatalogQueryService } from '../data-access/catalog-query.service';

const makePagination = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  page: 1, pageSize: 24, totalItems: 100, totalPages: 5, ...overrides
});

const makeResult = (paginationOverrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  items: [],
  pagination: makePagination(paginationOverrides)
});

describe('CatalogPaginationComponent', () => {
  let fixture: ComponentFixture<CatalogPaginationComponent>;
  let mockStore: Record<string, unknown>;
  let mockQueryService: Partial<CatalogQueryService>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let resultSignal: ReturnType<typeof signal>;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});
    resultSignal = signal(makeResult());
    const initialLoadingSignal = signal(false);
    const bgLoadingSignal = signal(false);
    const errorSignal = signal<string | null>(null);
    const emptySignal = signal(false);

    mockStore = {
      result: resultSignal.asReadonly(),
      initialLoading: initialLoadingSignal.asReadonly(),
      backgroundLoading: bgLoadingSignal.asReadonly(),
      error: errorSignal.asReadonly(),
      empty: emptySignal.asReadonly()
    };

    mockQueryService = {
      updateFilters: vi.fn(),
      queryParams$: queryParamsSubject.asObservable() as unknown as CatalogQueryService['queryParams$']
    };

    await TestBed.configureTestingModule({
      imports: [CatalogPaginationComponent, RouterTestingModule],

      providers: [
        { provide: CatalogStore, useValue: mockStore as unknown as CatalogStore },
        { provide: CatalogQueryService, useValue: mockQueryService },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable(), snapshot: { queryParams: {} } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CatalogPaginationComponent);
    fixture.detectChanges();
  });

  it('should render pagination when result present', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('nav.pagination')).toBeTruthy();
  });

  it('should disable previous button on first page', () => {
    const el: HTMLElement = fixture.nativeElement;
    const prevBtn = el.querySelector('button[aria-label="Previous page"]') as HTMLButtonElement;
    expect(prevBtn?.disabled).toBe(true);
  });

  it('should disable next button on last page', () => {
    resultSignal.set(makeResult({ page: 5, totalPages: 5 }));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const nextBtn = el.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    expect(nextBtn?.disabled).toBe(true);
  });

  it('should call updateFilters on page button click', () => {
    const el: HTMLElement = fixture.nativeElement;
    const page2Btn = el.querySelector('button[aria-label="Page 2"]') as HTMLButtonElement;
    if (page2Btn) {
      page2Btn.click();
      expect(mockQueryService.updateFilters).toHaveBeenCalledWith({ page: 2 });
    }
  });

  it('should show result range', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('1–24 of 100 products');
  });
});
