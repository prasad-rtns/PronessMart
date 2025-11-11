const mongoose = require('mongoose');
require('./Product');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  // Store product details for quick access (denormalized)
  productDetails: {
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    comparePrice: {
      type: Number,
      min: 0
    },
    image: {
      url: String,
      alt: String
    },
    sku: {
      type: String,
      required: true
    },
    category: String,
    brand: String,
    availability: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'pre_order', 'discontinued'],
      default: 'in_stock'
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  priceAtAdd: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
//    required: true,
    unique: true,
    index: { unique: true, sparse: true }
  },
  items: {
    type: [cartItemSchema],
    default: [],
    validate: {
      validator: function(items) {
        // Check for duplicate products
        const productIds = items.map(item => item.product.toString());
        return productIds.length === new Set(productIds).size;
      },
      message: 'Duplicate products are not allowed in cart'
    }
  },
  // Summary fields for quick access
  itemCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    default: 0,
    min: 0
  },
  // Applied coupons/promo codes
  appliedCoupons: [{
    code: String,
    discount: Number,
    type: {
      type: String,
      enum: ['percentage', 'fixed']
    }
  }],
  // Session tracking for guest carts
  sessionId: {
    type: String,
    sparse: true,
    index: true
  },
  // Cart status
  status: {
    type: String,
    enum: ['active', 'abandoned', 'converted', 'merged'],
    default: 'active',
    index: true
  },
  // Last activity timestamp
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Expiry for abandoned carts
  expiresAt: {
    type: Date,
    index: true
  },
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

cartSchema.pre('validate', function(next) {
  // 'this' is the document being saved
  if (!this.userId && !this.sessionId) {
    // pick an error message appropriate to your API surface
    this.invalidate('userId', 'Either userId or sessionId is required.');
    return next(new Error('Either userId or sessionId is required.'));
  }
  return next();
});

// Indexes for performance
cartSchema.index({ userId: 1 }, { unique: true, sparse: true });
cartSchema.index({ sessionId: 1 }, { unique: true, sparse: true });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cartSchema.index({ lastActivity: 1 });

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  // Calculate item count
  this.itemCount = this.items.length; // distinct items
  this.totalQuantity = this.items.reduce((total, item) => total + item.quantity, 0);
  // Calculate subtotal
  this.subtotal = this.items.reduce((total, item) => total + item.subtotal, 0);
  
  // Calculate total discount
  const itemDiscounts = this.items.reduce((total, item) => total + (item.discount || 0), 0);
  const couponDiscounts = this.appliedCoupons.reduce((total, coupon) => total + coupon.discount, 0);
  this.discount = itemDiscounts + couponDiscounts;
  
  // Calculate total (subtotal - discount + tax)
  this.total = Math.max(0, this.subtotal - this.discount + this.tax);
  
  // Update last activity
  this.lastActivity = new Date();
  
  // Set expiry for abandoned carts (30 days)
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productData, quantity = 1) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productData._id.toString()
  );

  if (existingItemIndex >= 0) {
    // Update quantity if item already exists
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].subtotal = 
      this.items[existingItemIndex].quantity * this.items[existingItemIndex].priceAtAdd;
  } else {
    // Add new item
    const price = productData.comparePrice && productData.comparePrice < productData.price 
      ? productData.comparePrice 
      : productData.price;

    this.items.push({
      product: productData._id,
      productDetails: {
        product: productData._id,
        name: productData.name,
        price: productData.price,
        comparePrice: productData.comparePrice,
        image: productData.images && productData.images[0] 
          ? { url: productData.images[0].url, alt: productData.images[0].alt }
          : null,
        sku: productData.sku,
        category: productData.category,
        brand: productData.brand,
        availability: productData.availability
      },
      quantity: quantity,
      priceAtAdd: price,
      subtotal: price * quantity,
      discount: 0,
      addedAt: new Date()
    });
  }

  return this;
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString()
  );

  if (itemIndex >= 0) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
      this.items[itemIndex].subtotal = 
        this.items[itemIndex].quantity * this.items[itemIndex].priceAtAdd;
    }
  }

  return this;
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(
    item => item.product.toString() !== productId.toString()
  );
  return this;
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.appliedCoupons = [];
  this.discount = 0;
  this.tax = 0;
  return this;
};

// Method to apply coupon
cartSchema.methods.applyCoupon = function(couponCode, discountAmount, discountType) {
  // Remove existing coupon with same code
  this.appliedCoupons = this.appliedCoupons.filter(c => c.code !== couponCode);
  
  // Add new coupon
  this.appliedCoupons.push({
    code: couponCode,
    discount: discountAmount,
    type: discountType
  });

  return this;
};

// Method to remove coupon
cartSchema.methods.removeCoupon = function(couponCode) {
  this.appliedCoupons = this.appliedCoupons.filter(c => c.code !== couponCode);
  return this;
};

// Method to check if product is in cart
cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => item.product.toString() === productId.toString());
};

// Method to get item by product ID
cartSchema.methods.getItem = function(productId) {
  return this.items.find(item => item.product.toString() === productId.toString());
};

// Static method to find or create cart
cartSchema.statics.findOrCreate = async function(userId, sessionId = null) {
  let cart = await this.findOne({ userId: userId, status: 'active' });
  
  if (!cart) {
    cart = new this({
      userId: userId,
      sessionId: sessionId,
      items: [],
      status: 'active'
    });
    await cart.save();
  }

  return cart;
};

// Static method to cleanup abandoned carts
cartSchema.statics.cleanupAbandoned = async function(daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await this.updateMany(
    { 
      status: 'active',
      lastActivity: { $lt: cutoffDate }
    },
    { 
      $set: { status: 'abandoned' }
    }
  );

  return result;
};

// Virtual for savings (if comparePrice is available)
cartSchema.virtual('savings').get(function() {
  return this.items.reduce((total, item) => {
    if (item.productDetails.comparePrice && item.productDetails.comparePrice > item.productDetails.price) {
      const savingsPerItem = item.productDetails.comparePrice - item.productDetails.price;
      return total + (savingsPerItem * item.quantity);
    }
    return total;
  }, 0);
});

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;