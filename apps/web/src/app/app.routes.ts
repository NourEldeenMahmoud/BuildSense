import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'catalog',
    loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'products/:productId',
    loadComponent: () => import('./features/product/product.page').then((m) => m.ProductPage),
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
