/**
 * Guarded localStorage helpers for build recovery.
 *
 * Only stores the latest successful build publicId (a string).
 * No build data, no DTOs, no snapshots.
 * All access is guarded for SSR/test safety (typeof window check).
 */

const STORAGE_KEY = 'buildsense:latestBuildId';

/** Check if localStorage is available (not SSR, not test jsdom with no window). */
function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage !== undefined;
  } catch {
    return false;
  }
}

/**
 * Retrieve the last successfully loaded build publicId.
 * Returns null if unavailable (SSR, test, or never saved).
 */
export function getLatestBuildId(): string | null {
  if (!isStorageAvailable()) {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the latest successfully loaded build publicId.
 * Silently no-ops if localStorage is unavailable.
 */
export function setLatestBuildId(id: string): void {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Silently ignore — storage quota or private browsing.
  }
}

/**
 * Clear the latest build ID from storage.
 * Used when a saved ID returns 404 to avoid infinite recovery loops.
 */
export function clearLatestBuildId(): void {
  if (!isStorageAvailable()) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}
