# ADR-005: Admin Authentication Strategy

**Status:** Accepted  
**Decision Date:** 16 July 2026  
**Scope:** Admin authentication, session management, CORS, CSRF, and bootstrap  
**Owner:** Nour Eldeen Mahmoud  
**Supersedes:** ADR-000 §21 (auth deferral and early admin protection guidance)

---

## 1. Context

ADR-000 deferred end-user authentication and directed early admin protection via environment variables. The project now requires a functional admin backend with login, session management, and write-action auditing. The earlier deferral approach (env-var bootstrap password hash) is insufficient for production-quality admin access control.

The following decisions replace all earlier tentative recommendations in the implementation plan (§4 of `BuildSense_Admin_Auth_And_Next_Steps_Plan.md`).

---

## 2. Decision

### 2.1 Admin Role Model

**Single role: `ADMIN`.** No end-user accounts, no RBAC hierarchy, no OAuth, no organization model. The platform serves a single administrator for catalog operations.

External identity providers (OAuth, OIDC, SAML) are explicitly rejected for the MVP. The admin authenticates with email and password directly against the BuildSense database.

### 2.2 Password Hashing

- **Algorithm:** Node.js built-in `crypto.scrypt`.
- **No external dependencies:** bcrypt, argon2, or any native addon is rejected.
- **Storage:** `passwordHash`, `passwordSalt`, hashing parameters (`cost`, `saltLength`, `keyLength`), and a `hashVersion` field for future algorithm migration.
- **Verification:** `crypto.timingSafeEqual` for constant-time comparison.

### 2.3 Session Design

- **Token format:** Opaque random token, at least 32 cryptographically random bytes (`crypto.randomBytes(32)`).
- **Storage:** The raw token is placed **only** in the HttpOnly cookie. It is never stored, logged, or transmitted except via the cookie. Only the SHA-2256 hash of the token is stored in MongoDB.
- **Session document fields:** `adminId`, `tokenHash`, `createdAt`, `expiresAt`, `lastUsedAt`, `revokedAt` (nullable), optional `userAgent` metadata.
- **TTL:** MongoDB TTL index on `expiresAt` for automatic cleanup.
- **No `SESSION_SECRET`:** There is no HMAC-signed or JWT session token; the session is a random opaque token looked up by hash.

### 2.4 Session Cookie Configuration

**Development:**
| Property | Value |
|----------|-------|
| Name | `buildsense_admin_session` |
| HttpOnly | `true` |
| SameSite | `Strict` |
| Secure | `false` (localhost HTTP) |
| Path | `/api/v1/admin` |

**Production:**
| Property | Value |
|----------|-------|
| Name | `__Host-buildsense_admin_session` |
| HttpOnly | `true` |
| SameSite | `Strict` |
| Secure | `true` |
| Path | `/` |

The `__Host-` prefix forces `Secure` and `Path=/` in compliant browsers, providing an additional layer of protection.

### 2.5 CORS and Credentials

The API must configure:

```ts
cors({
  origin: WEB_ORIGIN,
  credentials: true,
})
```

`WEB_ORIGIN` is a required environment variable (validated URL). Angular admin requests must use `withCredentials: true` for all protected admin endpoints.

### 2.6 CSRF Protection

Do not rely on SameSite alone. For POST, PUT, PATCH, DELETE admin requests:

1. Strict `Origin` header validation against `WEB_ORIGIN`.
2. CSRF token validation (double-submit cookie pattern or synchronizer token).
3. `SameSite=Strict` as defense in depth.

GET requests remain read-only. Write operations are never triggered by GET.

### 2.7 Bootstrap and Recovery

- **CLI flow:** `npm run worker -- admin seed --email admin@example.com`
- CLI silently prompts for password, confirms, hashes internally with `crypto.scrypt`, and writes to the database.
- Idempotent: safe to re-run; updates password if email already exists.
- Refuses unsafe defaults (empty password, common passwords).
- Never logs the password.
- Recovery uses the same CLI to reset/replace the password for an existing admin email.

**Rejected:** `ADMIN_BOOTSTRAP_PASSWORD_HASH` and `ADMIN_BOOTSTRAP_EMAIL` environment variables. Bootstrap is CLI-only.

### 2.8 Architecture Boundaries

- API never scrapes. It never processes raw data.
- Worker owns all ingestion: scraping, normalization, matching, publishing.
- Raw scraped snapshots remain immutable after capture.
- Admin write actions that need worker processing create durable job requests; they do not trigger in-request processing.
- All admin write actions create an `AdminAuditLog` entry with: admin ID, action, target, timestamp, request ID, and reason (for write actions).

---

## 3. Consequences

### Positive

- Single-role simplicity: no RBAC complexity to maintain.
- No external auth dependencies: `crypto.scrypt` is built into Node.js.
- Opaque session tokens are quantum-resistant (no signing to forge).
- `__Host-` cookie prefix in production provides browser-enforced security guarantees.
- SameSite=Strict + Origin validation + CSRF token = defense in depth.

### Negative

- No single sign-on or federated identity for future multi-admin scenarios.
- Manual session revocation and expiry management.
- CSRF double-submit pattern requires careful implementation.

### Risks

- If a second admin is needed later, the single-role model requires code changes (not configuration).
- `crypto.scrypt` parameter tuning may need adjustment as hardware capabilities change (mitigated by `hashVersion` field).

---

## 4. Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| bcrypt / argon2 | External native dependency; `crypto.scrypt` is sufficient and built-in. |
| JWT sessions | Adds signing/verification complexity; opaque tokens are simpler and more secure for server-side sessions. |
| Redis session store | ADR-000 defers Redis; MongoDB TTL index provides equivalent cleanup. |
| OAuth / OIDC | Overhead for a single-admin system; deferred to future scope if needed. |
| Complex RBAC | Single ADMIN role is sufficient for the platform's operational model. |
| `SESSION_SECRET` env var | Not needed — there is no signed token; sessions are random opaque tokens looked up by hash. |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | Bootstrap is handled by CLI flow, not environment variables. |
