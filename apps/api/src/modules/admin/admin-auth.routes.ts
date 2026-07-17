import express from 'express';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminAuthService } from './admin-auth.service.js';
import {
  requireAdminSession,
  requireCsrfToken,
  requireOrigin,
  type AdminCookieConfig,
} from '../../middleware/admin-auth.js';

export function createAdminAuthRoutes(
  cookieConfig: AdminCookieConfig,
  webOrigin: string,
): express.Router {
  const router = express.Router();
  const service = new AdminAuthService();
  const controller = new AdminAuthController(service, cookieConfig, webOrigin);

  router.use((req, res, next) => {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // POST /api/v1/admin/auth/login — no session required, but Origin + rate-limited
  router.post(
    '/login',
    controller.login,
  );

  // POST /api/v1/admin/auth/logout — requires session + CSRF + Origin
  router.post(
    '/logout',
    requireAdminSession(),
    requireCsrfToken(),
    requireOrigin(webOrigin),
    controller.logout,
  );

  // GET /api/v1/admin/auth/me — requires session only (read-only GET)
  router.get(
    '/me',
    requireAdminSession(),
    controller.me,
  );

  return router;
}
