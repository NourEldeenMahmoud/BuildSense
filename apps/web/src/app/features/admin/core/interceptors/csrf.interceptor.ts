import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Read the browser-visible CSRF cookie and attach it as the
 * `X-CSRF-Token` header on mutating requests (POST, PUT, PATCH, DELETE).
 *
 * The cookie is set by the server after login as a non-HttpOnly cookie
 * named `buildsense_admin_csrf` (dev) or `__Host-buildsense_admin_csrf` (prod).
 * The session cookie is HttpOnly and never enters JS.
 */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const name = 'buildsense_admin_csrf';
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const method = req.method.toUpperCase();
  const isMutating =
    method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  if (!isMutating) {
    return next(req);
  }

  const token = readCsrfCookie();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { 'X-CSRF-Token': token },
    }),
  );
};
