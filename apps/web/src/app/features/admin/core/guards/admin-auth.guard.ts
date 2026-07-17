import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Route guard that protects admin routes.
 * - If authenticated, allows access.
 * - If loading (session recovery in progress), waits and then decides.
 * - If unauthenticated, redirects to `/admin/login` with a safe return URL.
 */
export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  if (auth.isLoading()) {
    // Session recovery in progress — redirect to login which will show a
    // loading spinner and re-check on completion.
    return router.createUrlTree(['/admin/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Unauthenticated — redirect to login with return URL.
  return router.createUrlTree(['/admin/login'], {
    queryParams: { returnUrl: state.url },
  });
};
