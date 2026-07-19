// ---------------------------------------------------------------------------
// RAM generation value normalization aliases — compatibility-scoped
// ---------------------------------------------------------------------------

/** RAM generation value normalization aliases. */
export const GENERATION_ALIASES: ReadonlyMap<string, string> = new Map([
  ['ddr 5', 'DDR5'],
  ['ddr5', 'DDR5'],
  ['ddr 4', 'DDR4'],
  ['ddr4', 'DDR4'],
  ['ddr 3', 'DDR3'],
  ['ddr3', 'DDR3'],
  ['ddr 2', 'DDR2'],
  ['ddr2', 'DDR2'],
  ['lpddr5', 'LPDDR5'],
  ['lp ddr5', 'LPDDR5'],
  ['lpddr5x', 'LPDDR5X'],
  ['lp ddr5x', 'LPDDR5X'],
  ['lpddr4', 'LPDDR4'],
  ['lp ddr4', 'LPDDR4'],
  ['lpddr4x', 'LPDDR4X'],
  ['lp ddr4x', 'LPDDR4X'],
]);

/** Known RAM generation label variants. */
export const GENERATION_LABELS: readonly string[] = [
  'Memory Type',
  'RAM Type',
  'DDR Generation',
  'Memory Generation',
];

/** Label aliases for RAM generation. */
export const GENERATION_LABEL_ALIASES: ReadonlyMap<string, string> = new Map([
  ['ram type', 'Memory Type'],
  ['ddr generation', 'Memory Type'],
  ['memory generation', 'Memory Type'],
  ['max memory support', 'Memory Type'],
  ['maximum memory support', 'Memory Type'],
  ['type', 'Memory Type'],
]);
