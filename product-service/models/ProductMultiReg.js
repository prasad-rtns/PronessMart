const mongoose = require('mongoose');

const regionPricingSchema = new mongoose.Schema({
  region: {
    type: String,
    required: true,
    enum: ['US', 'EU', 'UK', 'IN', 'AU', 'CA', 'JP', 'CN', 'BR', 'MX']
  },
  currency: {
    type: String,
    required: true,
    enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY', 'BRL', 'MXN']
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  available: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const inventorySchema = new mongoose.Schema({
  region: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  warehouse: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  /* Category from Collection 'Category'
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
    index: true
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    index: true
  },*/
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['electronics', 'clothing', 'books', 'home', 'sports', 'beauty', 'toys', 'food', 'other']
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true,
    index: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    index: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  regionalPricing: {
    type: [regionPricingSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one regional pricing is required'
    }
  },
  inventory: [inventorySchema],
  images: [{
    url: {
      type: String,
      required: true
    },
    alt: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  specifications: {
    type: Map,
    of: String
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in', 'm'],
      default: 'cm'
    }
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'lb', 'g'],
      default: 'kg'
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  productversion: {
    type: String,
    default: 'v2'
  },
  availableRegions: [{
    type: String,
    enum: ['US', 'EU', 'UK', 'IN', 'AU', 'CA', 'JP', 'CN', 'BR', 'MX']
  }],
  metaTitle: String,
  metaDescription: String,
  metaKeywords: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1, isActive: 1 });
productSchema.index({ 'regionalPricing.region': 1, isActive: 1 });
productSchema.index({ brand: 1, isActive: 1 });
productSchema.index({ createdAt: -1 });

// Pre-save middleware to generate slug
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Extract available regions from regional pricing
  if (this.isModified('regionalPricing')) {
    this.availableRegions = this.regionalPricing
      .filter(rp => rp.available)
      .map(rp => rp.region);
  }
  
  next();
});

// Virtual for total inventory across all regions
productSchema.virtual('totalInventory').get(function() {
  return this.inventory.reduce((total, inv) => total + inv.quantity, 0);
});

// Method to get price for specific region
productSchema.methods.getPriceForRegion = function(region) {
  const regionPrice = this.regionalPricing.find(rp => rp.region === region);
  if (!regionPrice) {
    return null;
  }
  return {
    region: regionPrice.region,
    currency: regionPrice.currency,
    price: regionPrice.salePrice || regionPrice.basePrice,
    basePrice: regionPrice.basePrice,
    salePrice: regionPrice.salePrice,
    tax: regionPrice.tax,
    available: regionPrice.available
  };
};

// Method to check availability in region
productSchema.methods.isAvailableInRegion = function(region) {
  const regionPrice = this.regionalPricing.find(rp => rp.region === region);
  return regionPrice && regionPrice.available;
};

// Static method to find products by region
productSchema.statics.findByRegion = function(region, options = {}) {
  return this.find({
    isActive: true,
    'regionalPricing.region': region,
    'regionalPricing.available': true,
    ...options
  });
};

// const ProductMultiReg =
//   mongoose.models.ProductMultiReg ||
//   mongoose.model('ProductMultiReg', productSchema);
// Map this extended schema to the same 'products' collection
const ProductMultiReg = mongoose.model(
  'ProductMultiRegion',
  productSchema,
  'products'
);
module.exports = ProductMultiReg;