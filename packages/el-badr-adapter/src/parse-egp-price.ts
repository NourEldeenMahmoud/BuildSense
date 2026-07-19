/**
 * Parse an EGP price string into a numeric value.
 *
 * Handles formats observed on El Badr Group:
 * - Western with grouping: 8,299.00
 * - Plain: 8299
 * - With currency: 8,299.00 EGP
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
    .replace(/Ex\s*Tax:/gi, '')
    .trim();

  // Normalize Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) to Western
  cleaned = cleaned.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

  // Handle European-style format: 6.999,00 (period=thousands, comma=decimal)
  const lastPeriod = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastPeriod >= 0 && lastComma > lastPeriod) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0 && lastPeriod > lastComma) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma >= 0 && lastPeriod < 0) {
    const commaDecimalMatch = cleaned.match(/,(\d{1,2})$/);
    if (commaDecimalMatch) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastPeriod >= 0 && lastComma < 0) {
    const periodCount = (cleaned.match(/\./g) ?? []).length;
    if (periodCount > 1) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  // Remove remaining grouping characters (Arabic thousands separator ٬)
  cleaned = cleaned.replace(/٬/g, '');

  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}
