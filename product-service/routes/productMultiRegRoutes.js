const express = require('express');
const router = express.Router();
const productController = require('../controllers/productMultiRegController');
const authMiddleware = require('../middlewares/authMiddleware');

// Public routes
router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.get('/category/:categoryId', productController.getProductsByCategory);

// Protected routes - require authentication
router.use(authMiddleware);

// Create product
router.post('/', productController.createProduct);

// Update product
router.put('/:id', productController.updateProduct);

// Update regional pricing
router.put('/:id/pricing/:region', productController.updateRegionalPricing);

// Update inventory
router.patch('/:id/inventory', productController.updateInventory);

// Delete product
router.delete('/:id', productController.deleteProduct);

// Low stock products
router.get('/inventory/low-stock', productController.getLowStockProducts);

// Bulk operations
router.post('/bulk/update-prices', productController.bulkUpdatePrices);

// Analytics
router.get('/:id/analytics', productController.getProductAnalytics);

module.exports = router;