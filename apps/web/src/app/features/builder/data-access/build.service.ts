import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api.config';
import type {
  BuildDto,
  CreateBuildRequest,
  UpdateBuildRequest,
  PutItemRequest,
  DeleteItemRequest,
  PurchasePlanDto,
  CandidatesApiResponse,
  CandidateAvailabilityFilter,
} from '@buildsense/contracts';

/** Query parameters for the candidates endpoint. */
export interface CandidateQueryParams {
  readonly page?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly availability?: CandidateAvailabilityFilter;
}

/**
 * Typed HTTP client for the Build API.
 *
 * Mirrors every endpoint from the backend builds module:
 * - POST   /api/v1/builds
 * - GET    /api/v1/builds/:publicId
 * - PATCH  /api/v1/builds/:publicId
 * - PUT    /api/v1/builds/:publicId/items/:slot
 * - DELETE /api/v1/builds/:publicId/items/:slot
 * - POST   /api/v1/builds/:publicId/validate
 * - GET    /api/v1/builds/:publicId/candidates/:slot
 * - GET    /api/v1/builds/:publicId/purchase-plan
 */
@Injectable({ providedIn: 'root' })
export class BuildService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Create a new empty build. */
  createBuild(request: CreateBuildRequest = {}): Observable<BuildDto> {
    return this.http.post<BuildDto>(`${this.baseUrl}/api/v1/builds`, request);
  }

  /** Load a build by public ID. */
  getBuild(publicId: string): Observable<BuildDto> {
    return this.http.get<BuildDto>(`${this.baseUrl}/api/v1/builds/${publicId}`);
  }

  /** Update build metadata (name). */
  updateBuild(publicId: string, request: UpdateBuildRequest): Observable<BuildDto> {
    return this.http.patch<BuildDto>(
      `${this.baseUrl}/api/v1/builds/${publicId}`,
      request,
    );
  }

  /** Add or replace a component in a slot (PUT = idempotent). */
  putItem(
    publicId: string,
    slot: string,
    request: PutItemRequest,
  ): Observable<BuildDto> {
    return this.http.put<BuildDto>(
      `${this.baseUrl}/api/v1/builds/${publicId}/items/${slot}`,
      request,
    );
  }

  /** Remove a component from a slot. */
  deleteItem(
    publicId: string,
    slot: string,
    request: DeleteItemRequest,
  ): Observable<BuildDto> {
    return this.http.delete<BuildDto>(
      `${this.baseUrl}/api/v1/builds/${publicId}/items/${slot}`,
      { body: request },
    );
  }

  /** Trigger compatibility + pricing validation for the build. */
  validateBuild(publicId: string): Observable<BuildDto> {
    return this.http.post<BuildDto>(
      `${this.baseUrl}/api/v1/builds/${publicId}/validate`,
      {},
    );
  }

  /** Get the purchase plan (shopping list) for a build. */
  getPurchasePlan(publicId: string): Observable<PurchasePlanDto> {
    return this.http.get<PurchasePlanDto>(
      `${this.baseUrl}/api/v1/builds/${publicId}/purchase-plan`,
    );
  }

  /** Get candidate products for a slot. */
  getCandidates(
    publicId: string,
    slot: string,
    params: CandidateQueryParams = {},
  ): Observable<CandidatesApiResponse> {
    let httpParams = new HttpParams();
    if (params.page != null) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params.pageSize != null) {
      httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.availability) {
      httpParams = httpParams.set('availability', params.availability);
    }

    return this.http.get<CandidatesApiResponse>(
      `${this.baseUrl}/api/v1/builds/${publicId}/candidates/${slot}`,
      { params: httpParams },
    );
  }
}
