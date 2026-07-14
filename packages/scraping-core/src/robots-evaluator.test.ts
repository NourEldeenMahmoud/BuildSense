import { describe, it, expect, vi, afterEach } from 'vitest';
import { evaluateRobotsPolicy, evaluateDisallowRules } from './robots-evaluator.js';

describe('evaluateDisallowRules', () => {
  it('returns false when no rules exist', () => {
    const text = 'User-agent: *\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('returns false when Disallow is empty (allows everything)', () => {
    const text = 'User-agent: *\nDisallow:\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('returns true when Disallow matches the path prefix', () => {
    const text = 'User-agent: *\nDisallow: /en/\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(true);
  });

  it('returns false when Disallow does not match the path', () => {
    const text = 'User-agent: *\nDisallow: /admin/\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('Allow overrides Disallow for the same path prefix', () => {
    const text = 'User-agent: *\nDisallow: /en/\nAllow: /en/category/\n';
    // /en/category/ matches Allow, so not disallowed
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('specific user-agent section overrides * section', () => {
    const text = [
      'User-agent: *',
      'Disallow: /en/',
      '',
      'User-agent: BuildSense/0.1',
      'Allow: /',
    ].join('\n');
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('specific user-agent section disallows while * allows', () => {
    const text = [
      'User-agent: *',
      'Allow: /',
      '',
      'User-agent: BadBot',
      'Disallow: /',
    ].join('\n');
    // Our agent is BuildSense, which falls back to * which allows everything
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
    // BadBot should be denied
    expect(evaluateDisallowRules(text, 'BadBot', ['/en/category/cpu'])).toBe(true);
  });

  it('handles case-insensitive user-agent matching', () => {
    const text = 'User-agent: buildsense/0.1\nDisallow: /en/\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(true);
  });

  it('ignores comments in robots.txt', () => {
    const text = 'User-agent: *\n# This is a comment\nDisallow: /admin/\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });

  it('returns false when no relevant section exists', () => {
    const text = 'User-agent: Googlebot\nDisallow: /\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/'])).toBe(false);
  });

  it('handles multiple Disallow rules', () => {
    const text = 'User-agent: *\nDisallow: /admin/\nDisallow: /private/\n';
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/admin/secret'])).toBe(true);
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/private/data'])).toBe(true);
    expect(evaluateDisallowRules(text, 'BuildSense/0.1', ['/en/category/cpu'])).toBe(false);
  });
});

describe('evaluateRobotsPolicy', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns NOT_FOUND when robots.txt returns 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('NOT_FOUND');
    expect(result.reason).toContain('404');
  });

  it('returns DENIED when robots.txt returns 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '',
    });

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('DENIED');
    expect(result.reason).toContain('403');
  });

  it('returns DENIED on network error (fail-closed)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('DENIED');
    expect(result.reason).toContain('network error');
  });

  it('returns DENIED on timeout (fail-closed)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted'));

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('DENIED');
    expect(result.reason).toContain('network error');
  });

  it('returns ALLOWED when robots.txt permits crawling', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nAllow: /\n',
    });

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('ALLOWED');
  });

  it('returns DENIED when robots.txt disallows our paths', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nDisallow: /en/\n',
    });

    const result = await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(result.decision).toBe('DENIED');
  });

  it('fetches the correct robots.txt URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'User-agent: *\nDisallow:\n',
    });
    globalThis.fetch = mockFetch;

    await evaluateRobotsPolicy({
      baseUrl: 'https://www.sigma-computer.com/',
      userAgent: 'BuildSense/0.1.0',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.sigma-computer.com/robots.txt',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'BuildSense/0.1.0',
        }),
      }),
    );
  });
});
