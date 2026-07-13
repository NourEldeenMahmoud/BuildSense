import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_BASE_URL } from './api.config';

export type ApiHealthState = 'loading' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ApiHealthService {
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  readonly state = signal<ApiHealthState>('loading');

  check(): void {
    this.state.set('loading');
    this.http.get<{ status: string; database: string }>(`${this.apiBaseUrl}/api/health`).subscribe({
      next: ({ status, database }) =>
        this.state.set(status === 'ok' && database === 'connected' ? 'success' : 'error'),
      error: () => this.state.set('error'),
    });
  }
}
