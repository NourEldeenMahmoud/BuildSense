import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('rejects configuration without MongoDB connection values', () => {
    expect(() => parseEnv({})).toThrow();
  });

  it('accepts required configuration and applies safe defaults', () => {
    const env = parseEnv({
      MONGO_URI: 'mongodb://localhost:27017/buildsense',
      MONGO_DB_NAME: 'buildsense',
    });

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });
});
