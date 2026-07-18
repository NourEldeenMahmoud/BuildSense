import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('routes', () => {
  it('defines required top-level routes', () => {
    expect(routes.map((route) => route.path)).toEqual([
      '',
      'catalog',
      'compare',
      'products/:productId',
      'builder/:publicId',
      'builder',
      'purchase-plan',
      'admin/login',
      'admin',
      '**',
    ]);
  });

  it('admin shell has Phase 4 child routes', () => {
    const adminRoute = routes.find((r) => r.path === 'admin');
    expect(adminRoute).toBeDefined();
    const childPaths = (adminRoute?.children ?? []).map((c) => c.path);
    expect(childPaths).toContain('match-reviews');
    expect(childPaths).toContain('match-reviews/:id');
    expect(childPaths).toContain('data-quality');
    expect(childPaths).toContain('data-quality/:id');
    expect(childPaths).toContain('eligibility');
    expect(childPaths).toContain('jobs');
    expect(childPaths).toContain('jobs/:id');
  });

  it('reference-data redirects to admin overview without lazy loader', () => {
    const adminRoute = routes.find((r) => r.path === 'admin');
    const refDataRoute = adminRoute?.children?.find((c) => c.path === 'reference-data');
    expect(refDataRoute).toBeDefined();
    expect(refDataRoute?.redirectTo).toBe('');
    expect(refDataRoute?.pathMatch).toBe('full');
    expect(refDataRoute?.loadComponent).toBeUndefined();
  });
});
