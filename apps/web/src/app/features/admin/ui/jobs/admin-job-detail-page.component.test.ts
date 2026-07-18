import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AdminJobDetailPage } from './admin-job-detail-page.component';
import type { AdminJobDetailResponse } from '@buildsense/contracts';

function mockJobDetail(overrides?: Partial<AdminJobDetailResponse>): AdminJobDetailResponse {
  return {
    id: 'job-001',
    jobType: 'REPROCESS_CATALOG',
    status: 'SUCCEEDED',
    requestedBy: 'admin@test.com',
    reason: 'Reprocess after normalization fix',
    params: { category: 'CPU' },
    claimedBy: 'worker-01',
    claimedAt: '2024-01-01T10:00:00Z',
    attempts: 1,
    maxAttempts: 3,
    completedAt: '2024-01-01T10:05:00Z',
    result: { processed: 150 },
    errorSummary: null,
    createdAt: '2024-01-01T10:00:00Z',
    ...overrides,
  };
}

function createActivatedRoute(id: string): { snapshot: { paramMap: { get: (key: string) => string | null } } } {
  const snapshot = {
    paramMap: {
      get: (key: string): string | null => (key === 'id' ? id : null),
    },
  };
  return { snapshot };
}

describe('AdminJobDetailPage', () => {
  let fixture: ComponentFixture<AdminJobDetailPage>;
  let apiSpy: { getJob: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    apiSpy = {
      getJob: vi.fn().mockReturnValue(of(mockJobDetail())),
    };

    await TestBed.configureTestingModule({
      imports: [AdminJobDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AdminApiService, useValue: apiSpy },
        { provide: ActivatedRoute, useValue: createActivatedRoute('job-001') },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminJobDetailPage);
    fixture.detectChanges();
  });

  it('reads route param "id" (not "jobId")', () => {
    // The bug fix: component should use paramMap.get('id'), not 'jobId'
    expect(apiSpy.getJob).toHaveBeenCalledWith('job-001');
  });

  it('renders back link to jobs list', () => {
    const el: HTMLElement = fixture.nativeElement;
    const backLink = el.querySelector('.back-link');
    expect(backLink).toBeTruthy();
    expect(backLink?.textContent).toContain('JOBS LIST');
  });

  it('renders summary strip with status badge', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip).toBeTruthy();
    const badge = strip?.querySelector('.status-badge--succeeded');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('SUCCEEDED');
  });

  it('displays job type and ID in summary', () => {
    const el: HTMLElement = fixture.nativeElement;
    const strip = el.querySelector('.summary-strip');
    expect(strip?.textContent).toContain('REPROCESS_CATALOG');
    expect(strip?.textContent).toContain('job-001');
  });

  it('renders Job Info panel', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const jobInfoTitle = Array.from(titles).find((t) => t.textContent?.includes('Job Info'));
    expect(jobInfoTitle).toBeTruthy();
  });

  it('displays requestedBy in Job Info', () => {
    const el: HTMLElement = fixture.nativeElement;
    const detailValues = el.querySelectorAll('.detail-value');
    const texts = Array.from(detailValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('admin@test.com');
  });

  it('displays attempts in Job Info', () => {
    const el: HTMLElement = fixture.nativeElement;
    const detailValues = el.querySelectorAll('.detail-value--mono');
    const texts = Array.from(detailValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('1 / 3');
  });

  it('renders Execution panel', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const execTitle = Array.from(titles).find((t) => t.textContent?.includes('Execution'));
    expect(execTitle).toBeTruthy();
  });

  it('displays claimedBy', () => {
    const el: HTMLElement = fixture.nativeElement;
    const detailValues = el.querySelectorAll('.detail-value--mono');
    const texts = Array.from(detailValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('worker-01');
  });

  it('renders Params panel with JSON', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const paramsTitle = Array.from(titles).find((t) => t.textContent?.includes('Params'));
    expect(paramsTitle).toBeTruthy();
    const jsonBlock = el.querySelector('.json-block');
    expect(jsonBlock?.textContent).toContain('CPU');
  });

  it('renders Result panel for succeeded job', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const resultTitle = Array.from(titles).find((t) => t.textContent?.includes('Result'));
    expect(resultTitle).toBeTruthy();
    const jsonBlocks = el.querySelectorAll('.json-block');
    const resultBlock = Array.from(jsonBlocks).find((b) => b.textContent?.includes('150'));
    expect(resultBlock).toBeTruthy();
  });

  it('renders Reason panel', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const reasonTitle = Array.from(titles).find((t) => t.textContent?.includes('Reason'));
    expect(reasonTitle).toBeTruthy();
    const reasonText = el.querySelector('.reason-text');
    expect(reasonText?.textContent).toContain('Reprocess after normalization fix');
  });

  it('shows error state on API failure', async () => {
    apiSpy.getJob.mockReturnValue(throwError(() => ({ status: 404, error: { error: 'Not found' } })));
    const failFixture = TestBed.createComponent(AdminJobDetailPage);
    failFixture.detectChanges();
    const el: HTMLElement = failFixture.nativeElement;
    expect(el.querySelector('.error-panel')).toBeTruthy();
    expect(el.querySelector('.error-title')?.textContent).toContain('Job not found');
  });

  it('shows error summary for failed jobs', async () => {
    apiSpy.getJob.mockReturnValue(of(mockJobDetail({
      status: 'FAILED',
      errorSummary: 'Connection timeout to worker',
      result: null,
    })));
    const freshFixture = TestBed.createComponent(AdminJobDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const titles = el.querySelectorAll('.detail-title');
    const errorTitle = Array.from(titles).find((t) => t.textContent?.includes('Error Summary'));
    expect(errorTitle).toBeTruthy();
    const errorBlock = el.querySelector('.error-block');
    expect(errorBlock?.textContent).toContain('Connection timeout to worker');
  });

  it('shows "not yet claimed" when claimedBy is null', async () => {
    apiSpy.getJob.mockReturnValue(of(mockJobDetail({ claimedBy: null, claimedAt: null })));
    const freshFixture = TestBed.createComponent(AdminJobDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    expect(el.textContent).toContain('not yet claimed');
  });

  it('shows placeholder for null completedAt', async () => {
    apiSpy.getJob.mockReturnValue(of(mockJobDetail({ completedAt: null })));
    const freshFixture = TestBed.createComponent(AdminJobDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const detailValues = el.querySelectorAll('.detail-value--mono');
    const texts = Array.from(detailValues).map((v) => v.textContent?.trim() ?? '');
    expect(texts).toContain('\u2014'); // em-dash placeholder
  });

  it('shows em-dash for empty params', async () => {
    apiSpy.getJob.mockReturnValue(of(mockJobDetail({ params: {} })));
    const freshFixture = TestBed.createComponent(AdminJobDetailPage);
    freshFixture.detectChanges();
    const el: HTMLElement = freshFixture.nativeElement;
    const jsonBlocks = el.querySelectorAll('.json-block');
    const paramsBlock = Array.from(jsonBlocks).find((b) => b.textContent?.includes('\u2014'));
    expect(paramsBlock).toBeTruthy();
  });

  it('verifies route param is "id" not "jobId"', async () => {
    // This test explicitly verifies the bug fix
    let capturedId = '';
    apiSpy.getJob.mockImplementation((id: string) => {
      capturedId = id;
      return of(mockJobDetail());
    });

    const freshFixture = TestBed.createComponent(AdminJobDetailPage);
    freshFixture.detectChanges();

    expect(capturedId).toBe('job-001');
  });
});
