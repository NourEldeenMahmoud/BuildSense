import { Routes } from '@angular/router';
import { routes as prodRoutes } from '../app/app.routes';

export const visualRoutes: Routes = [
  {
    path: '__visual/builder-filled',
    loadComponent: () =>
      import('./builder-filled-page').then((m) => m.VisualBuilderFilledPage),
  },
  {
    path: '__visual/component-selection',
    loadComponent: () =>
      import('./component-selection-page').then(
        (m) => m.VisualComponentSelectionPage,
      ),
  },
  {
    path: '__visual/build-review-filled',
    loadComponent: () =>
      import('./build-review-filled-page').then(
        (m) => m.VisualBuildReviewFilledPage,
      ),
  },
  {
    path: '__visual/mobile-builder',
    loadComponent: () =>
      import('./mobile-builder-page').then((m) => m.VisualMobileBuilderPage),
  },
  ...prodRoutes,
];
