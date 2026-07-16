import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
}
