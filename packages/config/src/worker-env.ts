import { z } from 'zod';

const workerEnvSchema = z.object({
  SIGMA_BASE_URL: z.string().url().default('https://www.sigma-computer.com'),
  SIGMA_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  SIGMA_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(3),
  SIGMA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SIGMA_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  SIGMA_USER_AGENT: z.string().min(1).default('BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)'),
  SIGMA_MAX_PAGES_PER_CATEGORY: z.coerce.number().int().positive().default(200),
  SCRAPER_STORE_HTML: z.coerce.boolean().default(true),
  SCRAPER_SNAPSHOT_DIR: z.string().min(1).default('fixtures/runs'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(environment: unknown): WorkerEnv {
  return workerEnvSchema.parse(environment);
}

export { workerEnvSchema };
