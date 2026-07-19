import { CatalogProductModel, OfferModel } from '@buildsense/database';
import mongoose from 'mongoose';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
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
        localField: '_id',
        foreignField: 'catalogProductId',
        as: 'offers'
      }
    });

    pipeline.push({
      $addFields: {
        offer: {
          $first: {
            $filter: {
              input: '$offers',
              as: 'offer',
              cond: {
                $and: [
                  { $eq: ['$$offer.availability', 'IN_STOCK'] },
                  { $ne: ['$$offer.price', null] }
                ]
              }
            }
          }
        }
      }
    });

    pipeline.push({
      $project: {
        offers: 0,
        rawSpecifications: 0,
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
      createdAt: doc.createdAt
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
