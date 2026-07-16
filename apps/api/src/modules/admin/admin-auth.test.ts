import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  AdminAccountModel,
  AdminSessionModel,
  hashPassword,
  hashToken,
  hashCsrfToken,
  generateToken,
  generateCsrfToken,
} from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import {
  resetAllLoginRateLimits,
  getSessionCookieName,
  getCsrfCookieName,
  setSessionCookie,
  setCsrfCookie,
} from '../../middleware/admin-auth.js';
import express from 'express';

const WEB_ORIGIN = 'http://localhost:4200';
const COOKIE_CONFIG_DEV = { isDev: true, sessionMaxAgeMs: 24 * 60 * 60 * 1000 };

let mongoServer: MongoMemoryServer;
let app: express.Express;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = createApp({
    isDatabaseConnected: () => true,
    logger: createLogger({ level: 'fatal', name: 'test' }),
    corsOrigin: WEB_ORIGIN,
    cookieConfig: COOKIE_CONFIG_DEV,
    webOrigin: WEB_ORIGIN,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await AdminAccountModel.deleteMany({});
  await AdminSessionModel.deleteMany({});
  resetAllLoginRateLimits();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestAdmin(
  email = 'admin@example.com',
  password = 'securepassword123',
) {
  const hashResult = await hashPassword(password);
  return AdminAccountModel.create({
    email,
    role: 'ADMIN',
    passwordHash: hashResult.passwordHash,
    passwordSalt: hashResult.passwordSalt,
    scryptParams: hashResult.scryptParams,
    hashVersion: hashResult.hashVersion,
  });
}

async function createTestSession(adminId: mongoose.Types.ObjectId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const csrfToken = generateCsrfToken();
  const csrfTokenHash = hashCsrfToken(csrfToken);
  const now = new Date();

  const session = await AdminSessionModel.create({
    adminId,
    tokenHash,
    csrfTokenHash,
    expiresAt: new Date(now.getTime() + 86400000),
    lastUsedAt: now,
  });

  return { session, tokenHex: token.toString('hex'), csrfTokenHex: csrfToken.toString('hex') };
}

function getCookie(res: request.Response, name: string): string | undefined {
  const setCookie = res.headers['set-cookie'] as string[] | undefined;
  if (!setCookie) return undefined;
  for (const cookie of setCookie) {
    const match = cookie.match(new RegExp(`${name}=([^;]+)`));
    if (match) return match[1];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Admin Auth API', () => {
  describe('POST /api/v1/admin/auth/login', () => {
    it('returns 200 with ok:true on valid credentials', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('does not include session token or CSRF token in response body', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(['ok']);
      expect(res.body).not.toHaveProperty('token');
      expect(res.body).not.toHaveProperty('sessionToken');
      expect(res.body).not.toHaveProperty('csrfToken');
      expect(res.body).not.toHaveProperty('accessToken');
    });

    it('completes full login→me E2E flow using session cookie', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      // Step 1: Login
      const loginRes = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(loginRes.status).toBe(200);

      // Extract session cookie from Set-Cookie header
      const sessionCookie = getCookie(loginRes, 'buildsense_admin_session');
      expect(sessionCookie).toBeDefined();

      // Step 2: Use session cookie to access /me
      const meRes = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${sessionCookie}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe('admin@example.com');
      expect(meRes.body.role).toBe('ADMIN');
    });

    it('sets session cookie on successful login', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      const sessionCookie = getCookie(res, 'buildsense_admin_session');
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie!.length).toBeGreaterThan(0);
    });

    it('sets CSRF cookie on successful login', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      const csrfCookie = getCookie(res, 'buildsense_admin_csrf');
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie!.length).toBeGreaterThan(0);
    });

    it('sets HttpOnly on session cookie', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const sessionCookie = setCookie.find((c) => c.startsWith('buildsense_admin_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Strict');
    });

    it('CSRF cookie is not HttpOnly (browser-readable)', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const csrfCookie = setCookie.find((c) => c.startsWith('buildsense_admin_csrf='));
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).not.toContain('HttpOnly');
    });

    it('returns 401 for wrong password (no account enumeration)', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 401 for non-existent email (same response as wrong password)', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for invalid Origin', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', 'http://evil.example.com')
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(403);
    });

    it('returns 403 when Origin header is missing', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(403);
    });

    it('rejects disabled accounts with same error as invalid credentials', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      admin.disabled = true;
      await admin.save();

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /api/v1/admin/auth/logout', () => {
    it('revokes session and clears cookies', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { session, tokenHex, csrfTokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `buildsense_admin_session=${tokenHex}; buildsense_admin_csrf=${csrfTokenHex}`)
        .set('X-CSRF-Token', csrfTokenHex);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Session should be revoked in DB
      const updatedSession = await AdminSessionModel.findById(session._id).exec();
      expect(updatedSession?.revokedAt).not.toBeNull();
    });

    it('returns 401 without session cookie', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN);

      expect(res.status).toBe(401);
    });

    it('returns 403 without CSRF token header', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { tokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `buildsense_admin_session=${tokenHex}`);

      expect(res.status).toBe(403);
    });

    it('returns 403 with invalid CSRF token', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { tokenHex, csrfTokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `buildsense_admin_session=${tokenHex}; buildsense_admin_csrf=${csrfTokenHex}`)
        .set('X-CSRF-Token', 'invalid-csrf-token');

      expect(res.status).toBe(403);
    });

    it('returns 403 for invalid Origin on logout', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { tokenHex, csrfTokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', 'http://evil.example.com')
        .set('Cookie', `buildsense_admin_session=${tokenHex}; buildsense_admin_csrf=${csrfTokenHex}`)
        .set('X-CSRF-Token', csrfTokenHex);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/auth/me', () => {
    it('returns admin info with valid session', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { tokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${tokenHex}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@example.com');
      expect(res.body.role).toBe('ADMIN');
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('returns 401 without session cookie', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 401 with expired session', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const token = generateToken();
      const tokenHash = hashToken(token);
      const csrfToken = generateCsrfToken();
      const csrfTokenHash = hashCsrfToken(csrfToken);
      const now = new Date();

      await AdminSessionModel.create({
        adminId: admin._id,
        tokenHash,
        csrfTokenHash,
        expiresAt: new Date(now.getTime() - 1000), // Already expired
        lastUsedAt: now,
      });

      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${token.toString('hex')}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 with revoked session', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const token = generateToken();
      const tokenHash = hashToken(token);
      const csrfToken = generateCsrfToken();
      const csrfTokenHash = hashCsrfToken(csrfToken);
      const now = new Date();

      await AdminSessionModel.create({
        adminId: admin._id,
        tokenHash,
        csrfTokenHash,
        expiresAt: new Date(now.getTime() + 86400000),
        lastUsedAt: now,
        revokedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', `buildsense_admin_session=${token.toString('hex')}`);

      expect(res.status).toBe(401);
    });

    it('returns 401 with malformed/unknown session token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', 'buildsense_admin_session=not-a-real-token-hex');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 with empty session token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me')
        .set('Cookie', 'buildsense_admin_session=');

      expect(res.status).toBe(401);
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after 5 failed login attempts', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/admin/auth/login')
          .set('Origin', WEB_ORIGIN)
          .send({ email: 'admin@example.com', password: 'wrong' });
      }

      // 6th attempt should be rate limited
      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'wrong' });

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });
  });

  describe('Unauthorized access', () => {
    it('GET /api/v1/admin/auth/me returns 401 without session', async () => {
      const res = await request(app)
        .get('/api/v1/admin/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('POST /api/v1/admin/auth/logout returns 401 without session', async () => {
      const res = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  describe('Cookie configuration (dev)', () => {
    it('sets correct dev cookie name and path', async () => {
      await createTestAdmin('admin@example.com', 'password123');

      const res = await request(app)
        .post('/api/v1/admin/auth/login')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'admin@example.com', password: 'password123' });

      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const sessionCookie = setCookie.find((c) => c.startsWith('buildsense_admin_session='));

      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('Path=/api/v1/admin');
      expect(sessionCookie).not.toContain('Secure');
    });
  });

  describe('Cookie configuration (production)', () => {
    it('uses __Host- prefix for session cookie in production', () => {
      expect(getSessionCookieName(false)).toBe('__Host-buildsense_admin_session');
    });

    it('uses __Host- prefix for CSRF cookie in production', () => {
      expect(getCsrfCookieName(false)).toBe('__Host-buildsense_admin_csrf');
    });

    it('dev uses plain names without __Host- prefix', () => {
      expect(getSessionCookieName(true)).toBe('buildsense_admin_session');
      expect(getCsrfCookieName(true)).toBe('buildsense_admin_csrf');
    });

    it('production session cookie sets Secure and Path=/', () => {
      const cookies: Array<{ name: string; options: Record<string, unknown> }> = [];
      const fakeRes = {
        cookie: (name: string, _value: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as unknown as import('express').Response;

      setSessionCookie(fakeRes, 'test-token', { isDev: false, sessionMaxAgeMs: 3600000 });

      expect(cookies.length).toBe(1);
      expect(cookies[0]!.name).toBe('__Host-buildsense_admin_session');
      expect(cookies[0]!.options.httpOnly).toBe(true);
      expect(cookies[0]!.options.secure).toBe(true);
      expect(cookies[0]!.options.path).toBe('/');
      expect(cookies[0]!.options.sameSite).toBe('strict');
    });

    it('production CSRF cookie sets Secure and Path=/ but not HttpOnly', () => {
      const cookies: Array<{ name: string; options: Record<string, unknown> }> = [];
      const fakeRes = {
        cookie: (name: string, _value: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as unknown as import('express').Response;

      setCsrfCookie(fakeRes, 'test-csrf', { isDev: false, sessionMaxAgeMs: 3600000 });

      expect(cookies.length).toBe(1);
      expect(cookies[0]!.name).toBe('__Host-buildsense_admin_csrf');
      expect(cookies[0]!.options.httpOnly).toBe(false);
      expect(cookies[0]!.options.secure).toBe(true);
      expect(cookies[0]!.options.path).toBe('/');
    });

    it('dev session cookie omits Secure flag', () => {
      const cookies: Array<{ name: string; options: Record<string, unknown> }> = [];
      const fakeRes = {
        cookie: (name: string, _value: string, options: Record<string, unknown>) => {
          cookies.push({ name, options });
        },
      } as unknown as import('express').Response;

      setSessionCookie(fakeRes, 'test-token', { isDev: true, sessionMaxAgeMs: 3600000 });

      expect(cookies[0]!.name).toBe('buildsense_admin_session');
      expect(cookies[0]!.options.secure).toBeUndefined();
      expect(cookies[0]!.options.path).toBe('/api/v1/admin');
    });
  });

  describe('CSRF protection', () => {
    it('POST /logout requires X-CSRF-Token header', async () => {
      const admin = await createTestAdmin('admin@example.com', 'password123');
      const { tokenHex, csrfTokenHex } = await createTestSession(admin._id as mongoose.Types.ObjectId);

      // Without CSRF header
      const res1 = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `buildsense_admin_session=${tokenHex}; buildsense_admin_csrf=${csrfTokenHex}`);

      expect(res1.status).toBe(403);

      // With CSRF header
      const res2 = await request(app)
        .post('/api/v1/admin/auth/logout')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `buildsense_admin_session=${tokenHex}; buildsense_admin_csrf=${csrfTokenHex}`)
        .set('X-CSRF-Token', csrfTokenHex);

      expect(res2.status).toBe(200);
    });
  });
});
