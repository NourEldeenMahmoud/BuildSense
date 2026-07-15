import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuilderPage } from './builder.page';
import { BuildService } from './data-access/build.service';
import { BuildStore } from './data-access/build.store';
import { API_BASE_URL } from '../../core/api.config';

// Mock storage module
vi.mock('../../core/storage', () => ({
  getLatestBuildId: vi.fn().mockReturnValue(null),
  setLatestBuildId: vi.fn(),
  clearLatestBuildId: vi.fn(),
}));

function createMockBuildStore() {
  return {
    status: vi.fn().mockReturnValue('idle'),
    loaded: vi.fn().mockReturnValue(false),
    loading: vi.fn().mockReturnValue(false),
    creating: vi.fn().mockReturnValue(false),
    notFound: vi.fn().mockReturnValue(false),
    apiError: vi.fn().mockReturnValue(false),
    conflictMessage: vi.fn().mockReturnValue(null),
    errorMessage: vi.fn().mockReturnValue(null),
    publicId: vi.fn().mockReturnValue(null),
    slots: vi.fn().mockReturnValue(null),
    summary: vi.fn().mockReturnValue(null),
    selectedSlot: vi.fn().mockReturnValue(null),
    candidateGroups: vi.fn().mockReturnValue([]),
    candidatesLoading: vi.fn().mockReturnValue(false),
    candidatesError: vi.fn().mockReturnValue(null),
    selectionDrawerOpen: vi.fn().mockReturnValue(false),
    retry: vi.fn(),
    clearConflictNotice: vi.fn(),
    closeSelectionDrawer: vi.fn(),
    selectSlot: vi.fn(),
    putItem: vi.fn(),
    deleteItem: vi.fn(),
  };
}

describe('BuilderPage', () => {
  let fixture: ComponentFixture<BuilderPage>;
  let paramMapSubject: Subject<unknown>;
  let mockBuildService: {
    createBuild: ReturnType<typeof vi.fn>;
    getBuild: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    paramMapSubject = new Subject();
    mockBuildService = {
      createBuild: vi.fn().mockReturnValue(new Subject()), // never emits — keeps store in 'creating'
      getBuild: vi.fn().mockReturnValue(new Subject()),
    };

    await TestBed.configureTestingModule({
      imports: [BuilderPage, RouterTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://test-api' },
        { provide: BuildService, useValue: mockBuildService },
        { provide: BuildStore, useValue: createMockBuildStore() },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuilderPage);
    fixture.detectChanges();
  });

  it('renders the page heading "PC Builder"', () => {
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('PC Builder');
  });

  it('has a region landmark with labelledby', () => {
    const section = fixture.nativeElement.querySelector('section[role="region"]');
    expect(section?.getAttribute('aria-labelledby')).toBe('builder-heading');
  });

  it('shows idle state initially while waiting for route', () => {
    const idleEl = fixture.nativeElement.querySelector('.builder-idle');
    expect(idleEl).toBeTruthy();
    expect(idleEl.textContent).toContain('Preparing builder');
  });

  it('does not contain fixture product data', () => {
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('Ryzen');
    expect(html).not.toContain('Intel');
    expect(html).not.toContain('EGP');
  });

  it('does not contain the old deferred/unavailable notice', () => {
    const html = fixture.nativeElement.innerHTML;
    expect(html).not.toContain('deferred');
    expect(html).not.toContain('not yet available');
  });

  it('does not contain localStorage or persistence references in the template', () => {
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('saved build');
  });

  it('does not contain export or print functionality', () => {
    const html = fixture.nativeElement.innerHTML.toLowerCase();
    expect(html).not.toContain('export');
    expect(html).not.toContain('print');
  });
});
