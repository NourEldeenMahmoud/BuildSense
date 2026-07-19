import { z } from 'zod';

const workerEnvSchema = z.object({
  // Sigma Computer
  SIGMA_BASE_URL: z.string().url().default('https://www.sigma-computer.com'),
  SIGMA_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  SIGMA_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(3),
  SIGMA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SIGMA_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(2),
  SIGMA_USER_AGENT: z.string().min(1).default('BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)'),
  SIGMA_MAX_PAGES_PER_CATEGORY: z.coerce.number().int().positive().default(200),

  // El Nour Tech
  EL_NOUR_BASE_URL: z.string().url().default('https://elnour-tech.com'),
  EL_NOUR_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  EL_NOUR_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(2),
  EL_NOUR_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  EL_NOUR_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  EL_NOUR_USER_AGENT: z.string().min(1).default('BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)'),
  EL_NOUR_MAX_PAGES_PER_CATEGORY: z.coerce.number().int().positive().default(100),

  // El Badr Group
  EL_BADR_BASE_URL: z.string().url().default('https://elbadrgroupeg.store'),
  EL_BADR_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(20),
  EL_BADR_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(1),
  EL_BADR_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  EL_BADR_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  EL_BADR_USER_AGENT: z.string().min(1).default('BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)'),
  EL_BADR_MAX_PAGES_PER_CATEGORY: z.coerce.number().int().positive().default(1),

  // Alfrensia
  ALFRENSIA_BASE_URL: z.string().url().default('https://alfrensia.com'),
  ALFRENSIA_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  ALFRENSIA_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(5).default(2),
  ALFRENSIA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  ALFRENSIA_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  ALFRENSIA_USER_AGENT: z.string().min(1).default('BuildSense/0.1.0 (github.com/NourEldeenMahmoud/BuildSense)'),
  ALFRENSIA_MAX_PAGES_PER_CATEGORY: z.coerce.number().int().positive().default(10),

  // Shared scraper settings
  SCRAPER_STORE_HTML: z.coerce.boolean().default(true),
  SCRAPER_SNAPSHOT_DIR: z.string().min(1).default('fixtures/runs'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(environment: unknown): WorkerEnv {
  return workerEnvSchema.parse(environment);
}

export { workerEnvSchema };
