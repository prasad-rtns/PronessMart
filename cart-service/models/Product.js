const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  comparePrice: Number,
  stock: Number,
  sku: String,
  category: String,
  brand: String,
  images: [
    {
      url: String,
      alt: String
    }
  ],
  availability: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'pre_order', 'discontinued'],
    default: 'in_stock'
  }
});

// Register only if not already registered
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
