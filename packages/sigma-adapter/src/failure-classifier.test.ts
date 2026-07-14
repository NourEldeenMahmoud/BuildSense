import { describe, expect, it } from 'vitest';
import { classifySigmaHttpFailure } from './failure-classifier.js';

describe('classifySigmaHttpFailure', () => {
  it('classifies HTTP 408 as timeout', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 408 })).toBe('HTTP_408');
  });

  it('classifies HTTP 429 as rate limited', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 429 })).toBe('HTTP_429');
  });

  it('classifies HTTP 403 as blocked', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 403 })).toBe('BLOCKED_RESPONSE');
  });

  it('classifies HTTP 500 as 5XX', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 500 })).toBe('HTTP_5XX');
  });

  it('classifies HTTP 503 as 5XX', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 503 })).toBe('HTTP_5XX');
  });

  it('classifies HTTP 404 as 4XX', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 404 })).toBe('HTTP_4XX');
  });

  it('classifies HTTP 401 as 4XX', () => {
    expect(classifySigmaHttpFailure({ httpStatus: 401 })).toBe('HTTP_4XX');
  });

  it('classifies off-domain redirect', () => {
    expect(
      classifySigmaHttpFailure({
        redirectUrl: 'https://malicious-site.com/redirect',
      }),
    ).toBe('OFF_DOMAIN_REDIRECT');
  });

  it('does not classify same-host redirect as off-domain', () => {
    expect(
      classifySigmaHttpFailure({
        redirectUrl: 'https://www.sigma-computer.com/en/other-page',
      }),
    ).not.toBe('OFF_DOMAIN_REDIRECT');
  });

  it('classifies non-HTML content type', () => {
    expect(
      classifySigmaHttpFailure({
        contentType: 'application/json',
      }),
    ).toBe('INVALID_CONTENT_TYPE');
  });

  it('does not classify HTML content type as invalid', () => {
    expect(
      classifySigmaHttpFailure({
        contentType: 'text/html; charset=utf-8',
      }),
    ).not.toBe('INVALID_CONTENT_TYPE');
  });

  it('classifies timeout message', () => {
    expect(
      classifySigmaHttpFailure({
        message: 'Request timed out after 15000ms',
      }),
    ).toBe('TIMEOUT');
  });

  it('classifies connection refused as network', () => {
    expect(
      classifySigmaHttpFailure({
        message: 'connect ECONNREFUSED 127.0.0.1:443',
      }),
    ).toBe('NETWORK');
  });

  it('classifies DNS not found as network', () => {
    expect(
      classifySigmaHttpFailure({
        message: 'getaddrinfo ENOTFOUND www.sigma-computer.com',
      }),
    ).toBe('NETWORK');
  });

  it('defaults to NETWORK when no info provided', () => {
    expect(classifySigmaHttpFailure({})).toBe('NETWORK');
  });

  it('classifies invalid redirect URL as off-domain', () => {
    expect(
      classifySigmaHttpFailure({
        redirectUrl: 'not-a-valid-url',
      }),
    ).toBe('OFF_DOMAIN_REDIRECT');
  });
});
