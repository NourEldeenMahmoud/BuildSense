import type { SigmaProduct, SigmaImage } from './types.js';
import type { RawProductSnapshot } from '@buildsense/contracts';
import { normalizeExternalId } from './identity.js';

type RawFields = RawProductSnapshot['raw'];

export function mapSigmaProductToRaw(
  product: SigmaProduct,
  breadcrumbs: Array<{ label: string }>,
): {
  externalId: string | null;
  raw: RawFields;
  warnings: string[];
} {
  const warnings: string[] = [];

  const externalId = normalizeExternalId(product.id);
  if (externalId === null) {
    warnings.push(`INVALID_EXTERNAL_ID: ${String(product.id)}`);
  }

  const specifications = (product.specifications ?? []).map((spec) => ({
    label: spec.name,
    value: spec.value,
  }));

  const imageUrls = (product.media ?? [])
    .filter((img: SigmaImage) => img.url != null && img.url.length > 0)
    .map((img: SigmaImage) => img.url);

  const raw: RawFields = {
    title: product.name ?? null,
    priceText: product.price?.current != null ? String(product.price.current) : null,
    oldPriceText: product.price?.base != null ? String(product.price.base) : null,
    availabilityText: product.is_stock != null ? String(product.is_stock) : null,
    skuText: product.sku ?? null,
    brandText: product.brand?.name ?? null,
    modelText: null,
    partNumberText: product.sku ?? null,
    breadcrumbs: breadcrumbs.map((b) => b.label),
    specifications,
    imageUrls,
    descriptionText: product.description ?? null,
  };

  return { externalId, raw, warnings };
}
