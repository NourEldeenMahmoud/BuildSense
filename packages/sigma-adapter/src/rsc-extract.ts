/**
 * Extract all RSC flight data payloads from self.__next_f.push() script tags.
 * Each push call contains a JSON array where the second element is the actual data.
 * For stringified JSON embedded within data strings, concatenates consecutive string
 * chunks (since Next.js splits large objects across multiple push calls) and then
 * extracts embedded JSON objects so deep traversal can find product data.
 */
export function extractRscPayloads(html: string): unknown[] {
  const payloads: unknown[] = [];
  const stringChunks: string[] = [];
  const pushMarker = 'self.__next_f.push(';
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const markerIndex = html.indexOf(pushMarker, searchFrom);
    if (markerIndex === -1) break;

    const arrayStart = findJsonArrayStart(html, markerIndex + pushMarker.length);
    if (arrayStart === -1) {
      searchFrom = markerIndex + pushMarker.length;
      continue;
    }

    const arrayEnd = findMatchingBracket(html, arrayStart);
    if (arrayEnd === -1) {
      searchFrom = arrayStart + 1;
      continue;
    }

    try {
      const parsed: unknown = JSON.parse(html.slice(arrayStart, arrayEnd + 1));
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const data = parsed[1];
        payloads.push(data);

        if (typeof data === 'string') {
          stringChunks.push(data);
        }
      }
    } catch {
      // Skip malformed chunks
    }

    searchFrom = arrayEnd + 1;
  }

  // Concatenate all string chunks and extract embedded JSON objects
  if (stringChunks.length > 0) {
    const combined = stringChunks.join('');
    extractEmbeddedJson(combined, payloads);
  }

  return payloads;
}

function findJsonArrayStart(value: string, start: number): number {
  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (character === '[') return index;
    if (character && !/\s/.test(character)) return -1;
  }

  return -1;
}

function findMatchingBracket(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = start; index < value.length; index++) {
    const character = value[index];
    if (character === undefined) break;

    if (escape) {
      escape = false;
      continue;
    }

    if (inString && character === '\\') {
      escape = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === '[') depth++;
    if (character === ']') {
      depth--;
      if (depth === 0) return index;
    }
  }

  return -1;
}

/**
 * Find and parse JSON objects embedded within a string.
 * Next.js RSC flight data splits large objects across multiple push calls,
 * so we concatenate all string chunks first, then scan for complete JSON objects.
 */
function extractEmbeddedJson(str: string, results: unknown[]): void {
  let i = 0;
  while (i < str.length) {
    if (str[i] === '{') {
      const end = findMatchingBrace(str, i);
      if (end === -1) {
        i++;
        continue;
      }

      const candidate = str.slice(i, end + 1);
      if (candidate.length >= 20) {
        try {
          const obj = JSON.parse(candidate);
          if (typeof obj === 'object' && obj !== null) {
            results.push(obj);
          }
        } catch {
          // Not valid JSON, skip
        }
      }

      i = end + 1;
    } else {
      i++;
    }
  }
}

/**
 * Find the matching closing brace for an opening brace at position `start`.
 * Respects string escaping and nested braces.
 */
function findMatchingBrace(str: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i]!;

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Recursively search a nested object/array for a property matching a predicate.
 * Returns all matching values.
 */
export function deepFindAll(obj: unknown, predicate: (value: unknown) => boolean): unknown[] {
  const results: unknown[] = [];

  function walk(node: unknown): void {
    if (node === null || node === undefined) return;
    if (predicate(node)) {
      results.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    } else if (typeof node === 'object') {
      for (const val of Object.values(node as Record<string, unknown>)) {
        walk(val);
      }
    }
  }

  walk(obj);
  return results;
}

/**
 * Find a single object in a nested structure by checking for a key-value match.
 */
export function deepFindOne(
  obj: unknown,
  key: string,
  value: unknown,
): Record<string, unknown> | null {
  const results = deepFindAll(obj, (node) => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
    return (node as Record<string, unknown>)[key] === value;
  });
  return (results[0] as Record<string, unknown>) ?? null;
}

/**
 * Find the first object in a nested structure that has a given key with a defined value.
 */
export function deepFindHasKey(obj: unknown, key: string): Record<string, unknown> | null {
  const results = deepFindAll(obj, (node) => {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) return false;
    return key in (node as Record<string, unknown>);
  });
  return (results[0] as Record<string, unknown>) ?? null;
}
