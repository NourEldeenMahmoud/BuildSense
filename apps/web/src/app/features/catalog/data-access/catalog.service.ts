import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api.config';
import { 
  CatalogCategoryListResponse, 
  CatalogProductListResponse, 
  CatalogProductDetail, 
  CatalogProductOffer 
} from '../../../shared/contracts/catalog';

export interface CatalogQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest';
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getCategories(): Observable<CatalogCategoryListResponse> {
    return this.http.get<CatalogCategoryListResponse>(`${this.baseUrl}/api/v1/categories`);
  }

  getProducts(params: CatalogQueryParams): Observable<CatalogProductListResponse> {
    let httpParams = new HttpParams();
    
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize !== undefined) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.brand) httpParams = httpParams.set('brand', params.brand);
    if (params.minPrice !== undefined) httpParams = httpParams.set('minPrice', params.minPrice.toString());
    if (params.maxPrice !== undefined) httpParams = httpParams.set('maxPrice', params.maxPrice.toString());
    if (params.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http.get<CatalogProductListResponse>(`${this.baseUrl}/api/v1/products`, { params: httpParams });
  }

  getProductById(id: string): Observable<CatalogProductDetail> {
    return this.http.get<CatalogProductDetail>(`${this.baseUrl}/api/v1/products/${id}`);
  }

  getProductOffers(id: string): Observable<{ items: CatalogProductOffer[] }> {
    return this.http.get<{ items: CatalogProductOffer[] }>(`${this.baseUrl}/api/v1/products/${id}/offers`);
  }
}
