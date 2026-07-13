import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseProductPage } from '../packages/sigma-adapter/dist/parse-product-page.js';

const productDirectory = resolve('fixtures/sigma/product-pages');
const labels = new Map();

for (const file of readdirSync(productDirectory)
  .filter((entry) => entry.endsWith('.html'))
  .sort()) {
  const parsed = parseProductPage(readFileSync(join(productDirectory, file), 'utf-8'));
  if (!parsed) throw new Error(`Unable to parse ${file}`);

  for (const specification of parsed.product.specifications) {
    const entry = labels.get(specification.name) ?? {
      count: 0,
      categories: new Set(),
      products: new Set(),
    };
    entry.count++;
    entry.categories.add(parsed.product.category.name);
    entry.products.add(parsed.product.name);
    labels.set(specification.name, entry);
  }
}

function escapeCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const rows = ['Label,Count,Categories,ExampleProducts'];
for (const [label, entry] of [...labels.entries()].sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  rows.push(
    [
      escapeCsv(label),
      entry.count,
      escapeCsv([...entry.categories].sort().join('; ')),
      escapeCsv([...entry.products].sort().join('; ')),
    ].join(','),
  );
}

writeFileSync(resolve('docs/discovery/spec-label-inventory.csv'), `${rows.join('\n')}\n`);
