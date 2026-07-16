import { Injectable, inject, signal, computed } from '@angular/core';
import { AdminApiService } from './admin-api.service';
import type { AdminMeResponse } from '@buildsense/contracts';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly api = inject(AdminApiService);

  private readonly _status = signal<AuthStatus>('loading');
  private readonly _user = signal<AdminMeResponse | null>(null);
  private readonly _error = signal<string | null>(null);

  // CSRF token is always read live from the cookie (double-submit pattern).

  readonly status = this._status.asReadonly();
  readonly user = this._user.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => this._status() === 'authenticated');
  readonly isLoading = computed(() => this._status() === 'loading');

  /**
   * Attempt session recovery on app startup.
   * Calls GET /admin/auth/me — if the session cookie is valid the server
   * returns user info, otherwise 401.
   */
  recoverSession(): void {
    this._status.set('loading');
    this._error.set(null);

    this.api.me().subscribe({
      next: (user) => {
        this._user.set(user);
        this._status.set('authenticated');
        this.syncCsrfFromCookie();
      },
      error: () => {
        this._user.set(null);
        this._status.set('unauthenticated');
      },
    });
  }

  login(email: string, password: string): Promise<boolean> {
    this._error.set(null);
    this._status.set('loading');

    return new Promise<boolean>((resolve) => {
      this.api.login(email, password).subscribe({
        next: () => {
          // After login, the server has set HttpOnly session + readable CSRF cookies.
          // Fetch user info to confirm session.
          this.syncCsrfFromCookie();
          this.api.me().subscribe({
            next: (user) => {
              this._user.set(user);
              this._status.set('authenticated');
              resolve(true);
            },
            error: () => {
              this._user.set(null);
              this._status.set('unauthenticated');
              this._error.set('Session established but verification failed');
              resolve(false);
            },
          });
        },
        error: (err) => {
          const message =
            err?.status === 429
              ? 'Too many login attempts. Please try again later.'
              : 'Invalid email or password.';
          this._error.set(message);
          this._status.set('unauthenticated');
          resolve(false);
        },
      });
    });
  }

  logout(): Promise<boolean> {
    const token = this.readCsrfCookie();
    if (!token) {
      // No CSRF cookie — can't send a valid logout. Clear local state.
      this._user.set(null);
      this._status.set('unauthenticated');
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      this.api.logout(token).subscribe({
        next: () => {
          this._user.set(null);
          this._status.set('unauthenticated');
          resolve(true);
        },
        error: () => {
          // Even on error, clear local state — session may have expired.
          this._user.set(null);
          this._status.set('unauthenticated');
          resolve(false);
        },
      });
    });
  }

  /** No-op — CSRF is always read live from the cookie (double-submit pattern). */
  syncCsrfFromCookie(): void {
    // Intentionally empty: the CSRF cookie is read on each logout request.
  }

  /** Get the current CSRF token for logout or any other mutating admin request. */
  getCsrfToken(): string | null {
    return this.readCsrfCookie();
  }

  private readCsrfCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const name = 'buildsense_admin_csrf';
    const match = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  }
}
