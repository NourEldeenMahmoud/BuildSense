import crypto from 'node:crypto';
import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Scrypt parameters — versioned for future migration
// ---------------------------------------------------------------------------

export interface ScryptParams {
  cost: number;
  saltLength: number;
  keyLength: number;
}

export const SCRYPT_PARAMS_V1: ScryptParams = {
  cost: 16384,
  saltLength: 32,
  keyLength: 64,
};

export const CURRENT_HASH_VERSION = 1;

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface AdminAccountDocument extends Document {
  email: string;
  role: 'ADMIN';
  passwordHash: string;
  passwordSalt: string;
  scryptParams: ScryptParams;
  hashVersion: number;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const scryptParamsSchema = new Schema<ScryptParams>(
  {
    cost: { type: Number, required: true },
    saltLength: { type: Number, required: true },
    keyLength: { type: Number, required: true },
  },
  { _id: false },
);

const adminAccountSchema = new Schema<AdminAccountDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true, enum: ['ADMIN'], default: 'ADMIN' },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    scryptParams: { type: scryptParamsSchema, required: true },
    hashVersion: { type: Number, required: true, default: CURRENT_HASH_VERSION },
    disabled: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

adminAccountSchema.index({ email: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const AdminAccountModel: Model<AdminAccountDocument> =
  model<AdminAccountDocument>('AdminAccount', adminAccountSchema, 'admin_accounts');

// ---------------------------------------------------------------------------
// Password hashing helpers (crypto.scrypt only)
// ---------------------------------------------------------------------------

function scryptAsync(
  password: Buffer,
  salt: Buffer,
  params: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, params.keyLength, { N: params.cost }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

export interface HashPasswordResult {
  passwordHash: string;
  passwordSalt: string;
  scryptParams: ScryptParams;
  hashVersion: number;
}

export async function hashPassword(
  password: string,
  params: ScryptParams = SCRYPT_PARAMS_V1,
  version: number = CURRENT_HASH_VERSION,
): Promise<HashPasswordResult> {
  const salt = crypto.randomBytes(params.saltLength);
  const key = await scryptAsync(Buffer.from(password, 'utf8'), salt, params);
  return {
    passwordHash: key.toString('hex'),
    passwordSalt: salt.toString('hex'),
    scryptParams: params,
    hashVersion: version,
  };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  params: ScryptParams,
): Promise<boolean> {
  const salt = Buffer.from(storedSalt, 'hex');
  const key = await scryptAsync(Buffer.from(password, 'utf8'), salt, params);
  const expectedHash = Buffer.from(storedHash, 'hex');

  // Ensure equal-length buffers for timingSafeEqual
  if (key.length !== expectedHash.length) {
    return false;
  }
  return crypto.timingSafeEqual(key, expectedHash);
}
