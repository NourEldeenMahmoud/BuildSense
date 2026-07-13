import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCategoryPage } from '../packages/sigma-adapter/dist/parse-category-page.js';
import { parseProductPage } from '../packages/sigma-adapter/dist/parse-product-page.js';
import { SIGMA_CATEGORY_SEEDS } from '../packages/sigma-adapter/dist/category-seeds.js';

const fixtureRoot = resolve('fixtures/sigma');
const categoryDirectory = join(fixtureRoot, 'category-pages');
const productDirectory = join(fixtureRoot, 'product-pages');

function fixtureFiles(directory) {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.html'))
    .sort();
}

function categorySourceUrl(file, categoryName) {
  const seedId = '9f503b67-b433-4434-8879-ebd003dce713';
  if (file === 'cpu-category-page-2.html') {
    return `https://www.sigma-computer.com/en/category/${seedId}?page=2`;
  }
  if (file === 'cpu-category-page-8.html') {
    return `https://www.sigma-computer.com/en/category/${seedId}?page=8`;
  }
  const seed = SIGMA_CATEGORY_SEEDS.find((category) => category.name === categoryName);
  return seed ? `https://www.sigma-computer.com${seed.url}` : null;
}

const categories = fixtureFiles(categoryDirectory).map((file) => {
  const html = readFileSync(join(categoryDirectory, file), 'utf-8');
  const parsed = parseCategoryPage(html);

  return {
    file: `category-pages/${file}`,
    sourceUrl: categorySourceUrl(file, parsed.breadcrumb.at(-1)?.label),
    sizeBytes: statSync(join(categoryDirectory, file)).size,
    categoryName: parsed.breadcrumb.at(-1)?.label ?? null,
    productsCount: parsed.products.length,
    pagination: parsed.pagination,
  };
});

const products = fixtureFiles(productDirectory).map((file) => {
  const html = readFileSync(join(productDirectory, file), 'utf-8');
  const parsed = parseProductPage(html);
  if (!parsed) throw new Error(`Unable to parse ${file}`);

  const { product } = parsed;
  return {
    file: `product-pages/${file}`,
    sourceUrl: `https://www.sigma-computer.com/en/item?id=${product.slug}`,
    sizeBytes: statSync(join(productDirectory, file)).size,
    productName: product.name,
    brand: product.brand?.name ?? null,
    category: product.category.name,
    price: product.price.current,
    currency: product.price.currency,
    isStock: product.is_stock,
    isDiscount: product.is_discount,
    hasVariantAttributes: product.variant_attributes !== null,
    subProductsCount: product.sub_products.length,
    specLabelsFound: product.specifications.map((specification) => specification.name),
  };
});

const manifest = {
  version: '1.1.0',
  capturedAt: new Date().toISOString(),
  categories,
  products,
};

writeFileSync(join(fixtureRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
