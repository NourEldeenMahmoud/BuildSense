import type { StoreCode } from '@buildsense/contracts';

export const EL_BADR_PARSER_VERSION = '0.1.0';

export const EL_BADR_STORE_CODE: StoreCode = 'EL_BADR';

const NUMERIC_ID_REGEX = /^\d+$/;

export function isValidElBadrExternalId(id: string | null): id is string {
  return id !== null && NUMERIC_ID_REGEX.test(id);
}

export function normalizeExternalId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  return NUMERIC_ID_REGEX.test(trimmed) ? trimmed : null;
}
