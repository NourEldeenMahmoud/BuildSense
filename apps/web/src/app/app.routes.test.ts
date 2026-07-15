import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('M0 routes', () => {
  it('defines required placeholder routes', () => {
    expect(routes.map((route) => route.path)).toEqual([
      '',
      'catalog',
      'compare',
      'products/:productId',
      'builder/:publicId',
      'builder',
      'purchase-plan',
      'admin',
      '**',
    ]);
  });
});
