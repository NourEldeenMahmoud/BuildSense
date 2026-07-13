# Sigma Data Dictionary v0.1

**Version:** 0.1  
**Last Updated:** 13 July 2026  
**Status:** M1 discovery draft

## Scope

This dictionary records fields observed in the saved Sigma category and product responses. It describes raw source data only. It does not define BuildSense normalized entities, persistence models, compatibility types, or bundle decomposition.

## Product

Source: the product object embedded in product-page RSC data.

| Field | Observed type | Notes |
|---|---|---|
| `id` | string | Sigma UUID |
| `slug` | string | Product URL identifier used by `/en/item?id={slug}` |
| `name` | string | Source display name |
| `sku` | string | Source stock-keeping unit |
| `description` | string \| null | Null in the captured product fixtures |
| `tags` | string[] | Source tags |
| `points` | number \| null | Null on at least one captured product |
| `barcode` | string \| null | Null on captured bundles |
| `views` | ViewCounts | Total, unique, and live counters |
| `review` | ReviewSummary | Stars and review count |
| `price` | Price | Base/current price and discount metadata |
| `thumbnail` | Image | Primary source image |
| `media` | Image[] | Product media array |
| `minimum_order_count` | number | Source order constraint |
| `maximum_order_count` | number | Source order constraint |
| `warranty` | string \| null | Source warranty text |
| `seller_notes` | string \| null | Null in the captured fixtures |
| `return_policy` | string \| null | Source return-policy text |
| `seller` | unknown | Null in the captured fixtures; shape not established |
| `category` | CategoryRef | Includes a nested parent category when supplied |
| `brand` | Brand \| null | One captured bundle has a null brand |
| `vendor` | unknown | Null in the captured fixtures; shape not established |
| `specifications` | Specification[] | Raw label/value entries; may be empty |
| `is_discount` | boolean | Source discount flag |
| `is_wishlist` | boolean | Request-context wishlist flag |
| `is_stock` | boolean | Source stock flag |
| `is_best_seller` | boolean | Source merchandising flag |
| `is_featured` | boolean | Source merchandising flag |
| `is_sub_product` | boolean | Source sub-product flag |
| `variant_attributes` | unknown | Usually null; one captured SSD provides `{ "capacity": "2TB" }` |
| `sub_products` | unknown[] | Empty in all captured fixtures |
| `is_free_shipping` | boolean | Source shipping flag |

## Category Product

Source: product cards embedded in category-page RSC data.

| Field | RSC type | HTML fallback type | Notes |
|---|---|---|---|
| `id` | string | null | Sigma UUID is not available from the fallback card selector |
| `slug` | string | string | Product URL identifier |
| `name` | string | string | Source card text, falling back to the slug if blank |
| `sku` | string | null | Not available from the fallback card selector |
| `price` | Price | CategoryPrice | HTML fallback reads the displayed current value and currency; base and discount are null |
| `thumbnail` | Image | null | Not extracted by the fallback parser |
| `category` | CategoryRef | null | Not extracted by the fallback parser |
| `brand` | Brand \| null | null | Some RSC category products have null brands |
| `is_stock` | boolean | null | Unknown rather than assumed by the fallback parser |
| `is_discount` | boolean | null | Unknown rather than assumed by the fallback parser |

## Price

| Field | Observed type | Notes |
|---|---|---|
| `base` | number | Price before source discount |
| `current` | number | Current displayed price |
| `discount_percentage` | number | Source percentage |
| `currency` | string | `EGP` in all captured fixtures |

## CategoryPrice

The HTML fallback can observe only the displayed current price and optional currency text.

| Field | Type | Notes |
|---|---|---|
| `base` | number \| null | Null when the fallback cannot observe a base price |
| `current` | number | Parsed displayed value |
| `discount_percentage` | number \| null | Null when the fallback cannot observe a discount |
| `currency` | string \| null | `EGP` only when present in the displayed text |

## Image

| Field | Observed type | Notes |
|---|---|---|
| `id` | string | Sigma media UUID |
| `url` | string | Source media URL |
| `type` | string | Source MIME/media type; captured value is `image/webp` |

## CategoryRef

| Field | Observed type | Notes |
|---|---|---|
| `id` | string | Sigma category UUID |
| `slug` | string | Source category slug |
| `name` | string | Source display name |
| `is_subcategory` | boolean | Source hierarchy flag |
| `parent_category` | CategoryRef \| absent | Nested parent supplied by Sigma |

## Brand

| Field | Observed type | Notes |
|---|---|---|
| `id` | string | Sigma brand UUID |
| `name` | string | Source display name; casing is not normalized |
| `slug` | string | Source brand slug |
| `image` | Image \| null | Source brand image |
| `is_featured` | boolean | Source merchandising flag |

## Specification

| Field | Observed type | Notes |
|---|---|---|
| `id` | string | Sigma specification UUID |
| `name` | string | Raw, case-sensitive label |
| `order` | number | Source display order |
| `priority` | number | Source priority |
| `value` | string | Unnormalized source value |
| `meta` | string[] | Source metadata array |

The inventory in `spec-label-inventory.csv` contains 129 case-sensitive raw labels. Casing and whitespace are significant: for example, `Model` and `MODEL NAME` are separate labels, and `Chipset Manufacturer` contains a non-breaking space in the source.

## Supporting Shapes

```typescript
interface ViewCounts {
  total: number;
  unique: number;
  live: number;
}

interface ReviewSummary {
  stars: string | null;
  total: number;
}
```

## Pagination Observation

The category RSC object uses the source key `totalPages`, but fixture analysis shows values such as `113` with `perPage: 16`; this behaves as a total-item count rather than a page count. The adapter exposes it as `totalItems` to prevent treating it as a crawl page limit.

## Bundle Observation

Bundle pages remain single catalog products. Their component descriptions appear as raw specification labels such as `CPU`, `GPU`, `Motherboard`, and `RAM`. Per ADR-000, BuildSense must not automatically decompose those descriptions into selectable component products.
