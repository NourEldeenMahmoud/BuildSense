import { describe, it, expect } from 'vitest';
import {
  EXPECTED_FACT_KEYS,
  TOTAL_EXPECTED_FACT_KEYS,
  SUPPORTED_CATEGORIES,
  EXTRACTOR_VERSIONS,
} from '../types.js';
import { extractFacts } from '../dispatcher.js';

// ---------------------------------------------------------------------------
// Test: Matrix consistency — exactly 31 plan keys
// ---------------------------------------------------------------------------

describe('EXPECTED_FACT_KEYS matrix consistency', () => {
  it('has exactly 31 total fact keys across all categories', () => {
    expect(TOTAL_EXPECTED_FACT_KEYS).toBe(31);
    expect(Object.values(EXPECTED_FACT_KEYS).flat()).toHaveLength(31);
  });

  it('has exactly 7 supported categories', () => {
    expect(SUPPORTED_CATEGORIES).toHaveLength(7);
    expect(Object.keys(EXPECTED_FACT_KEYS)).toEqual(SUPPORTED_CATEGORIES);
  });

  it('each category has a version in EXTRACTOR_VERSIONS', () => {
    for (const category of SUPPORTED_CATEGORIES) {
      expect(EXTRACTOR_VERSIONS[category]).toBeDefined();
      expect(typeof EXTRACTOR_VERSIONS[category]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// Test: Each extractor emits exactly its category's expected keys
// ---------------------------------------------------------------------------

describe('extractor key coverage', () => {
  // Representative input with all known labels for each category
  const REPRESENTATIVE_INPUTS: Record<string, Array<{ label: string; value: string }>> = {
    CPU: [
      { label: 'Socket', value: 'Socket AM5' },
      { label: 'Family', value: 'Ryzen 7' },
      { label: 'Integrated Graphics', value: 'None' },
      { label: 'TDP', value: '170W' },
    ],
    Motherboard: [
      { label: 'Socket', value: 'Socket AM5' },
      { label: 'Chipset', value: 'B650E' },
      { label: 'Form Factor', value: 'ATX' },
      { label: 'Memory Type', value: 'DDR5 DIMM' },
      { label: 'Memory Slots', value: '4' },
      { label: 'Max Memory', value: '128 GB' },
      { label: 'Max Memory Speed', value: '5600 MHz' },
      { label: 'SATA Ports', value: '6' },
      { label: 'M.2 Slots', value: '2' },
      { label: 'M.2 Form Factors', value: '2280, 2242' },
    ],
    RAM: [
      { label: 'Type', value: 'DDR5' },
      { label: 'Form Factor', value: 'DIMM' },
      { label: 'Modules', value: '2' },
      { label: 'Capacity', value: '32 GB' },
      { label: 'Speed', value: '5600 MHz' },
    ],
    GPU: [
      { label: 'Length', value: '300 mm' },
      { label: 'Slot Width', value: '2.5' },
      { label: 'Power Connectors', value: '1x 12VHPWR' },
      { label: 'Board Power', value: '250W' },
    ],
    Storage: [
      { label: 'Interface', value: 'NVMe PCIe 4.0' },
      { label: 'Form Factor', value: 'M.2 2280' },
    ],
    PSU: [
      { label: 'Wattage', value: '850W' },
    ],
    Case: [
      { label: 'Motherboard Support', value: 'ATX, Micro-ATX' },
      { label: 'Max GPU Length', value: '360 mm' },
      { label: 'Expansion Slots', value: '7' },
    ],
  };

  for (const category of SUPPORTED_CATEGORIES) {
    it(`${category} extractor emits exactly its expected keys for representative input`, () => {
      const input = REPRESENTATIVE_INPUTS[category];
      expect(input).toBeDefined();

      const result = extractFacts(category, input!);

      // Extract all non-null fact keys
      const emittedKeys = result.facts
        .filter((f) => f.value !== null)
        .map((f) => f.key);

      // Should match exactly the expected keys
      expect(emittedKeys.sort()).toEqual([...EXPECTED_FACT_KEYS[category] ?? []].sort());
    });
  }
});
