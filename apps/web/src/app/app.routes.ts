import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'catalog',
    redirectTo: (redirectData): import('@angular/router').UrlTree => {
      const router = inject(Router);
      return router.createUrlTree(['/'], { queryParams: redirectData.queryParams });
    }
  },
  {
    path: 'compare',
    loadComponent: () => import('./features/compare/compare.page').then((m) => m.ComparePage),
  },
  {
    path: 'products/:productId',
    loadComponent: () => import('./features/product/product.page').then((m) => m.ProductPage),
  },
  {
    path: 'builder/:publicId',
    loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
  },
  {
    path: 'builder',
    loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
  },
  {
    path: 'purchase-plan',
    loadComponent: () =>
      import('./features/purchase-plan/purchase-plan.page').then((m) => m.PurchasePlanPage),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
