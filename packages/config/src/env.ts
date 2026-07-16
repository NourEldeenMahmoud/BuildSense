import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGO_URI: z.string().url(),
  MONGO_DB_NAME: z.string().min(1),
  API_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DNS_SERVERS: z.string().optional(),
  WEB_ORIGIN: z.string().url(),
  SESSION_MAX_AGE_HOURS: z.coerce.number().int().positive().default(24),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(environment: unknown): Env {
  return envSchema.parse(environment);
}

export function validateEnv(): Env {
  return parseEnv(process.env);
}

export function getDnsServers(): string[] {
  return (process.env['DNS_SERVERS'] ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
}

export { envSchema };
