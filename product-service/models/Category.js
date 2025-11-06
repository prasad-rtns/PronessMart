const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
    index: true
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  image: {
    url: String,
    alt: String
  },
  icon: String,
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
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

// Index for performance
categorySchema.index({ parent: 1, isActive: 1, order: 1 });

// Pre-save middleware to generate slug and set level
categorySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Calculate level based on parent
  if (this.isModified('parent')) {
    if (this.parent) {
      const parentCategory = await this.constructor.findById(this.parent);
      this.level = parentCategory ? parentCategory.level + 1 : 0;
    } else {
      this.level = 0;
    }
  }
  
  next();
});

// Virtual to get subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent'
});

// Method to get full category path
categorySchema.methods.getPath = async function() {
  const path = [this];
  let current = this;
  
  while (current.parent) {
    current = await this.constructor.findById(current.parent);
    if (current) {
      path.unshift(current);
    } else {
      break;
    }
  }
  
  return path;
};

// Static method to get category tree
categorySchema.statics.getTree = async function(parentId = null) {
  const categories = await this.find({ 
    parent: parentId,
    isActive: true 
  }).sort({ order: 1 });
  
  const tree = [];
  for (const category of categories) {
    const subcategories = await this.getTree(category._id);
    tree.push({
      ...category.toObject(),
      subcategories
    });
  }
  
  return tree;
};

// Static method to get all descendants
categorySchema.statics.getDescendants = async function(categoryId) {
  const descendants = [];
  const children = await this.find({ parent: categoryId });
  
  for (const child of children) {
    descendants.push(child);
    const childDescendants = await this.getDescendants(child._id);
    descendants.push(...childDescendants);
  }
  
  return descendants;
};

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;