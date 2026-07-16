import {
  AdminAccountModel,
  AdminSessionModel,
  verifyPassword,
  generateToken,
  hashToken,
  generateCsrfToken,
  hashCsrfToken,
  type AdminAccountDocument,
  type AdminSessionDocument,
} from '@buildsense/database';
import type { AdminMeResponse } from '@buildsense/contracts';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface LoginResult {
  kind: 'success' | 'invalid_credentials' | 'account_disabled';
  sessionToken?: string;
  csrfToken?: string;
  session?: AdminSessionDocument;
}

export interface LogoutResult {
  kind: 'success' | 'no_session';
}

export class AdminAuthService {
  async login(
    email: string,
    password: string,
    maxAgeMs: number,
    userAgent: string | null,
  ): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase().trim();

    const account = await AdminAccountModel.findOne({ email: normalizedEmail }).exec();

    if (!account) {
      // Constant-time dummy check to prevent timing-based enumeration
      await verifyPassword(
        'dummy-password-to-prevent-timing-attack',
        '0'.repeat(128),
        '0'.repeat(64),
        { cost: 16384, saltLength: 32, keyLength: 64 },
      );
      return { kind: 'invalid_credentials' };
    }

    if (account.disabled) {
      return { kind: 'account_disabled' };
    }

    const valid = await verifyPassword(
      password,
      account.passwordHash,
      account.passwordSalt,
      account.scryptParams,
    );

    if (!valid) {
      return { kind: 'invalid_credentials' };
    }

    // Create session
    const token = generateToken();
    const tokenHash = hashToken(token);
    const csrfToken = generateCsrfToken();
    const csrfTokenHashVal = hashCsrfToken(csrfToken);
    const now = new Date();

    const session = await AdminSessionModel.create({
      adminId: account._id,
      tokenHash,
      csrfTokenHash: csrfTokenHashVal,
      expiresAt: new Date(now.getTime() + maxAgeMs),
      lastUsedAt: now,
      revokedAt: null,
      userAgent,
    });

    return {
      kind: 'success',
      sessionToken: token.toString('hex'),
      csrfToken: csrfToken.toString('hex'),
      session,
    };
  }

  async logout(session: AdminSessionDocument): Promise<LogoutResult> {
    session.revokedAt = new Date();
    await session.save();
    return { kind: 'success' };
  }

  async me(account: AdminAccountDocument): Promise<AdminMeResponse> {
    return {
      id: String(account._id),
      email: account.email,
      role: account.role,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
