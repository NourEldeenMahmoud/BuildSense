import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from '../../core/interceptors/csrf.interceptor';
import { API_BASE_URL } from '../../../../core/api.config';
import { adminAuthGuard } from './admin-auth.guard';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({ template: 'admin', standalone: true })
class DummyAdminComponent {}

@Component({ template: 'login', standalone: true })
class DummyLoginComponent {}

describe('adminAuthGuard', () => {
  function setup(status: 'loading' | 'authenticated' | 'unauthenticated'): { auth: AdminAuthService; router: Router; location: Location } {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin/login', component: DummyLoginComponent },
          { path: 'admin', component: DummyAdminComponent, canActivate: [adminAuthGuard] },
          { path: 'admin/dashboard', component: DummyAdminComponent, canActivate: [adminAuthGuard] },
        ]),
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });

    const auth = TestBed.inject(AdminAuthService);
    // Override the computed signals for testing
    Object.defineProperty(auth, 'isAuthenticated', {
      value: () => status === 'authenticated',
    });
    Object.defineProperty(auth, 'isLoading', {
      value: () => status === 'loading',
    });

    return { auth, router: TestBed.inject(Router), location: TestBed.inject(Location) };
  }

  it('allows access when authenticated', async () => {
    const { router, location } = setup('authenticated');
    await router.navigate(['/admin']);
    expect(location.path()).toBe('/admin');
  });

  it('redirects to login when unauthenticated', async () => {
    const { router, location } = setup('unauthenticated');
    await router.navigate(['/admin']);
    expect(location.path()).toContain('/admin/login');
  });

  it('redirects to login when loading', async () => {
    const { router, location } = setup('loading');
    await router.navigate(['/admin']);
    expect(location.path()).toContain('/admin/login');
  });

  it('preserves return URL in query params when unauthenticated', async () => {
    const { router, location } = setup('unauthenticated');
    await router.navigate(['/admin/dashboard']);
    expect(location.path()).toContain('/admin/login');
    expect(location.path(true)).toContain('returnUrl');
  });
});
