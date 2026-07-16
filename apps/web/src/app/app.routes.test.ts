import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('routes', () => {
  it('defines required routes', () => {
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
});
