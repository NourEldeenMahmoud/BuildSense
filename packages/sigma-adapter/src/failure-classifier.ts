import type { ScrapeFailureKind, HttpFailureInput } from '@buildsense/contracts';

const SIGMA_HOST = 'www.sigma-computer.com';

export function classifySigmaHttpFailure(input: HttpFailureInput): ScrapeFailureKind {
  const { httpStatus, contentType, message, redirectUrl } = input;

  if (redirectUrl != null) {
    try {
      const redirectHost = new URL(redirectUrl).hostname;
      if (redirectHost !== SIGMA_HOST) {
        return 'OFF_DOMAIN_REDIRECT';
      }
    } catch {
      return 'OFF_DOMAIN_REDIRECT';
    }
  }

  if (contentType != null && !contentType.includes('text/html')) {
    return 'INVALID_CONTENT_TYPE';
  }

  if (httpStatus != null) {
    if (httpStatus === 408) return 'HTTP_408';
    if (httpStatus === 429) return 'HTTP_429';
    if (httpStatus === 403) return 'BLOCKED_RESPONSE';
    if (httpStatus >= 500) return 'HTTP_5XX';
    if (httpStatus >= 400) return 'HTTP_4XX';
  }

  if (message != null) {
    const lower = message.toLowerCase();
    if (lower.includes('timeout') || lower.includes('timed out')) return 'TIMEOUT';
    if (lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('network'))
      return 'NETWORK';
  }

  return 'NETWORK';
}
