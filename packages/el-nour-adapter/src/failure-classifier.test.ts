import { describe, it, expect } from 'vitest';
import { classifyElNourHttpFailure } from './failure-classifier.js';

describe('classifyElNourHttpFailure', () => {
  it('returns OFF_DOMAIN_REDIRECT for off-domain redirect', () => {
    const result = classifyElNourHttpFailure({
      httpStatus: 302,
      redirectUrl: 'https://evil.example.com/phish',
    });
    expect(result).toBe('OFF_DOMAIN_REDIRECT');
  });

  it('allows redirects to elnour-tech.com', () => {
    const result = classifyElNourHttpFailure({
      httpStatus: 302,
      redirectUrl: 'https://elnour-tech.com/en/product/test/',
    });
    expect(result).not.toBe('OFF_DOMAIN_REDIRECT');
  });

  it('returns INVALID_CONTENT_TYPE for non-HTML', () => {
    const result = classifyElNourHttpFailure({
      httpStatus: 200,
      contentType: 'application/json',
    });
    expect(result).toBe('INVALID_CONTENT_TYPE');
  });

  it('returns HTTP_429 for rate limiting', () => {
    const result = classifyElNourHttpFailure({ httpStatus: 429 });
    expect(result).toBe('HTTP_429');
  });

  it('returns BLOCKED_RESPONSE for 403', () => {
    const result = classifyElNourHttpFailure({ httpStatus: 403 });
    expect(result).toBe('BLOCKED_RESPONSE');
  });

  it('returns HTTP_5XX for server errors', () => {
    const result = classifyElNourHttpFailure({ httpStatus: 503 });
    expect(result).toBe('HTTP_5XX');
  });

  it('returns TIMEOUT for timeout messages', () => {
    const result = classifyElNourHttpFailure({ message: 'Request timed out' });
    expect(result).toBe('TIMEOUT');
  });

  it('returns NETWORK for network errors', () => {
    const result = classifyElNourHttpFailure({ message: 'ECONNREFUSED' });
    expect(result).toBe('NETWORK');
  });

  it('returns NETWORK as default', () => {
    const result = classifyElNourHttpFailure({});
    expect(result).toBe('NETWORK');
  });
});
