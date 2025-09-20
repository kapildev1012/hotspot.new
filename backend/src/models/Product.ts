import mongoose, { Document, Schema } from 'mongoose';
import { IProductVariant } from '../types/index.js';

export interface IProduct extends Document {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  images: string[];
  variants: IProductVariant[];
  defaultUnit: string; // pcs, kg, liter, etc.
  alertThreshold: number; // global fallback threshold
  reorderQuantity: number;
  costPrice?: number;
  sellingPrice?: number;
  barcode?: string;
  qrCode?: string;
  tags: string[];
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const productVariantSchema = new Schema<IProductVariant>({
  variantId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  attributes: {
    type: Map,
    of: String,
    default: {},
  },
  sku: {
    type: String,
    trim: true,
  },
  barcode: {
    type: String,
    trim: true,
  },
}, { _id: false });

const productSchema = new Schema<IProduct>(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    images: [{
      type: String,
      trim: true,
    }],
    variants: [productVariantSchema],
    defaultUnit: {
      type: String,
      required: [true, 'Default unit is required'],
      trim: true,
      lowercase: true,
    },
    alertThreshold: {
      type: Number,
      required: [true, 'Alert threshold is required'],
      min: [0, 'Alert threshold cannot be negative'],
      default: 10,
    },
    reorderQuantity: {
      type: Number,
      required: [true, 'Reorder quantity is required'],
      min: [1, 'Reorder quantity must be at least 1'],
      default: 50,
    },
    costPrice: {
      type: Number,
      min: [0, 'Cost price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      min: [0, 'Selling price cannot be negative'],
    },
    barcode: {
      type: String,
      trim: true,
    },
    qrCode: {
      type: String,
      trim: true,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: sku already has unique index from unique: true
productSchema.index({ name: 'text', description: 'text', category: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ createdAt: -1 });

// Virtual for total batches
productSchema.virtual('batches', {
  ref: 'Batch',
  localField: '_id',
  foreignField: 'productId',
});

// Virtual for total inventory across all locations
productSchema.virtual('totalInventory', {
  ref: 'Warehouse',
  localField: '_id',
  foreignField: 'inventory.productId',
});

// Pre-save middleware
productSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate QR code data
    this.qrCode = `${this.sku}|${this.name}`;
  }
  next();
});

// Static methods
productSchema.statics.findByCategory = function(category: string) {
  return this.find({ category, isActive: true });
};

productSchema.statics.searchProducts = function(query: string) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { sku: { $regex: query, $options: 'i' } },
          { barcode: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } },
        ],
      },
    ],
  });
};

export default mongoose.model<IProduct>('Product', productSchema);