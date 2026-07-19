import { describe, it, expect } from 'vitest';
import { classifyElBadrHttpFailure } from './failure-classifier.js';

describe('classifyElBadrHttpFailure', () => {
  it('classifies HTTP 429 as HTTP_429', () => {
    expect(classifyElBadrHttpFailure({ httpStatus: 429 })).toBe('HTTP_429');
  });

  it('classifies HTTP 403 as BLOCKED_RESPONSE', () => {
    expect(classifyElBadrHttpFailure({ httpStatus: 403 })).toBe('BLOCKED_RESPONSE');
  });

  it('classifies HTTP 408 as HTTP_408', () => {
    expect(classifyElBadrHttpFailure({ httpStatus: 408 })).toBe('HTTP_408');
  });

  it('classifies HTTP 500 as HTTP_5XX', () => {
    expect(classifyElBadrHttpFailure({ httpStatus: 500 })).toBe('HTTP_5XX');
  });

  it('classifies HTTP 404 as HTTP_4XX', () => {
    expect(classifyElBadrHttpFailure({ httpStatus: 404 })).toBe('HTTP_4XX');
  });

  it('classifies off-domain redirect', () => {
    expect(classifyElBadrHttpFailure({
      redirectUrl: 'https://evil.com/steal',
    })).toBe('OFF_DOMAIN_REDIRECT');
  });

  it('allows on-domain redirect', () => {
    expect(classifyElBadrHttpFailure({
      redirectUrl: 'https://elbadrgroupeg.store/other',
    })).not.toBe('OFF_DOMAIN_REDIRECT');
  });

  it('classifies invalid content type', () => {
    expect(classifyElBadrHttpFailure({
      contentType: 'application/json',
    })).toBe('INVALID_CONTENT_TYPE');
  });

  it('classifies timeout message', () => {
    expect(classifyElBadrHttpFailure({
      message: 'Request timed out',
    })).toBe('TIMEOUT');
  });

  it('classifies network error', () => {
    expect(classifyElBadrHttpFailure({
      message: 'ECONNREFUSED',
    })).toBe('NETWORK');
  });

  it('defaults to NETWORK', () => {
    expect(classifyElBadrHttpFailure({})).toBe('NETWORK');
  });
});
