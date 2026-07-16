// ---------------------------------------------------------------------------
// Socket value normalization aliases — compatibility-scoped
// ---------------------------------------------------------------------------

/** Socket value normalization aliases. */
export const SOCKET_ALIASES: ReadonlyMap<string, string> = new Map([
  ['socket am5', 'AM5'],
  ['am5', 'AM5'],
  ['socket tr5', 'sTR5'],
  ['str5', 'sTR5'],
  ['socket trx40', 'sTRX4'],
  ['trx40', 'sTRX4'],
  ['lga1700', 'LGA1700'],
  ['lga 1700', 'LGA1700'],
  ['socket am4', 'AM4'],
  ['am4', 'AM4'],
  ['lga1200', 'LGA1200'],
  ['lga 1200', 'LGA1200'],
  ['lga1151', 'LGA1151'],
  ['lga 1151', 'LGA1151'],
  ['lga1150', 'LGA1150'],
  ['lga 1150', 'LGA1150'],
  ['lga2066', 'LGA2066'],
  ['lga 2066', 'LGA2066'],
  ['lga4677', 'LGA4677'],
  ['lga 4677', 'LGA4677'],
]);

/** Known socket label variants. */
export const SOCKET_LABELS: readonly string[] = [
  'Socket',
  'CPU Socket',
  'Socket Type',
];

/** Label aliases for socket. */
export const SOCKET_LABEL_ALIASES: ReadonlyMap<string, string> = new Map([
  ['cpu socket', 'Socket'],
  ['socket type', 'Socket'],
  ['processor socket', 'Socket'],
]);
