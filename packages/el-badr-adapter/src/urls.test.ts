import { describe, it, expect } from 'vitest';
import {
  canonicalizeElBadrUrl,
  isElBadrProductUrl,
  isElBadrCategoryUrl,
  extractProductSlugFromUrl,
  buildElBadrCategoryUrl,
  buildElBadrProductUrl,
} from './urls.js';

const EL_BADR_HOST = 'elbadrgroupeg.store';

describe('El Badr URLs', () => {
  describe('canonicalizeElBadrUrl', () => {
    it('strips tracking parameters', () => {
      const url = new URL('https://elbadrgroupeg.store/cpu?utm_source=facebook&page=2');
      const result = canonicalizeElBadrUrl(url);
      expect(result).toBe('https://elbadrgroupeg.store/cpu?page=2');
    });

    it('preserves clean URLs', () => {
      const url = new URL('https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor');
      const result = canonicalizeElBadrUrl(url);
      expect(result).toBe('https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor');
    });
  });

  describe('isElBadrProductUrl', () => {
    it('identifies clean product URLs', () => {
      const url = new URL('https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor');
      expect(isElBadrProductUrl(url, EL_BADR_HOST)).toBe(true);
    });

    it('rejects category URLs', () => {
      const url = new URL('https://elbadrgroupeg.store/cpu');
      expect(isElBadrProductUrl(url, EL_BADR_HOST)).toBe(true); // Single segment, not excluded
    });

    it('rejects root URL', () => {
      const url = new URL('https://elbadrgroupeg.store/');
      expect(isElBadrProductUrl(url, EL_BADR_HOST)).toBe(false);
    });

    it('rejects wrong host', () => {
      const url = new URL('https://evil.com/product');
      expect(isElBadrProductUrl(url, EL_BADR_HOST)).toBe(false);
    });
  });

  describe('isElBadrCategoryUrl', () => {
    it('identifies OpenCart category URLs', () => {
      const url = new URL('https://elbadrgroupeg.store/index.php?route=product/category&path=107_20');
      expect(isElBadrCategoryUrl(url, EL_BADR_HOST)).toBe(true);
    });

    it('rejects non-category URLs', () => {
      const url = new URL('https://elbadrgroupeg.store/cpu');
      expect(isElBadrCategoryUrl(url, EL_BADR_HOST)).toBe(false);
    });
  });

  describe('extractProductSlugFromUrl', () => {
    it('extracts product slug', () => {
      const url = new URL('https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor');
      expect(extractProductSlugFromUrl(url)).toBe('amd-ryzen-5-8600g-tray-desktop-processor');
    });
  });

  describe('buildElBadrCategoryUrl', () => {
    it('builds category URL', () => {
      const result = buildElBadrCategoryUrl('https://elbadrgroupeg.store', 'cpu');
      expect(result).toBe('https://elbadrgroupeg.store/cpu');
    });
  });

  describe('buildElBadrProductUrl', () => {
    it('builds product URL', () => {
      const result = buildElBadrProductUrl('https://elbadrgroupeg.store', 'amd-ryzen-5-8600g-tray-desktop-processor');
      expect(result).toBe('https://elbadrgroupeg.store/amd-ryzen-5-8600g-tray-desktop-processor/');
    });
  });
});
