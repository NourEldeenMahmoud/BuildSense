import { Schema, model, type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Build slot names — kept in sync with packages/domain/src/build.ts
// ---------------------------------------------------------------------------

const BUILD_SLOT_VALUES = [
  'cpu',
  'motherboard',
  'ram',
  'gpu',
  'storage',
  'psu',
  'case',
] as const;

type BuildSlotName = (typeof BUILD_SLOT_VALUES)[number];

// ---------------------------------------------------------------------------
// Sub-document interfaces
// ---------------------------------------------------------------------------

export interface BuildItem {
  productId: string;
  slot: BuildSlotName;
  quantity: number;
  productName: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  storeCode: string;
  unitPrice: number | null;
  totalPrice: number | null;
  availability: string | null;
  lastSeenAt: Date | null;
}

export interface BuildCompatibilitySlot {
  slot: BuildSlotName;
  status: 'UNKNOWN' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'WARNING';
  triggeredRuleIds: string[];
  topReasons: string[];
}

export interface BuildCompatibility {
  overallStatus: 'UNKNOWN' | 'COMPATIBLE' | 'INCOMPATIBLE' | 'WARNING';
  slots: BuildCompatibilitySlot[];
}

export interface BuildPricing {
  totalPrice: number | null;
  itemCount: number;
}

// ---------------------------------------------------------------------------
// Document interface
// ---------------------------------------------------------------------------

export interface Build {
  publicId: string;
  name: string;
  version: number;
  items: BuildItem[];
  compatibility: BuildCompatibility;
  pricing: BuildPricing;
  createdAt: Date;
  updatedAt: Date;
}

export type BuildDocument = Build & Document;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

const buildItemSchema = new Schema<BuildItem>(
  {
    productId: { type: String, required: true },
    slot: { type: String, required: true, enum: [...BUILD_SLOT_VALUES] },
    quantity: { type: Number, required: true, min: 1 },
    productName: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    sourceUrl: { type: String, required: true },
    storeCode: { type: String, required: true },
    unitPrice: { type: Number, default: null },
    totalPrice: { type: Number, default: null },
    availability: { type: String, default: null },
    lastSeenAt: { type: Date, default: null },
  },
  { _id: false },
);

const buildCompatibilitySlotSchema = new Schema<BuildCompatibilitySlot>(
  {
    slot: { type: String, required: true, enum: [...BUILD_SLOT_VALUES] },
    status: {
      type: String,
      required: true,
      enum: ['UNKNOWN', 'COMPATIBLE', 'INCOMPATIBLE', 'WARNING'],
    },
    triggeredRuleIds: { type: [String], default: [] },
    topReasons: { type: [String], default: [] },
  },
  { _id: false },
);

const buildCompatibilitySchema = new Schema<BuildCompatibility>(
  {
    overallStatus: {
      type: String,
      required: true,
      enum: ['UNKNOWN', 'COMPATIBLE', 'INCOMPATIBLE', 'WARNING'],
    },
    slots: { type: [buildCompatibilitySlotSchema], default: [] },
  },
  { _id: false },
);

const buildPricingSchema = new Schema<BuildPricing>(
  {
    totalPrice: { type: Number, default: null },
    itemCount: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

// ---------------------------------------------------------------------------
// Build schema
// ---------------------------------------------------------------------------

const buildSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    items: { type: [buildItemSchema], default: [] },
    compatibility: { type: buildCompatibilitySchema, required: true },
    pricing: { type: buildPricingSchema, required: true },
  },
  {
    timestamps: true,
  },
);

// Indexes
buildSchema.index({ updatedAt: -1 });

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export const BuildModel: Model<BuildDocument> = model<BuildDocument>(
  'Build',
  buildSchema,
);
