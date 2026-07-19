/**
 * Parse an EGP price string into a numeric value.
 *
 * Handles formats observed on El Nour Tech:
 * - Arabic-Indic numerals: ٣٬٤٩٩
 * - Western with grouping: 3,499.00
 * - Mixed: ٣,٤٩٩
 * - Plain: 3499
 * - With currency: 3,499.00 EGP
 */
export function parseEgpPrice(priceText: string | null | undefined): number | null {
  if (priceText == null) return null;
  const trimmed = priceText.trim();
  if (trimmed.length === 0) return null;

  // Strip currency symbols and labels
  let cleaned = trimmed
    .replace(/EGP/gi, '')
    .replace(/ج\.م/g, '')
    .replace(/جنيه/g, '')
    .trim();

  // Normalize Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Western
  cleaned = cleaned.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

  // Handle European-style format: 6.999,00 (period=thousands, comma=decimal)
  // If both period and comma exist and comma is after the last period, it's European
  const lastPeriod = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastPeriod >= 0 && lastComma > lastPeriod) {
    // European: remove periods (grouping), replace comma with period (decimal)
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0 && lastPeriod > lastComma) {
    // Western: 1,234.56 — remove commas (grouping)
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma >= 0 && lastPeriod < 0) {
    // Only commas: could be grouping (1,234) or decimal (1,23)
    // If exactly one comma followed by 2 digits, treat as decimal
    const commaDecimalMatch = cleaned.match(/,(\d{1,2})$/);
    if (commaDecimalMatch) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastPeriod >= 0 && lastComma < 0) {
    // Only periods: could be grouping (1.234), decimal (1.5), or both (1.234.567)
    const periodCount = (cleaned.match(/\./g) ?? []).length;
    if (periodCount > 1) {
      // Multiple periods = all are grouping
      cleaned = cleaned.replace(/\./g, '');
    }
    // Single period: leave as-is (could be decimal like 3499.00)
  }

  // Remove remaining grouping characters (Arabic thousands separator ٬)
  cleaned = cleaned.replace(/٬/g, '');

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a price range string like "6.999,00 – 8.499,00" and return the lower bound.
 */
export function parseEgpPriceRange(priceText: string | null | undefined): number | null {
  if (priceText == null) return null;
  const trimmed = priceText.trim();
  if (trimmed.length === 0) return null;

  // Split on range separator
  const parts = trimmed.split(/\s*[-–—]\s*/);
  if (parts.length >= 2) {
    return parseEgpPrice(parts[0]);
  }

  return parseEgpPrice(trimmed);
}
