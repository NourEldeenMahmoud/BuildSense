import { Routes } from '@angular/router';
import { routes as prodRoutes } from '../app/app.routes';

export const visualRoutes: Routes = [
  ...prodRoutes,
  {
    path: '__visual/builder-filled',
    loadComponent: () => import('../app/features/builder/builder.page').then((m) => m.BuilderPage),
  },
];
