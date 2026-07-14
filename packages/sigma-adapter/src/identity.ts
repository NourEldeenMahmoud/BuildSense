export const SIGMA_PARSER_VERSION = '0.1.0';

export const SIGMA_STORE_CODE = 'SIGMA' as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSigmaExternalId(id: string | null): id is string {
  return id !== null && UUID_REGEX.test(id);
}

export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  return UUID_REGEX.test(trimmed) ? trimmed.toLowerCase() : null;
}
