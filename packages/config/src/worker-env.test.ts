import { describe, expect, it } from 'vitest';
import { parseWorkerEnv } from './worker-env.js';

describe('parseWorkerEnv', () => {
  it('applies safe defaults when no worker-specific variables are set', () => {
    const env = parseWorkerEnv({});

    expect(env).toMatchObject({
      SIGMA_BASE_URL: 'https://www.sigma-computer.com',
      SIGMA_REQUESTS_PER_MINUTE: 30,
      SIGMA_MAX_CONCURRENCY: 3,
      SIGMA_REQUEST_TIMEOUT_MS: 15000,
      SIGMA_MAX_RETRIES: 2,
      SIGMA_MAX_PAGES_PER_CATEGORY: 200,
      EL_BADR_BASE_URL: 'https://elbadrgroupeg.store',
      EL_BADR_MAX_CONCURRENCY: 1,
      EL_BADR_MAX_PAGES_PER_CATEGORY: 1,
      SCRAPER_STORE_HTML: true,
      SCRAPER_SNAPSHOT_DIR: 'fixtures/runs',
    });
  });

  it('accepts valid custom configuration', () => {
    const env = parseWorkerEnv({
      SIGMA_BASE_URL: 'https://test.sigma-computer.com',
      SIGMA_REQUESTS_PER_MINUTE: 15,
      SIGMA_MAX_CONCURRENCY: 1,
      SIGMA_REQUEST_TIMEOUT_MS: 30000,
      SIGMA_MAX_RETRIES: 5,
      SIGMA_USER_AGENT: 'TestAgent/1.0',
      SIGMA_MAX_PAGES_PER_CATEGORY: 10,
      SCRAPER_STORE_HTML: false,
      SCRAPER_SNAPSHOT_DIR: '/tmp/snapshots',
    });

    expect(env).toMatchObject({
      SIGMA_BASE_URL: 'https://test.sigma-computer.com',
      SIGMA_REQUESTS_PER_MINUTE: 15,
      SIGMA_MAX_CONCURRENCY: 1,
      SIGMA_REQUEST_TIMEOUT_MS: 30000,
      SIGMA_MAX_RETRIES: 5,
      SIGMA_USER_AGENT: 'TestAgent/1.0',
      SIGMA_MAX_PAGES_PER_CATEGORY: 10,
      SCRAPER_STORE_HTML: false,
      SCRAPER_SNAPSHOT_DIR: '/tmp/snapshots',
    });
  });

  it('rejects concurrency outside the allowed range', () => {
    expect(() => parseWorkerEnv({ SIGMA_MAX_CONCURRENCY: 0 })).toThrow();
    expect(() => parseWorkerEnv({ SIGMA_MAX_CONCURRENCY: 6 })).toThrow();
  });

  it('rejects negative retries', () => {
    expect(() => parseWorkerEnv({ SIGMA_MAX_RETRIES: -1 })).toThrow();
  });

  it('rejects empty user agent', () => {
    expect(() => parseWorkerEnv({ SIGMA_USER_AGENT: '' })).toThrow();
  });

  it('rejects invalid Sigma base URL', () => {
    expect(() => parseWorkerEnv({ SIGMA_BASE_URL: 'not-a-url' })).toThrow();
  });
});
