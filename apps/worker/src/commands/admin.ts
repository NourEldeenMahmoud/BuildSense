import { createInterface } from 'node:readline';
import { validateEnv } from '@buildsense/config';
import {
  connectDatabase,
  disconnectDatabase,
  AdminAccountModel,
  hashPassword,
  SCRYPT_PARAMS_V1,
  CURRENT_HASH_VERSION,
} from '@buildsense/database';
import { createLogger } from '@buildsense/observability';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Account operations (testable in isolation with injected deps)
// ---------------------------------------------------------------------------

export interface AccountLike {
  passwordHash: string;
  passwordSalt: string;
  scryptParams: { cost: number; saltLength: number; keyLength: number };
  hashVersion: number;
  disabled?: boolean;
  save(): Promise<unknown>;
}

export interface AccountStore {
  findOne(query: { email: string }): Promise<AccountLike | null>;
  create(data: Record<string, unknown>): Promise<unknown>;
}

export interface HashResult {
  passwordHash: string;
  passwordSalt: string;
  scryptParams: { cost: number; saltLength: number; keyLength: number };
  hashVersion: number;
}

export type HashFn = (password: string) => Promise<HashResult>;

export interface SeedResult {
  created: boolean;
}

/** Create or update an admin account. Pure business logic — no I/O. */
export async function seedAdminAccount(
  email: string,
  password: string,
  store: AccountStore,
  hash: HashFn,
): Promise<SeedResult> {
  const hashResult = await hash(password);
  const existing = await store.findOne({ email });

  if (existing) {
    existing.passwordHash = hashResult.passwordHash;
    existing.passwordSalt = hashResult.passwordSalt;
    existing.scryptParams = hashResult.scryptParams;
    existing.hashVersion = hashResult.hashVersion;
    existing.disabled = false;
    await existing.save();
    return { created: false };
  }

  await store.create({
    email,
    role: 'ADMIN',
    passwordHash: hashResult.passwordHash,
    passwordSalt: hashResult.passwordSalt,
    scryptParams: hashResult.scryptParams,
    hashVersion: hashResult.hashVersion,
  });
  return { created: true };
}

export interface ResetResult {
  updated: boolean;
}

/** Reset password for an existing admin account. Pure business logic — no I/O. */
export async function resetAdminPassword(
  email: string,
  password: string,
  store: AccountStore,
  hash: HashFn,
): Promise<ResetResult> {
  const existing = await store.findOne({ email });

  if (!existing) {
    return { updated: false };
  }

  const hashResult = await hash(password);
  existing.passwordHash = hashResult.passwordHash;
  existing.passwordSalt = hashResult.passwordSalt;
  existing.scryptParams = hashResult.scryptParams;
  existing.hashVersion = hashResult.hashVersion;
  await existing.save();
  return { updated: true };
}

// ---------------------------------------------------------------------------
// Unsafe password list (minimal, rejects obvious defaults)
// ---------------------------------------------------------------------------

const UNSAFE_PASSWORDS = new Set([
  '',
  'password',
  'admin',
  'admin123',
  '123456',
  '12345678',
  'qwerty',
  'letmein',
  'test',
  'changeme',
]);

/** Check if a password is in the unsafe/common list. */
export function isUnsafePassword(password: string): boolean {
  return UNSAFE_PASSWORDS.has(password.toLowerCase());
}

/** Validate password meets minimum requirements. Returns null if valid, error message if not. */
export function validatePassword(password: string): string | null {
  if (isUnsafePassword(password)) {
    return 'Password is empty or too common. Please choose a stronger password.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Password prompt helper
// ---------------------------------------------------------------------------

function promptPassword(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Attempt to mask input (works on most terminals)
    process.stdout.write(message);

    const stdin = process.stdin;
    const isRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let password = '';

    const onData = (ch: Buffer): void => {
      for (const char of ch.toString('utf8')) {
        if (char === '\n' || char === '\r') {
          if (stdin.isTTY) {
            stdin.setRawMode(isRaw ?? false);
          }
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          return;
        }

        if (char === '\x03') {
          // Ctrl+C
          if (stdin.isTTY) {
            stdin.setRawMode(isRaw ?? false);
          }
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          reject(new Error('Cancelled'));
          return;
        }

        if (char === '\x7f' || char === '\b') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }

        password += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

async function adminSeedAction(options: { email: string }): Promise<void> {
  const env = validateEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'admin:seed',
  });

  const email = options.email.toLowerCase().trim();

  if (!email || !email.includes('@')) {
    logger.error('Invalid email address');
    process.exitCode = 1;
    return;
  }

  let failed = false;

  try {
    await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
    logger.info('Connected to MongoDB');

    // Prompt for password
    const password = await promptPassword('Password: ');

    const passwordError = validatePassword(password);
    if (passwordError) {
      logger.error(passwordError);
      process.exitCode = 1;
      return;
    }

    // Confirm password
    const confirmPassword = await promptPassword('Confirm password: ');

    if (password !== confirmPassword) {
      logger.error('Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    // Hash password
    const hashResult = await hashPassword(password, SCRYPT_PARAMS_V1, CURRENT_HASH_VERSION);

    // Upsert admin account
    const existing = await AdminAccountModel.findOne({ email }).exec();

    if (existing) {
      existing.passwordHash = hashResult.passwordHash;
      existing.passwordSalt = hashResult.passwordSalt;
      existing.scryptParams = hashResult.scryptParams;
      existing.hashVersion = hashResult.hashVersion;
      existing.disabled = false;
      await existing.save();
      logger.info({ email }, 'Admin account password updated');
    } else {
      await AdminAccountModel.create({
        email,
        role: 'ADMIN',
        passwordHash: hashResult.passwordHash,
        passwordSalt: hashResult.passwordSalt,
        scryptParams: hashResult.scryptParams,
        hashVersion: hashResult.hashVersion,
      });
      logger.info({ email }, 'Admin account created');
    }
  } catch (error) {
    failed = true;
    logger.error(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      'Admin seed failed',
    );
  } finally {
    try {
      await disconnectDatabase();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      failed = true;
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'MongoDB disconnect failed',
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

async function adminResetAction(options: { email: string }): Promise<void> {
  const env = validateEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, name: 'buildsense' }).child({
    service: 'worker',
    command: 'admin:reset',
  });

  const email = options.email.toLowerCase().trim();

  if (!email || !email.includes('@')) {
    logger.error('Invalid email address');
    process.exitCode = 1;
    return;
  }

  let failed = false;

  try {
    await connectDatabase(env.MONGO_URI, env.MONGO_DB_NAME);
    logger.info('Connected to MongoDB');

    const existing = await AdminAccountModel.findOne({ email }).exec();

    if (!existing) {
      logger.error({ email }, 'No admin account found with this email');
      process.exitCode = 1;
      return;
    }

    // Prompt for new password
    const password = await promptPassword('New password: ');

    const passwordError = validatePassword(password);
    if (passwordError) {
      logger.error(passwordError);
      process.exitCode = 1;
      return;
    }

    // Confirm password
    const confirmPassword = await promptPassword('Confirm new password: ');

    if (password !== confirmPassword) {
      logger.error('Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    // Hash and update
    const hashResult = await hashPassword(password, SCRYPT_PARAMS_V1, CURRENT_HASH_VERSION);
    existing.passwordHash = hashResult.passwordHash;
    existing.passwordSalt = hashResult.passwordSalt;
    existing.scryptParams = hashResult.scryptParams;
    existing.hashVersion = hashResult.hashVersion;
    await existing.save();

    logger.info({ email }, 'Admin password reset successfully');
  } catch (error) {
    failed = true;
    logger.error(
      {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      'Admin reset failed',
    );
  } finally {
    try {
      await disconnectDatabase();
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      failed = true;
      logger.error(
        {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'MongoDB disconnect failed',
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

export const adminCommand = new Command('admin')
  .description('Admin management commands')
  .addCommand(
    new Command('seed')
      .description('Create or update an admin account with a password')
      .requiredOption('--email <email>', 'Admin email address')
      .action(adminSeedAction),
  )
  .addCommand(
    new Command('reset')
      .description('Reset password for an existing admin account')
      .requiredOption('--email <email>', 'Admin email address')
      .action(adminResetAction),
  );
