import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComparePage } from './compare.page';
import { CompareStore } from './data-access/compare.store';
import { CatalogService } from '../catalog/data-access/catalog.service';
import { BuildService } from '../builder/data-access/build.service';

describe('ComparePage', () => {
  let component: ComparePage;
  let fixture: ComponentFixture<ComparePage>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    const mockService = {
      getProductById: vi.fn().mockReturnValue(of(null)),
      getProducts: vi.fn().mockReturnValue(of({ items: [], pagination: { totalItems: 0, totalPages: 0 } })),
    };

    await TestBed.configureTestingModule({
      imports: [ComparePage, RouterTestingModule],
      providers: [
        CompareStore,
        { provide: CatalogService, useValue: mockService },
        { provide: BuildService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComparePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be missing when no params', () => {
    expect(component.compare.queryState()).toBe('missing');
  });

  it('should be missing when one param is missing', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('missing');
  });

  it('should be malformed-left when left is invalid', () => {
    queryParamsSubject.next({ left: 'invalid', right: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('malformed-left');
  });

  it('should be malformed-right when right is invalid', () => {
    queryParamsSubject.next({ left: '5f9b3b3b3b3b3b3b3b3b3b3b', right: '123' });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('malformed-right');
  });

  it('should be duplicates when left equals right (same case)', () => {
    queryParamsSubject.next({
      left: '5f9b3b3b3b3b3b3b3b3b3b3b',
      right: '5f9b3b3b3b3b3b3b3b3b3b3b',
    });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('duplicates');
  });

  it('should be duplicates when left equals right (different case)', () => {
    queryParamsSubject.next({
      left: '64ABCDEF1234567890ABCDEF',
      right: '64abcdef1234567890abcdef',
    });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('duplicates');
  });

  it('should be valid when both are valid and distinct', () => {
    queryParamsSubject.next({
      left: '5f9b3b3b3b3b3b3b3b3b3b3b',
      right: '5f9b3b3b3b3b3b3b3b3b3b3c',
    });
    fixture.detectChanges();
    expect(component.compare.queryState()).toBe('valid');
  });

  it('should show error state for missing IDs', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Missing Products');
  });

  it('should show error state for malformed left', () => {
    queryParamsSubject.next({ left: 'invalid', right: '5f9b3b3b3b3b3b3b3b3b3b3b' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Invalid Left Product');
  });

  it('should show error state for duplicate IDs', () => {
    queryParamsSubject.next({
      left: '5f9b3b3b3b3b3b3b3b3b3b3b',
      right: '5f9b3b3b3b3b3b3b3b3b3b3b',
    });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Duplicate Products');
  });

  it('selectorOpen starts as false', () => {
    expect(component.selectorOpen()).toBe(false);
  });
});
