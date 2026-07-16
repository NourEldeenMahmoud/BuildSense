// ---------------------------------------------------------------------------
// Storage interface value normalization aliases — compatibility-scoped
// ---------------------------------------------------------------------------

/** Storage interface value normalization aliases. */
export const INTERFACE_ALIASES: ReadonlyMap<string, string> = new Map([
  ['sata iii', 'SATA'],
  ['sata ii', 'SATA'],
  ['sata i', 'SATA'],
  ['sata 6gbps', 'SATA'],
  ['sata 3gbps', 'SATA'],
  ['nvme pcie 4.0', 'NVMe'],
  ['nvme pcie 3.0', 'NVMe'],
  ['nvme pcie 5.0', 'NVMe'],
  ['nvme', 'NVMe'],
  ['pcie gen 4', 'PCIe'],
  ['pcie gen 3', 'PCIe'],
  ['pcie gen 5', 'PCIe'],
  ['pcie', 'PCIe'],
  ['pcie nvme', 'NVMe'],
]);

/** Known storage interface label variants. */
export const INTERFACE_LABELS: readonly string[] = [
  'Interface',
  'Storage Interface',
  'Connection',
  'Protocol',
];

/** Label aliases for storage interface. */
export const INTERFACE_LABEL_ALIASES: ReadonlyMap<string, string> = new Map([
  ['storage interface', 'Interface'],
  ['connection', 'Interface'],
  ['protocol', 'Interface'],
]);
