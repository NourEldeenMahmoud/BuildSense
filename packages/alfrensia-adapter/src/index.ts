export { AlfrensiaScraperAdapter } from './el-alfrensia-scraper-adapter.js';
export { parseCategoryPage } from './parse-category-page.js';
export { parseProductPage } from './parse-product-page.js';
export {
  ALFRENSIA_CATEGORY_SEEDS,
  getAllCategorySeeds,
  getCategorySeedById,
} from './category-seeds.js';
export type { CategorySeed } from './category-seeds.js';
export {
  canonicalizeAlfrensiaUrl,
  isAlfrensiaProductUrl,
  isAlfrensiaCategoryUrl,
  extractProductSlugFromUrl,
  buildAlfrensiaCategoryUrl,
  buildAlfrensiaProductUrl,
} from './urls.js';
export {
  ALFRENSIA_STORE_CODE,
  ALFRENSIA_PARSER_VERSION,
  normalizeExternalId,
  isValidAlfrensiaExternalId,
} from './identity.js';
export type {
  AlfrensiaJsonLdProduct,
  AlfrensiaJsonLdOffer,
  AlfrensiaJsonLdBreadcrumb,
  AlfrensiaCategoryProduct,
} from './types.js';
