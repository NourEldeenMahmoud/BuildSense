import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCategoryPage } from './parse-category-page.js';
import { parseProductPage } from './parse-product-page.js';

const FIXTURES = resolve(import.meta.dirname ?? '.', '../../../fixtures/sigma');
const categoryFixtures = readdirSync(resolve(FIXTURES, 'category-pages'))
  .filter((file) => file.endsWith('.html'))
  .sort();
const productFixtures = readdirSync(resolve(FIXTURES, 'product-pages'))
  .filter((file) => file.endsWith('.html'))
  .sort();

function loadFixture(directory: string, file: string): string {
  return readFileSync(resolve(FIXTURES, directory, file), 'utf-8');
}

describe('Sigma fixture regression', () => {
  it.each(categoryFixtures)('preserves the category parser output for %s', (file) => {
    expect(parseCategoryPage(loadFixture('category-pages', file))).toMatchSnapshot();
  });

  it.each(productFixtures)('preserves the product parser output for %s', (file) => {
    expect(parseProductPage(loadFixture('product-pages', file))).toMatchSnapshot();
  });
});
