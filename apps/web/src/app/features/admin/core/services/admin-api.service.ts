import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../../core/api.config';
import type {
  AdminLoginRequest,
  AdminLoginResponse,
  AdminLogoutResponse,
  AdminMeResponse,
  AdminDashboardResponse,
  AdminScrapeRunListResponse,
  AdminScrapeRunDetailResponse,
  AdminCompatibilityQualityResponse,
  AdminWorkerStatusResponse,
  AdminReferenceDatasetListResponse,
  AdminCatalogStatsResponse,
  AdminPaginationQuery,
  AdminWriteSuccessResponse,
  AdminMatchReviewListResponse,
  AdminMatchReviewDetailResponse,
  AdminMatchReviewLinkRequest,
  AdminMatchReviewIgnoreRequest,
  AdminMatchReviewCreateProductRequest,
  AdminDataQualityIssueListResponse,
  AdminDataQualityIssueDetailResponse,
  AdminDataQualityResolveRequest,
  AdminEligibilityOverrideRequest,
  AdminEligibilityOverrideResponse,
  AdminEligibilityOverrideListResponse,
  AdminEligibilityOverrideDetailResponse,
  AdminJobListResponse,
  AdminJobDetailResponse,
  AdminJobReprocessRequest,
} from '@buildsense/contracts';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private api(path: string): string {
    return `${this.baseUrl}/api/v1/admin${path}`;
  }

  // -- Auth ------------------------------------------------------------------

  login(email: string, password: string): Observable<AdminLoginResponse> {
    return this.http.post<AdminLoginResponse>(
      this.api('/auth/login'),
      { email, password } satisfies AdminLoginRequest,
      { withCredentials: true },
    );
  }

  logout(csrfToken: string): Observable<AdminLogoutResponse> {
    return this.http.post<AdminLogoutResponse>(
      this.api('/auth/logout'),
      {},
      {
        withCredentials: true,
        headers: new HttpHeaders({ 'X-CSRF-Token': csrfToken }),
      },
    );
  }

  me(): Observable<AdminMeResponse> {
    return this.http.get<AdminMeResponse>(this.api('/auth/me'), {
      withCredentials: true,
    });
  }

  // -- Read-only admin endpoints (session cookie only) ------------------------

  getDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>(this.api('/dashboard'), {
      withCredentials: true,
    });
  }

  getScrapeRuns(query?: AdminPaginationQuery): Observable<AdminScrapeRunListResponse> {
    return this.http.get<AdminScrapeRunListResponse>(this.api('/scrape-runs'), {
      withCredentials: true,
      params: query as Record<string, string>,
    });
  }

  getScrapeRun(runId: string): Observable<AdminScrapeRunDetailResponse> {
    return this.http.get<AdminScrapeRunDetailResponse>(
      this.api(`/scrape-runs/${encodeURIComponent(runId)}`),
      { withCredentials: true },
    );
  }

  getCompatibilityQuality(): Observable<AdminCompatibilityQualityResponse> {
    return this.http.get<AdminCompatibilityQualityResponse>(
      this.api('/compatibility-quality'),
      { withCredentials: true },
    );
  }

  getWorkerStatus(): Observable<AdminWorkerStatusResponse> {
    return this.http.get<AdminWorkerStatusResponse>(this.api('/worker-status'), {
      withCredentials: true,
    });
  }

  getReferenceDatasets(): Observable<AdminReferenceDatasetListResponse> {
    return this.http.get<AdminReferenceDatasetListResponse>(
      this.api('/reference-datasets'),
      { withCredentials: true },
    );
  }

  getCatalogStats(): Observable<AdminCatalogStatsResponse> {
    return this.http.get<AdminCatalogStatsResponse>(this.api('/catalog-stats'), {
      withCredentials: true,
    });
  }

  // -- Match Reviews (Phase 4) -----------------------------------------------

  getMatchReviews(query?: { page?: string; pageSize?: string; status?: string }): Observable<AdminMatchReviewListResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.pageSize) params = params.set('pageSize', query.pageSize);
    if (query?.status) params = params.set('status', query.status);
    return this.http.get<AdminMatchReviewListResponse>(this.api('/match-reviews'), {
      withCredentials: true,
      params,
    });
  }

  getMatchReview(id: string): Observable<AdminMatchReviewDetailResponse> {
    return this.http.get<AdminMatchReviewDetailResponse>(
      this.api(`/match-reviews/${encodeURIComponent(id)}`),
      { withCredentials: true },
    );
  }

  linkMatchReview(id: string, body: AdminMatchReviewLinkRequest): Observable<AdminWriteSuccessResponse> {
    return this.http.post<AdminWriteSuccessResponse>(
      this.api(`/match-reviews/${encodeURIComponent(id)}/link`),
      body,
      { withCredentials: true },
    );
  }

  ignoreMatchReview(id: string, body: AdminMatchReviewIgnoreRequest): Observable<AdminWriteSuccessResponse> {
    return this.http.post<AdminWriteSuccessResponse>(
      this.api(`/match-reviews/${encodeURIComponent(id)}/ignore`),
      body,
      { withCredentials: true },
    );
  }

  createProductFromMatchReview(id: string, body: AdminMatchReviewCreateProductRequest): Observable<AdminWriteSuccessResponse> {
    return this.http.post<AdminWriteSuccessResponse>(
      this.api(`/match-reviews/${encodeURIComponent(id)}/create-product`),
      body,
      { withCredentials: true },
    );
  }

  // -- Data Quality Issues (Phase 4) ----------------------------------------

  getDataQualityIssues(query?: { page?: string; pageSize?: string; status?: string; severity?: string }): Observable<AdminDataQualityIssueListResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.pageSize) params = params.set('pageSize', query.pageSize);
    if (query?.status) params = params.set('status', query.status);
    if (query?.severity) params = params.set('severity', query.severity);
    return this.http.get<AdminDataQualityIssueListResponse>(this.api('/data-quality-issues'), {
      withCredentials: true,
      params,
    });
  }

  getDataQualityIssue(id: string): Observable<AdminDataQualityIssueDetailResponse> {
    return this.http.get<AdminDataQualityIssueDetailResponse>(
      this.api(`/data-quality-issues/${encodeURIComponent(id)}`),
      { withCredentials: true },
    );
  }

  resolveDataQualityIssue(id: string, body: AdminDataQualityResolveRequest): Observable<AdminWriteSuccessResponse> {
    return this.http.post<AdminWriteSuccessResponse>(
      this.api(`/data-quality-issues/${encodeURIComponent(id)}/resolve`),
      body,
      { withCredentials: true },
    );
  }

  // -- Eligibility Overrides (Phase 4) --------------------------------------

  getEligibilityOverrides(query?: { page?: string; pageSize?: string }): Observable<AdminEligibilityOverrideListResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.pageSize) params = params.set('pageSize', query.pageSize);
    return this.http.get<AdminEligibilityOverrideListResponse>(this.api('/eligibility-overrides'), {
      withCredentials: true,
      params,
    });
  }

  getEligibilityOverride(id: string): Observable<AdminEligibilityOverrideDetailResponse> {
    return this.http.get<AdminEligibilityOverrideDetailResponse>(
      this.api(`/eligibility-overrides/${encodeURIComponent(id)}`),
      { withCredentials: true },
    );
  }

  overrideEligibility(productId: string, body: AdminEligibilityOverrideRequest): Observable<AdminEligibilityOverrideResponse> {
    return this.http.post<AdminEligibilityOverrideResponse>(
      this.api(`/eligibility/${encodeURIComponent(productId)}/override`),
      body,
      { withCredentials: true },
    );
  }

  // -- Jobs (Phase 4) -------------------------------------------------------

  getJobs(query?: { page?: string; pageSize?: string; status?: string; jobType?: string }): Observable<AdminJobListResponse> {
    let params = new HttpParams();
    if (query?.page) params = params.set('page', query.page);
    if (query?.pageSize) params = params.set('pageSize', query.pageSize);
    if (query?.status) params = params.set('status', query.status);
    if (query?.jobType) params = params.set('jobType', query.jobType);
    return this.http.get<AdminJobListResponse>(this.api('/jobs'), {
      withCredentials: true,
      params,
    });
  }

  getJob(id: string): Observable<AdminJobDetailResponse> {
    return this.http.get<AdminJobDetailResponse>(
      this.api(`/jobs/${encodeURIComponent(id)}`),
      { withCredentials: true },
    );
  }

  requestReprocessJob(body: AdminJobReprocessRequest): Observable<AdminWriteSuccessResponse> {
    return this.http.post<AdminWriteSuccessResponse>(
      this.api('/jobs/reprocess'),
      body,
      { withCredentials: true },
    );
  }
}
