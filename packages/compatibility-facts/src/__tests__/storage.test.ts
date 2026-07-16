import { describe, it, expect } from 'vitest';
import { extractStorageFacts } from '../extractors/storage.js';
import {
  SAMSUNG_990_PRO,
  CRUCIAL_MX500,
  WD_BLACK_SN850X,
  EMPTY_STORAGE,
  PCIE_STORAGE,
  CONFLICT_IFACE_STORAGE,
} from '../__fixtures__/storage.js';

describe('extractStorageFacts', () => {
  it('extracts NVMe M.2 from Samsung 990 Pro', () => {
    const result = extractStorageFacts(SAMSUNG_990_PRO);

    expect(result.category).toBe('Storage');
    expect(result.extractorVersion).toBe('storage/v1.0.0');

    expect(result.facts.find((f) => f.key === 'storage.interface')?.value).toBe('NVMe');
    expect(result.facts.find((f) => f.key === 'storage.formFactor')?.value).toBe('M.2 2280');
  });

  it('normalizes "SATA III" to "SATA"', () => {
    const result = extractStorageFacts(CRUCIAL_MX500);
    expect(result.facts.find((f) => f.key === 'storage.interface')?.value).toBe('SATA');
    expect(result.facts.find((f) => f.key === 'storage.formFactor')?.value).toBe('2.5"');
  });

  it('normalizes "PCIe Gen 4" to "PCIe"', () => {
    const result = extractStorageFacts(PCIE_STORAGE);
    expect(result.facts.find((f) => f.key === 'storage.interface')?.value).toBe('PCIe');
    expect(result.facts.find((f) => f.key === 'storage.formFactor')?.value).toBe('3.5"');
  });

  it('uses "Protocol" label alias for interface', () => {
    const result = extractStorageFacts(WD_BLACK_SN850X);
    expect(result.facts.find((f) => f.key === 'storage.interface')?.value).toBe('NVMe');
    expect(result.facts.find((f) => f.key === 'storage.formFactor')?.value).toBe('M.2 2280');
  });

  it('returns null facts for empty specs', () => {
    const result = extractStorageFacts(EMPTY_STORAGE);
    expect(result.extractionIssues).toContain('No specifications found');
    expect(result.facts).toHaveLength(0);
  });

  it('does not mutate input', () => {
    const original = [...SAMSUNG_990_PRO];
    extractStorageFacts(SAMSUNG_990_PRO);
    expect(SAMSUNG_990_PRO).toEqual(original);
  });

  it('returns null interface when conflicting labels disagree', () => {
    const result = extractStorageFacts(CONFLICT_IFACE_STORAGE);
    const ifaceFact = result.facts.find((f) => f.key === 'storage.interface');
    expect(ifaceFact?.value).toBeNull();
    expect(
      ifaceFact?.evidence[0]?.extractionIssues.some((i) =>
        i.includes('Conflicting'),
      ),
    ).toBe(true);
    // Form factor should still extract normally
    expect(result.facts.find((f) => f.key === 'storage.formFactor')?.value).toBe('M.2 2280');
  });
});
