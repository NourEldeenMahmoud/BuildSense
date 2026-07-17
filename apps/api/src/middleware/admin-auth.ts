import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import {
  AdminSessionModel,
  AdminAccountModel,
  hashToken,
  type AdminSessionDocument,
  type AdminAccountDocument,
} from '@buildsense/database';
import type { ApiErrorResponse } from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Cookie helpers (manual parsing — no new dependency)
// ---------------------------------------------------------------------------

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function getCookieFromReq(req: Request, name: string): string | undefined {
  // Express with cookie-parser populates req.cookies; fall back to raw header
  const fromParser = (req as unknown as { cookies?: Record<string, string> }).cookies;
  if (fromParser && name in fromParser) {
    return fromParser[name] as string;
  }
  return parseCookies(req.headers.cookie)[name];
}

// ---------------------------------------------------------------------------
// Cookie configuration
// ---------------------------------------------------------------------------

export interface AdminCookieConfig {
  isDev: boolean;
  sessionMaxAgeMs: number;
}

export function getSessionCookieName(isDev: boolean): string {
  return isDev ? 'buildsense_admin_session' : '__Host-buildsense_admin_session';
}

export function getCsrfCookieName(isDev: boolean): string {
  return isDev ? 'buildsense_admin_csrf' : '__Host-buildsense_admin_csrf';
}

export function setSessionCookie(
  res: Response,
  token: string,
  config: AdminCookieConfig,
): void {
  const name = getSessionCookieName(config.isDev);
  const options: Record<string, unknown> = {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: config.isDev ? '/api/v1/admin' : '/',
    maxAge: config.sessionMaxAgeMs,
  };

  if (!config.isDev) {
    options.secure = true;
  }

  res.cookie(name, token, options);
}

export function clearSessionCookie(res: Response, config: AdminCookieConfig): void {
  const name = getSessionCookieName(config.isDev);
  const options: Record<string, unknown> = {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: config.isDev ? '/api/v1/admin' : '/',
    maxAge: 0,
  };

  if (!config.isDev) {
    options.secure = true;
  }

  res.cookie(name, '', options);
}

export function setCsrfCookie(
  res: Response,
  csrfToken: string,
  config: AdminCookieConfig,
): void {
  const name = getCsrfCookieName(config.isDev);
  const options: Record<string, unknown> = {
    httpOnly: false, // Browser-readable for double-submit pattern
    sameSite: 'strict' as const,
    path: '/',
    maxAge: config.sessionMaxAgeMs,
  };

  // In dev the API (:3000) and frontend (:4200) run on different ports.
  // The CSRF cookie must be readable by JavaScript on the frontend origin,
  // so we set Domain=localhost and Path=/ so document.cookie can access it.
  if (config.isDev) {
    options.domain = 'localhost';
  }

  if (!config.isDev) {
    options.secure = true;
  }

  res.cookie(name, csrfToken, options);
}

export function clearCsrfCookie(res: Response, config: AdminCookieConfig): void {
  const name = getCsrfCookieName(config.isDev);
  const options: Record<string, unknown> = {
    httpOnly: false,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0,
  };

  if (config.isDev) {
    options.domain = 'localhost';
  }

  if (!config.isDev) {
    options.secure = true;
  }

  res.cookie(name, '', options);
}

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per-IP, 5 attempts / 15 minutes)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Periodic cleanup to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      loginAttempts.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
// Allow process to exit even if the timer is still scheduled
if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
  cleanupInterval.unref();
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

/** Test-only: clear all rate limit entries. */
export function resetAllLoginRateLimits(): void {
  loginAttempts.clear();
}

// ---------------------------------------------------------------------------
// Origin validation
// ---------------------------------------------------------------------------

export function validateOrigin(req: Request, allowedOrigin: string): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  return origin === allowedOrigin;
}

// ---------------------------------------------------------------------------
// Express request augmentation
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminAccountDocument;
      adminSession?: AdminSessionDocument;
    }
  }
}

// ---------------------------------------------------------------------------
// requireAdminSession middleware
// ---------------------------------------------------------------------------

export function requireAdminSession(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cookieName = getSessionCookieName(
        (req as unknown as { app?: { get?: (key: string) => string } }).app?.get?.('env') === 'production'
          ? false
          : true,
      );
      const token = getCookieFromReq(req, cookieName);

      if (!token) {
        sendUnauthorized(res, req);
        return;
      }

      const tokenHash = hashToken(Buffer.from(token, 'hex'));
      const now = new Date();

      const session = await AdminSessionModel.findOne({
        tokenHash,
        expiresAt: { $gt: now },
        revokedAt: null,
      }).exec();

      if (!session) {
        sendUnauthorized(res, req);
        return;
      }

      const account = await AdminAccountModel.findOne({
        _id: session.adminId,
        disabled: false,
      }).exec();

      if (!account) {
        sendUnauthorized(res, req);
        return;
      }

      // Update lastUsedAt
      session.lastUsedAt = now;
      await session.save();

      req.admin = account;
      req.adminSession = session;
      next();
    } catch {
      sendUnauthorized(res, req);
    }
  };
}

// ---------------------------------------------------------------------------
// requireCsrfToken middleware (for mutating requests)
// ---------------------------------------------------------------------------

export function requireCsrfToken(): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();

    // GET is read-only — no CSRF needed
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      next();
      return;
    }

    // Must have admin session first
    if (!req.adminSession) {
      sendForbidden(res, req, 'CSRF validation requires active session');
      return;
    }

    const csrfHeader = req.headers['x-csrf-token'] as string | undefined;
    if (!csrfHeader) {
      sendForbidden(res, req, 'Missing CSRF token');
      return;
    }

    const storedHash = req.adminSession.csrfTokenHash;
    const providedHash = crypto.createHash('sha256').update(csrfHeader, 'hex').digest('hex');

    // Use timing-safe comparison
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(providedHash, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      sendForbidden(res, req, 'Invalid CSRF token');
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// requireOrigin middleware
// ---------------------------------------------------------------------------

export function requireOrigin(
  allowedOrigin: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!validateOrigin(req, allowedOrigin)) {
      sendForbidden(res, req, 'Invalid origin');
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Error response helpers
// ---------------------------------------------------------------------------

function sendUnauthorized(res: Response, req: Request): void {
  const requestId = (req.headers['x-request-id'] as string) ?? '';
  const body: ApiErrorResponse = { error: 'Unauthorized', requestId };
  res.status(401).json(body);
}

function sendForbidden(res: Response, req: Request, message: string): void {
  const requestId = (req.headers['x-request-id'] as string) ?? '';
  const body: ApiErrorResponse = { error: message, requestId };
  res.status(403).json(body);
}
