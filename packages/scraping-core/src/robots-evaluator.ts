export type RobotsDecision = 'ALLOWED' | 'DENIED' | 'NOT_FOUND';

export interface RobotsEvalInput {
  baseUrl: string;
  userAgent: string;
  /** Paths to check against Disallow rules. If any is disallowed, result is DENIED. */
  pathsToCheck?: string[];
}

export interface RobotsEvalResult {
  decision: RobotsDecision;
  reason: string;
}

const DEFAULT_PATHS_TO_CHECK = ['/', '/en/'];

/**
 * Fetch and evaluate robots.txt for a given domain.
 *
 * Decision semantics (from ADR-003):
 * - ALLOWED: robots.txt exists and permits our user-agent for the paths we crawl.
 * - DENIED: robots.txt exists and disallows our user-agent for the paths we crawl,
 *          OR transport error prevents verification (fail-closed).
 * - NOT_FOUND: robots.txt returns 404 (no restrictions apply).
 */
export async function evaluateRobotsPolicy(
  input: RobotsEvalInput,
): Promise<RobotsEvalResult> {
  const robotsUrl = stripTrailingSlash(input.baseUrl) + '/robots.txt';
  const paths = input.pathsToCheck ?? DEFAULT_PATHS_TO_CHECK;

  let text: string;
  try {
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': input.userAgent,
        'Accept': 'text/plain',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404) {
      return { decision: 'NOT_FOUND', reason: 'robots.txt returned 404' };
    }

    if (!response.ok) {
      // 401, 403, 5xx etc. — fail-closed
      return {
        decision: 'DENIED',
        reason: `robots.txt fetch failed with HTTP ${response.status}`,
      };
    }

    text = await response.text();
  } catch {
    // Network error, timeout, DNS failure — fail-closed
    return {
      decision: 'DENIED',
      reason: 'robots.txt fetch failed (network error or timeout)',
    };
  }

  const disallowed = evaluateDisallowRules(text, input.userAgent, paths);
  if (disallowed) {
    return {
      decision: 'DENIED',
      reason: `robots.txt disallows crawling for user-agent "${input.userAgent}"`,
    };
  }

  return { decision: 'ALLOWED', reason: 'robots.txt permits crawling' };
}

/**
 * Parse a minimal subset of robots.txt and check if any of the given paths
 * would be disallowed for the given user-agent.
 *
 * Rules evaluated:
 * 1. A User-agent section matching our agent (or `*`) applies.
 * 2. A specific User-agent match overrides the `*` section.
 * 3. If a Disallow rule matches any of the paths, return true (disallowed).
 * 4. An Allow rule for the same path overrides Disallow (Allow wins ties).
 * 5. Empty Disallow = allow everything.
 */
export function evaluateDisallowRules(
  text: string,
  userAgent: string,
  paths: string[],
): boolean {
  const sections = parseRobotSections(text);

  // Find the most specific section for our user-agent
  const agentLower = userAgent.toLowerCase();
  let matchedSection: RobotSection | undefined;

  for (const section of sections) {
    const sectionAgents = section.userAgents.map((a) => a.toLowerCase());
    if (sectionAgents.includes(agentLower)) {
      matchedSection = section;
      break; // First specific match wins
    }
  }

  // Fall back to wildcard section if no specific match
  if (!matchedSection) {
    for (const section of sections) {
      if (section.userAgents.includes('*')) {
        matchedSection = section;
        break;
      }
    }
  }

  if (!matchedSection) {
    // No relevant section found — default is allowed
    return false;
  }

  // Check if any path is disallowed
  for (const path of paths) {
    const isDisallowed = isPathDisallowed(matchedSection, path);
    if (isDisallowed) {
      return true;
    }
  }

  return false;
}

interface RobotSection {
  userAgents: string[];
  rules: Array<{ directive: 'allow' | 'disallow'; path: string }>;
}

function parseRobotSections(text: string): RobotSection[] {
  const lines = text.split(/\r?\n/);
  const sections: RobotSection[] = [];
  let current: RobotSection | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim(); // strip comments
    if (line === '') continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'user-agent') {
      if (current !== null) {
        sections.push(current);
      }
      current = { userAgents: [value], rules: [] };
    } else if (current !== null) {
      if (key === 'disallow') {
        current.rules.push({ directive: 'disallow', path: value });
      } else if (key === 'allow') {
        current.rules.push({ directive: 'allow', path: value });
      }
    }
    // All other directives (Sitemap, Crawl-delay, etc.) are ignored
  }

  if (current !== null) {
    sections.push(current);
  }

  return sections;
}

function isPathDisallowed(section: RobotSection, path: string): boolean {
  let disallowed = false;

  for (const rule of section.rules) {
    if (rule.path === '') continue; // Empty disallow = allow everything

    if (path.startsWith(rule.path)) {
      if (rule.directive === 'disallow') {
        disallowed = true;
      } else if (rule.directive === 'allow') {
        disallowed = false; // Allow overrides Disallow
      }
    }
  }

  return disallowed;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
