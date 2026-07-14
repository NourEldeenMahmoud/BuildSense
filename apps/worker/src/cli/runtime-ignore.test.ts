import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('runtime artifact ignore rules', () => {
  it('ignores runtime snapshot and bootstrap import outputs', () => {
    const expectedRules = [
      'fixtures/runs/',
      'fixtures/bootstrap-imports/',
      'apps/worker/fixtures/runs/',
      'apps/worker/fixtures/bootstrap-imports/',
    ];
    const gitignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf-8');
    const prettierignore = readFileSync(resolve(process.cwd(), '.prettierignore'), 'utf-8');

    for (const rule of expectedRules) {
      expect(gitignore).toContain(rule);
      expect(prettierignore).toContain(rule);
    }
    expect(prettierignore).toContain('storage/');
  });
});
