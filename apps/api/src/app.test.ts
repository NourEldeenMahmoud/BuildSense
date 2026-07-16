import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createLogger } from '@buildsense/observability';
import { createApp } from './app.js';

function createTestApp(
  databaseConnected: boolean,
  corsOrigin?: string | string[] | boolean,
): ReturnType<typeof createApp> {
  return createApp({
    isDatabaseConnected: () => databaseConnected,
    logger: createLogger({ level: 'fatal', name: 'test' }),
    ...(corsOrigin !== undefined ? { corsOrigin } : {}),
  });
}

describe('API runtime foundation', () => {
  it('reports the API health contract when MongoDB is connected', async () => {
    const response = await request(createTestApp(true)).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('reports liveness without checking MongoDB', async () => {
    const response = await request(createTestApp(false)).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports readiness when MongoDB is connected', async () => {
    const response = await request(createTestApp(true)).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'connected' });
  });

  it('reports unavailable readiness when MongoDB is disconnected', async () => {
    const response = await request(createTestApp(false)).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', database: 'disconnected' });
  });

  it('returns a safe not-found response with a request ID', async () => {
    const response = await request(createTestApp(true)).get('/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Not Found',
      requestId: response.headers['x-request-id'],
    });
  });

  it('returns a safe error response with a request ID', async () => {
    const response = await request(createTestApp(true))
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Internal Server Error',
      requestId: response.headers['x-request-id'],
    });
  });

  it('allows requests from the configured CORS origin with credentials', async () => {
    const app = createTestApp(true, 'http://localhost:4200');
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:4200');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects requests from an unconfigured CORS origin when origin is restricted', async () => {
    const app = createTestApp(true, 'http://localhost:4200');
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');

    // The cors middleware with a string origin always reflects the configured origin.
    // The browser enforces origin matching; the header must NOT reflect the request origin.
    expect(response.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:4200');
  });
});
