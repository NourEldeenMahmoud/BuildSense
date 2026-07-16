import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@buildsense/contracts';
import { AdminAuthService } from './admin-auth.service.js';
import {
  checkLoginRateLimit,
  resetLoginRateLimit,
  setSessionCookie,
  clearSessionCookie,
  setCsrfCookie,
  clearCsrfCookie,
  validateOrigin,
  type AdminCookieConfig,
} from '../../middleware/admin-auth.js';

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class AdminAuthController {
  constructor(
    private readonly service: AdminAuthService,
    private readonly cookieConfig: AdminCookieConfig,
    private readonly webOrigin: string,
  ) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Validate Origin (strict)
      if (!validateOrigin(req, this.webOrigin)) {
        this.sendForbidden(res, req, 'Invalid origin');
        return;
      }

      // 2. Rate limit check
      const ip = this.getClientIp(req);
      const { allowed, retryAfterMs } = checkLoginRateLimit(ip);
      if (!allowed) {
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
        this.sendTooManyRequests(res, req);
        return;
      }

      // 3. Validate input
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        this.sendBadRequest(res, req, 'Invalid credentials');
        return;
      }

      if (!email || !password) {
        this.sendBadRequest(res, req, 'Invalid credentials');
        return;
      }

      // 4. Attempt login
      const userAgent = req.headers['user-agent'] ?? null;
      const result = await this.service.login(email, password, this.cookieConfig.sessionMaxAgeMs, userAgent);

      if (result.kind === 'invalid_credentials' || result.kind === 'account_disabled') {
        // Same response for both to prevent account enumeration
        this.sendUnauthorized(res, req);
        return;
      }

      // Reset rate limit on successful login
      resetLoginRateLimit(ip);

      // 5. Set cookies
      if (result.sessionToken) {
        setSessionCookie(res, result.sessionToken, this.cookieConfig);
      }
      if (result.csrfToken) {
        setCsrfCookie(res, result.csrfToken, this.cookieConfig);
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.adminSession) {
        this.sendUnauthorized(res, req);
        return;
      }

      await this.service.logout(req.adminSession);

      clearSessionCookie(res, this.cookieConfig);
      clearCsrfCookie(res, this.cookieConfig);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.admin) {
        this.sendUnauthorized(res, req);
        return;
      }

      const dto = await this.service.me(req.admin);
      res.json(dto);
    } catch (error) {
      next(error);
    }
  };

  // -- Helpers ---------------------------------------------------------------

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown';
    }
    return req.socket.remoteAddress ?? 'unknown';
  }

  private errorResponse(error: string, req: Request): ApiErrorResponse {
    return { error, requestId: String(req.headers['x-request-id'] ?? '') };
  }

  private sendUnauthorized(res: Response, req: Request): void {
    res.status(401).json(this.errorResponse('Invalid credentials', req));
  }

  private sendBadRequest(res: Response, req: Request, message: string): void {
    res.status(400).json(this.errorResponse(message, req));
  }

  private sendForbidden(res: Response, req: Request, message: string): void {
    res.status(403).json(this.errorResponse(message, req));
  }

  private sendTooManyRequests(res: Response, req: Request): void {
    res.status(429).json(this.errorResponse('Too many login attempts', req));
  }
}
