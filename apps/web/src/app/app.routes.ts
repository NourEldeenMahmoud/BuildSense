import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { BuildStore } from './features/builder/data-access/build.store';
import { adminAuthGuard } from './features/admin/core/guards/admin-auth.guard';

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
    providers: [BuildStore],
    loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
  },
  {
    path: 'builder',
    providers: [BuildStore],
    loadComponent: () => import('./features/builder/builder.page').then((m) => m.BuilderPage),
  },
  {
    path: 'purchase-plan',
    loadComponent: () =>
      import('./features/purchase-plan/purchase-plan.page').then((m) => m.PurchasePlanPage),
  },
  // ── Admin auth (public) ────────────────────────────────────────────────
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./features/admin/ui/login/admin-login-page.component').then(
        (m) => m.AdminLoginPage,
      ),
  },
  // ── Admin protected shell ──────────────────────────────────────────────
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/admin/ui/dashboard/admin-dashboard-page.component').then(
            (m) => m.AdminDashboardPage,
          ),
      },
      {
        path: 'scrape-runs',
        loadComponent: () =>
          import('./features/admin/ui/scrape-runs/admin-scrape-runs-page.component').then(
            (m) => m.AdminScrapeRunsPage,
          ),
      },
      {
        path: 'scrape-runs/:runId',
        loadComponent: () =>
          import(
            './features/admin/ui/scrape-run-detail/admin-scrape-run-detail-page.component'
          ).then((m) => m.AdminScrapeRunDetailPage),
      },
      {
        path: 'compatibility-quality',
        loadComponent: () =>
          import('./features/admin/ui/compatibility/admin-compatibility-page.component').then(
            (m) => m.AdminCompatibilityPage,
          ),
      },
      {
        path: 'reference-data',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'match-reviews',
        loadComponent: () =>
          import('./features/admin/ui/match-reviews/admin-match-reviews-page.component').then(
            (m) => m.AdminMatchReviewsPage,
          ),
      },
      {
        path: 'match-reviews/:id',
        loadComponent: () =>
          import(
            './features/admin/ui/match-reviews/admin-match-review-detail-page.component'
          ).then((m) => m.AdminMatchReviewDetailPage),
      },
      {
        path: 'data-quality',
        loadComponent: () =>
          import('./features/admin/ui/data-quality/admin-data-quality-page.component').then(
            (m) => m.AdminDataQualityPage,
          ),
      },
      {
        path: 'data-quality/:id',
        loadComponent: () =>
          import(
            './features/admin/ui/data-quality/admin-data-quality-detail-page.component'
          ).then((m) => m.AdminDataQualityDetailPage),
      },
      {
        path: 'eligibility',
        loadComponent: () =>
          import('./features/admin/ui/eligibility/admin-eligibility-page.component').then(
            (m) => m.AdminEligibilityPage,
          ),
      },
      {
        path: 'jobs',
        loadComponent: () =>
          import('./features/admin/ui/jobs/admin-jobs-page.component').then(
            (m) => m.AdminJobsPage,
          ),
      },
      {
        path: 'jobs/:id',
        loadComponent: () =>
          import('./features/admin/ui/jobs/admin-job-detail-page.component').then(
            (m) => m.AdminJobDetailPage,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
