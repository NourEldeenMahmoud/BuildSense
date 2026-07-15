import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getLatestBuildId,
  setLatestBuildId,
  clearLatestBuildId,
} from './storage';

const STORAGE_KEY = 'buildsense:latestBuildId';

/**
 * In Vitest jsdom environment, localStorage is available.
 * These tests exercise the happy path and error handling.
 */
describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe('getLatestBuildId', () => {
    it('returns null when nothing is stored', () => {
      expect(getLatestBuildId()).toBeNull();
    });

    it('returns the stored public ID', () => {
      window.localStorage.setItem(STORAGE_KEY, 'abc-123');
      expect(getLatestBuildId()).toBe('abc-123');
    });

    it('returns an empty string as-is (truthful)', () => {
      window.localStorage.setItem(STORAGE_KEY, '');
      expect(getLatestBuildId()).toBe('');
    });
  });

  describe('setLatestBuildId', () => {
    it('stores the provided ID', () => {
      setLatestBuildId('uuid-456');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('uuid-456');
    });

    it('overwrites a previously stored ID', () => {
      setLatestBuildId('old-id');
      setLatestBuildId('new-id');
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('new-id');
    });
  });

  describe('clearLatestBuildId', () => {
    it('removes the stored ID', () => {
      window.localStorage.setItem(STORAGE_KEY, 'to-clear');
      clearLatestBuildId();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('is safe to call when nothing is stored', () => {
      expect(() => clearLatestBuildId()).not.toThrow();
    });
  });

  describe('SSR / unavailable storage safety', () => {
    let originalStorage: typeof window.localStorage | undefined;

    beforeEach(() => {
      originalStorage = window.localStorage;
    });

    afterEach(() => {
      if (originalStorage !== undefined) {
        Object.defineProperty(window, 'localStorage', { value: originalStorage, configurable: true });
      }
    });

    it('getLatestBuildId returns null when localStorage throws', () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => {
            throw new Error('quota exceeded');
          },
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          get length() { return 0; },
          key: () => null,
        },
        configurable: true,
      });
      expect(getLatestBuildId()).toBeNull();
    });

    it('setLatestBuildId silently ignores storage errors', () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => {
            throw new Error('quota exceeded');
          },
          removeItem: () => {},
          clear: () => {},
          get length() { return 0; },
          key: () => null,
        },
        configurable: true,
      });
      expect(() => setLatestBuildId('id')).not.toThrow();
    });

    it('clearLatestBuildId silently ignores storage errors', () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {
            throw new Error('quota exceeded');
          },
          clear: () => {},
          get length() { return 0; },
          key: () => null,
        },
        configurable: true,
      });
      expect(() => clearLatestBuildId()).not.toThrow();
    });
  });
});
