import { CatalogProductModel, OfferModel } from '@buildsense/database';
import mongoose from 'mongoose';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Card specification selection — presentation projection only
// ---------------------------------------------------------------------------

/**
 * Label-priority list per category. Labels are matched case-insensitively
 * against `rawSpecifications[].label`. At most three matches are returned.
 * Only common real-world label patterns are listed; absent rows are hidden.
 */
const CATEGORY_LABEL_PRIORITY: Record<string, string[]> = {
  CPU: ['cores', 'threads', 'base clock', 'boost clock', 'tdp', 'socket', 'architecture'],
  GPU: ['memory', 'memory type', 'cuda cores', 'stream processors', 'tdp', 'boost clock', 'bus width'],
  MOTHERBOARD: ['socket', 'chipset', 'form factor', 'memory type', 'max memory', 'slots'],
  RAM: ['capacity', 'speed', 'type', 'cas latency', 'modules', 'voltage'],
  SSD: ['capacity', 'interface', 'read speed', 'write speed', 'nand type', 'form factor'],
  HDD: ['capacity', 'interface', 'rpm', 'cache', 'form factor'],
  PSU: ['wattage', 'efficiency', 'modular', 'form factor', 'fan size'],
  CASE: ['type', 'form factor', 'material', 'expansion slots', 'drive bays'],
  COOLING: ['type', 'fan size', 'noise level', 'tdp', 'radiator size', 'compatibility'],
  MONITOR: ['size', 'resolution', 'refresh rate', 'panel type', 'response time', 'aspect ratio'],
};

/**
 * Normalise a label string for matching: lowercase and collapse whitespace.
 */
function normaliseLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Select up to three card specifications for a product based on its category
 * and raw specifications. Returns an empty array when no useful specs are found.
 */
export function selectCardSpecifications(
  category: string,
  rawSpecifications: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  if (!rawSpecifications || rawSpecifications.length === 0) return [];

  const priorities = CATEGORY_LABEL_PRIORITY[category];
  if (!priorities) return [];

  const seen = new Set<string>();
  const result: Array<{ label: string; value: string }> = [];

  for (const priority of priorities) {
    if (result.length >= 3) break;
    const normalisedPriority = normaliseLabel(priority);

    for (const spec of rawSpecifications) {
      if (result.length >= 3) break;
      const normalisedLabel = normaliseLabel(spec.label);
      if (
        normalisedLabel === normalisedPriority ||
        normalisedLabel.includes(normalisedPriority) ||
        normalisedPriority.includes(normalisedLabel)
      ) {
        // Deduplicate by normalised label
        if (!seen.has(normalisedLabel)) {
          seen.add(normalisedLabel);
          result.push({ label: spec.label, value: spec.value });
        }
        break; // Move to next priority after first match
      }
    }
  }

  return result;
}

export interface GetProductsParams {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest';
}

export class CatalogService {
  async getCategories(): Promise<string[]> {
    const categories = await CatalogProductModel.distinct('category', {
      category: { $nin: [null, ''] }
    });
    return categories.sort((a: string, b: string) => a.localeCompare(b));
  }

  async getProducts(params: GetProductsParams): Promise<unknown> {
    const { page, pageSize, search, category, brand, minPrice, maxPrice, sort } = params;
    
    const pipeline: mongoose.PipelineStage[] = [];

    const match: mongoose.FilterQuery<unknown> = {};
    if (category) {
      match.category = category;
    }
    if (brand) {
      match.brand = brand;
    }
    if (search && search.trim() !== '') {
      const escaped = escapeRegex(search.trim());
      const regex = new RegExp(escaped, 'i');
      match.$or = [
        { title: regex },
        { brand: regex },
        { model: regex },
        { mpn: regex }
      ];
    }
    
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    pipeline.push({
      $lookup: {
        from: 'offers',
        let: { productId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$catalogProductId', '$$productId'] }
            }
          },
          {
            $addFields: {
              selectionRank: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $and: [
                          { $eq: ['$availability', 'IN_STOCK'] },
                          { $ne: ['$price', null] }
                        ]
                      },
                      then: 0
                    },
                    {
                      case: {
                        $and: [
                          { $eq: ['$availability', 'OUT_OF_STOCK'] },
                          { $ne: ['$price', null] }
                        ]
                      },
                      then: 1
                    },
                    {
                      case: { $ne: ['$price', null] },
                      then: 2
                    },
                    {
                      case: { $eq: ['$availability', 'IN_STOCK'] },
                      then: 3
                    },
                    {
                      case: { $eq: ['$availability', 'OUT_OF_STOCK'] },
                      then: 4
                    }
                  ],
                  default: 5
                }
              }
            }
          },
          {
            $sort: {
              selectionRank: 1,
              price: 1,
              updatedAt: -1,
              storeCode: 1,
              _id: 1
            }
          },
          { $project: { selectionRank: 0 } }
        ],
        as: 'offers'
      }
    });

    pipeline.push({
      $addFields: {
        offer: { $first: '$offers' }
      }
    });

    pipeline.push({
      $project: {
        offers: 0,
        compatibility: 0,
        __v: 0
      }
    });

    const priceMatch: mongoose.FilterQuery<unknown> = {};
    if (minPrice !== undefined || maxPrice !== undefined) {
      priceMatch['offer.price'] = { $ne: null };
      if (minPrice !== undefined) priceMatch['offer.price'].$gte = minPrice;
      if (maxPrice !== undefined) priceMatch['offer.price'].$lte = maxPrice;
    }
    if (Object.keys(priceMatch).length > 0) {
      pipeline.push({ $match: priceMatch });
    }

    if (sort === 'price_asc' || sort === 'price_desc') {
      pipeline.push({
        $addFields: {
          sortPrice: { $ifNull: ['$offer.price', sort === 'price_asc' ? Infinity : -Infinity] }
        }
      });
      pipeline.push({
        $sort: {
          sortPrice: sort === 'price_asc' ? 1 : -1,
          _id: 1 
        }
      });
    } else {
      pipeline.push({
        $sort: { createdAt: -1, _id: 1 }
      });
    }

    pipeline.push({
      $facet: {
        metadata: [
          { $count: 'total' }
        ],
        data: [
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize }
        ]
      }
    });

    const result = await CatalogProductModel.aggregate(pipeline);
    const data = result[0]?.data || [];
    const totalItems = result[0]?.metadata[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    const items = data.map((doc: Record<string, unknown>) => {
      const offer = doc.offer as Record<string, unknown> | undefined;
      const rawSpecs = (doc.rawSpecifications ?? []) as Array<{ label: string; value: string }>;
      const category = doc.category as string;
      return {
      id: String(doc._id),
      title: doc.title,
      category: doc.category,
      brand: doc.brand ?? null,
      model: doc.model ?? null,
      mpn: doc.mpn ?? null,
      images: doc.images ?? [],
      price: offer?.price ?? null,
      currency: offer?.currency ?? 'EGP',
      availability: offer?.availability ?? 'UNKNOWN',
      sourceUrl: offer?.sourceUrl ?? null,
      createdAt: doc.createdAt,
      cardSpecifications: selectCardSpecifications(category, rawSpecs),
    };
    });

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages
      }
    };
  }

  async getProductById(id: string): Promise<unknown> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    
    const product = await CatalogProductModel.findById(id).lean().exec();
    if (!product) return null;

    const offers = await OfferModel.find({ catalogProductId: id }).lean().exec();

    return {
      id: product._id.toString(),
      title: product.title,
      category: product.category,
      brand: product.brand ?? null,
      model: product.model ?? null,
      mpn: product.mpn ?? null,
      images: product.images ?? [],
      rawSpecifications: product.rawSpecifications ?? [],
      compatibility: product.compatibility ?? {},
      createdAt: product.createdAt,
      offers: offers.map((o: Record<string, unknown>) => ({
        id: String(o._id),
        storeCode: o.storeCode,
        price: o.price,
        currency: o.currency,
        availability: o.availability,
        sourceUrl: o.sourceUrl
      }))
    };
  }

  async getProductOffers(id: string): Promise<unknown> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null; 
    }

    const offers = await OfferModel.find({ catalogProductId: id }).lean().exec();
    return offers.map((o: Record<string, unknown>) => ({
      id: String(o._id),
      storeCode: o.storeCode,
      price: o.price,
      currency: o.currency,
      availability: o.availability,
      sourceUrl: o.sourceUrl
    }));
  }
}
