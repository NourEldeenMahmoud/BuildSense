import type { StoreCode } from '@buildsense/contracts';

export const ALFRENSIA_PARSER_VERSION = '0.1.0';

export const ALFRENSIA_STORE_CODE: StoreCode = 'ALFRENSIA';

const NUMERIC_ID_REGEX = /^\d+$/;

export function isValidAlfrensiaExternalId(id: string | null): id is string {
  return id !== null && NUMERIC_ID_REGEX.test(id);
}

export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  return NUMERIC_ID_REGEX.test(trimmed) ? trimmed : null;
}
