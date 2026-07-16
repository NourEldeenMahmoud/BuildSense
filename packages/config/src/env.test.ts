import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const validBaseEnv = {
  MONGO_URI: 'mongodb://localhost:27017/buildsense',
  MONGO_DB_NAME: 'buildsense',
  WEB_ORIGIN: 'http://localhost:4200',
};

describe('parseEnv', () => {
  it('rejects configuration without MongoDB connection values', () => {
    expect(() => parseEnv({})).toThrow();
  });

  it('accepts required configuration and applies safe defaults', () => {
    const env = parseEnv(validBaseEnv);

    expect(env).toMatchObject({
      NODE_ENV: 'development',
      API_PORT: 3000,
      LOG_LEVEL: 'info',
      WEB_ORIGIN: 'http://localhost:4200',
      SESSION_MAX_AGE_HOURS: 24,
    });
  });

  it('rejects missing WEB_ORIGIN', () => {
    expect(() =>
      parseEnv({
        MONGO_URI: 'mongodb://localhost:27017/buildsense',
        MONGO_DB_NAME: 'buildsense',
      }),
    ).toThrow();
  });

  it('rejects invalid WEB_ORIGIN', () => {
    expect(() => parseEnv({ ...validBaseEnv, WEB_ORIGIN: 'not-a-url' })).toThrow();
  });

  it('accepts custom SESSION_MAX_AGE_HOURS', () => {
    const env = parseEnv({ ...validBaseEnv, SESSION_MAX_AGE_HOURS: '48' });
    expect(env.SESSION_MAX_AGE_HOURS).toBe(48);
  });

  it('defaults SESSION_MAX_AGE_HOURS to 24', () => {
    const env = parseEnv(validBaseEnv);
    expect(env.SESSION_MAX_AGE_HOURS).toBe(24);
  });

  it('rejects non-positive SESSION_MAX_AGE_HOURS', () => {
    expect(() => parseEnv({ ...validBaseEnv, SESSION_MAX_AGE_HOURS: 0 })).toThrow();
    expect(() => parseEnv({ ...validBaseEnv, SESSION_MAX_AGE_HOURS: -1 })).toThrow();
  });
});
