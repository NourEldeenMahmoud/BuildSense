// ---------------------------------------------------------------------------
// Form factor value normalization aliases — compatibility-scoped
// ---------------------------------------------------------------------------

/** Form factor value normalization aliases. */
export const FORM_FACTOR_ALIASES: ReadonlyMap<string, string> = new Map([
  ['micro atx', 'Micro-ATX'],
  ['matx', 'Micro-ATX'],
  ['m-atx', 'Micro-ATX'],
  ['micro-atx', 'Micro-ATX'],
  ['microatx', 'Micro-ATX'],
  ['mini itx', 'Mini-ITX'],
  ['minitx', 'Mini-ITX'],
  ['mini-itx', 'Mini-ITX'],
  ['miniitx', 'Mini-ITX'],
  ['e-atx', 'E-ATX'],
  ['eatx', 'E-ATX'],
  ['extended atx', 'E-ATX'],
  ['atx', 'ATX'],
  ['flex atx', 'Flex-ATX'],
  ['flex-atx', 'Flex-ATX'],
  ['flexatx', 'Flex-ATX'],
  ['midi tower', 'ATX'],
  ['mid tower', 'ATX'],
  ['full tower', 'ATX'],
]);

/** Known form factor label variants. */
export const FORM_FACTOR_LABELS: readonly string[] = [
  'Form Factor',
  'Size',
  'Motherboard Form Factor',
];

/** Label aliases for form factor. */
export const FORM_FACTOR_LABEL_ALIASES: ReadonlyMap<string, string> = new Map([
  ['size', 'Form Factor'],
  ['mb form factor', 'Form Factor'],
  ['motherboard form factor', 'Form Factor'],
]);
