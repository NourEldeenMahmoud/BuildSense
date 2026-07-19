import { describe, it, expect } from 'vitest';
import {
  extractFacts,
  isSupportedCategory,
  getExtractorVersion,
  SUPPORTED_CATEGORIES,
} from '../dispatcher.js';
import { RYZEN_7700X } from '../__fixtures__/cpu.js';
import { B650E_F } from '../__fixtures__/motherboard.js';
import { DDR5_5600_32GB } from '../__fixtures__/ram.js';
import { RTX_4070_TI } from '../__fixtures__/gpu.js';
import { SAMSUNG_990_PRO } from '../__fixtures__/storage.js';
import { CORSAIR_RM850X } from '../__fixtures__/psu.js';
import { NZXT_H7_FLOW } from '../__fixtures__/case.js';

describe('dispatcher', () => {
  it('routes CPU category correctly', () => {
    const result = extractFacts('CPU', RYZEN_7700X);
    expect(result.category).toBe('CPU');
    expect(result.extractorVersion).toBe('cpu/v1.0.0');
    expect(result.facts.length).toBeGreaterThan(0);
  });

  it('routes Motherboard category correctly', () => {
    const result = extractFacts('Motherboard', B650E_F);
    expect(result.category).toBe('Motherboard');
    expect(result.extractorVersion).toBe('mb/v1.1.0');
  });

  it('routes RAM category correctly', () => {
    const result = extractFacts('RAM', DDR5_5600_32GB);
    expect(result.category).toBe('RAM');
    expect(result.extractorVersion).toBe('ram/v1.0.0');
  });

  it('routes GPU category correctly', () => {
    const result = extractFacts('GPU', RTX_4070_TI);
    expect(result.category).toBe('GPU');
    expect(result.extractorVersion).toBe('gpu/v1.2.0');
  });

  it('routes Storage category correctly', () => {
    const result = extractFacts('Storage', SAMSUNG_990_PRO);
    expect(result.category).toBe('Storage');
    expect(result.extractorVersion).toBe('storage/v1.0.0');
  });

  it('routes PSU category correctly', () => {
    const result = extractFacts('PSU', CORSAIR_RM850X);
    expect(result.category).toBe('PSU');
    expect(result.extractorVersion).toBe('psu/v1.0.0');
  });

  it('routes Case category correctly', () => {
    const result = extractFacts('Case', NZXT_H7_FLOW);
    expect(result.category).toBe('Case');
    expect(result.extractorVersion).toBe('case/v1.0.0');
  });

  it('returns extractionIssues for unknown category', () => {
    const result = extractFacts('Cooler', []);
    expect(result.extractionIssues).toContain('Unknown category: "Cooler"');
    expect(result.facts).toHaveLength(0);
  });

  it('isSupportedCategory returns true for all seven categories', () => {
    expect(isSupportedCategory('CPU')).toBe(true);
    expect(isSupportedCategory('Motherboard')).toBe(true);
    expect(isSupportedCategory('RAM')).toBe(true);
    expect(isSupportedCategory('GPU')).toBe(true);
    expect(isSupportedCategory('Storage')).toBe(true);
    expect(isSupportedCategory('PSU')).toBe(true);
    expect(isSupportedCategory('Case')).toBe(true);
    expect(isSupportedCategory('Cooler')).toBe(false);
  });

  it('getExtractorVersion returns correct versions', () => {
    expect(getExtractorVersion('CPU')).toBe('cpu/v1.0.0');
    expect(getExtractorVersion('Motherboard')).toBe('mb/v1.1.0');
    expect(getExtractorVersion('Unknown')).toBeUndefined();
  });

  it('SUPPORTED_CATEGORIES lists all seven', () => {
    expect(SUPPORTED_CATEGORIES).toHaveLength(7);
    expect(SUPPORTED_CATEGORIES).toContain('CPU');
    expect(SUPPORTED_CATEGORIES).toContain('Motherboard');
    expect(SUPPORTED_CATEGORIES).toContain('RAM');
    expect(SUPPORTED_CATEGORIES).toContain('GPU');
    expect(SUPPORTED_CATEGORIES).toContain('Storage');
    expect(SUPPORTED_CATEGORIES).toContain('PSU');
    expect(SUPPORTED_CATEGORIES).toContain('Case');
  });
});
