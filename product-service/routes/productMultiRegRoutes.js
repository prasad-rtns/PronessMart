const express = require('express');
const router = express.Router();
const productController = require('../controllers/productMultiRegController');
//const authMiddleware = require('../middlewares/authMiddleware');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/v2/products:
 *   get:
 *     summary: Get all products (V2 - Multi-Region)
 *     description: |
 *       Retrieve products with multi-region support. 
 *       
 *       **Key Features:**
 *       - Regional pricing (10 regions)
 *       - Multi-warehouse inventory
 *       - Advanced filtering
 *       - Full-text search
 *       
 *       **Specify region parameter to get region-specific pricing**
 *     tags: [Products V2 - Multi-Region]
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           enum: [US, EU, UK, IN, AU, CA, JP, CN, BR, MX]
 *         description: Filter by region and get region-specific pricing
 *         example: US
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *         example: electronics
 *       - in: query
 *         name: subcategory
 *         schema:
 *           type: string
 *         description: Filter by subcategory ID
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter by brand name
 *         example: AudioTech
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price (requires region parameter)
 *         example: 100
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price (requires region parameter)
 *         example: 500
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search in name, description, tags
 *         example: wireless headphones
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *         example: wireless,bluetooth
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *         description: Filter featured products
 *         example: true
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sort field
 *         example: name
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: asc
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *         example: 20
 *     responses:
 *       200:
 *         description: List of products with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginationResponse'
 *             example:
 *               success: true
 *               data:
 *                 - _id: "electronics"
 *                   name: "Wireless Headphones Pro"
 *                   slug: "wireless-headphones-pro"
 *                   brand: "AudioTech"
 *                   sku: "WH-PRO-001"
 *                   pricing:
 *                     region: "US"
 *                     currency: "USD"
 *                     price: 249.99
 *                     basePrice: 299.99
 *                     salePrice: 249.99
 *                     tax: 8.5
 *                   category:
 *                     _id: "664f9b86aab2a19b13df0f89"
 *                     name: "Electronics"
 *                     slug: "electronics"
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 150
 *                 pages: 8
 */
router.get('/', productController.getProducts);

/**
 * @swagger
 * /api/v2/products/{id}:
 *   get:
 *     summary: Get product by ID (V2)
 *     description: |
 *       Retrieve detailed product information with multi-region data.
 *       
 *       **Without region parameter:** Returns all regional pricing
 *       
 *       **With region parameter:** Returns only specified region's pricing
 *     tags: [Products V2 - Multi-Region]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: electronics
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *           enum: [US, EU, UK, IN, AU, CA, JP, CN, BR, MX]
 *         description: Get pricing for specific region
 *         example: US
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ProductMultiReg'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', productController.getProduct);

/**
 * @swagger
 * /api/v2/products/category/{categoryCode}:
 *   get:
 *     summary: Get products by category (V2)
 *     description: Retrieve all products in a category including subcategories
 *     tags: [Products V2 - Multi-Region]
 *     parameters:
 *       - in: path
 *         name: categoryCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Category Code
 *         example: electronics
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of products in category
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginationResponse'
 */
router.get('/category/:categoryId', productController.getProductsByCategory);

/**
 * @swagger
 * /api/v2/products:
 *   post:
 *     summary: Create product (V2 - Multi-Region)
 *     description: |
 *       Create a new product with multi-region support.
 *       
 *       **Required:** At least one regional pricing entry
 *       
 *       **Publishes:** `product.created` Kafka event
 *     tags: [Products V2 - Multi-Region]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductMultiRegCreate'
 *           example:
 *             name: "Wireless Headphones Pro"
 *             description: "Premium wireless headphones with active noise cancellation"
 *             shortDescription: "Premium wireless headphones"
 *             category: "electronics"
 *             subcategory: "computer-accessories"
 *             brand: "AudioTech"
 *             sku: "WH-PRO-001"
 *             barcode: "1234567890123"
 *             regionalPricing:
 *               - region: "US"
 *                 currency: "USD"
 *                 basePrice: 299.99
 *                 salePrice: 249.99
 *                 tax: 8.5
 *                 available: true
 *               - region: "EU"
 *                 currency: "EUR"
 *                 basePrice: 269.99
 *                 salePrice: 229.99
 *                 tax: 20
 *                 available: true
 *               - region: "IN"
 *                 currency: "INR"
 *                 basePrice: 24999
 *                 salePrice: 19999
 *                 tax: 18
 *                 available: true
 *             inventory:
 *               - region: "US"
 *                 quantity: 100
 *                 warehouse: "WH-US-001"
 *               - region: "EU"
 *                 quantity: 50
 *                 warehouse: "WH-EU-001"
 *             images:
 *               - url: "https://example.com/headphones1.jpg"
 *                 alt: "Headphones front view"
 *                 isPrimary: true
 *               - url: "https://example.com/headphones2.jpg"
 *                 alt: "Headphones side view"
 *                 isPrimary: false
 *             specifications:
 *               "Battery Life": "30 hours"
 *               "Bluetooth": "5.0"
 *               "Driver Size": "40mm"
 *               "Frequency Response": "20Hz - 20kHz"
 *             dimensions:
 *               length: 20
 *               width: 18
 *               height: 8
 *               unit: "cm"
 *             weight:
 *               value: 0.25
 *               unit: "kg"
 *             tags: ["wireless", "bluetooth", "noise-cancellation"]
 *             isFeatured: false
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ProductMultiReg'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', authMiddleware, productController.createProduct);

/**
 * @swagger
 * /api/v2/products/{id}:
 *   put:
 *     summary: Update product (V2)
 *     description: |
 *       Update product details.
 *       
 *       **Publishes:** `product.updated` Kafka event with changes
 *     tags: [Products V2 - Multi-Region]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             name: "Wireless Headphones Pro Max"
 *             description: "Updated description"
 *             isFeatured: true
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', authMiddleware, productController.updateProduct);

/**
 * @swagger
 * /api/v2/products/{id}/pricing/{region}:
 *   put:
 *     summary: Update regional pricing
 *     description: |
 *       Update or add pricing for a specific region.
 *       
 *       **Publishes:** `product.price.changed` Kafka event
 *     tags: [Products V2 - Multi-Region]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: electronics
 *       - in: path
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [US, EU, UK, IN, AU, CA, JP, CN, BR, MX]
 *         description: Region code
 *         example: US
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               basePrice:
 *                 type: number
 *                 example: 279.99
 *               salePrice:
 *                 type: number
 *                 example: 229.99
 *               tax:
 *                 type: number
 *                 example: 8.5
 *               available:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Pricing updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 */
router.put('/:id/pricing/:region', authMiddleware, productController.updateRegionalPricing);

/**
 * @swagger
 * /api/v2/products/{id}/inventory:
 *   patch:
 *     summary: Update inventory
 *     description: |
 *       Update inventory for a specific region and warehouse.
 *       
 *       **Publishes Events:**
 *       - `product.inventory.changed`
 *       - `product.out.of.stock` (if quantity becomes 0)
 *     tags: [Products V2 - Multi-Region, Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 664f9b86aab2a19b13df0f88
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [region, quantity, warehouse]
 *             properties:
 *               region:
 *                 type: string
 *                 enum: [US, EU, UK, IN, AU, CA, JP, CN, BR, MX]
 *                 example: US
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 example: 75
 *               warehouse:
 *                 type: string
 *                 example: "WH-US-001"
 *     responses:
 *       200:
 *         description: Inventory updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Product not found
 */
router.patch('/:id/inventory', authMiddleware, productController.updateInventory);

/**
 * @swagger
 * /api/v2/products/{id}:
 *   delete:
 *     summary: Delete product (V2)
 *     description: |
 *       Soft delete a product (sets isActive to false).
 *       
 *       **Publishes:** `product.deleted` Kafka event
 *     tags: [Products V2 - Multi-Region]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 664f9b86aab2a19b13df0f88
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authMiddleware, productController.deleteProduct);

/**
 * @swagger
 * /api/v2/products/inventory/low-stock:
 *   get:
 *     summary: Get low stock products
 *     description: Retrieve products with inventory below threshold
 *     tags: [Products V2 - Multi-Region, Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: threshold
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Stock threshold
 *         example: 20
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by specific region
 *         example: US
 *     responses:
 *       200:
 *         description: List of low stock products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductMultiReg'
 *                 count:
 *                   type: integer
 *                   example: 15
 */
router.get('/inventory/low-stock', authMiddleware, productController.getLowStockProducts);

/**
 * @swagger
 * /api/v2/products/bulk/update-prices:
 *   post:
 *     summary: Bulk update regional prices
 *     description: |
 *       Update prices for multiple products in a single operation.
 *       
 *       **Publishes:** `product.price.changed` Kafka event
 *     tags: [Products V2 - Multi-Region]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [updates]
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     region:
 *                       type: string
 *                     pricing:
 *                       type: object
 *                       properties:
 *                         basePrice:
 *                           type: number
 *                         salePrice:
 *                           type: number
 *                         tax:
 *                           type: number
 *           example:
 *             updates:
 *               - productId: "664f9b86aab2a19b13df0f88"
 *                 region: "US"
 *                 pricing:
 *                   basePrice: 199.99
 *                   salePrice: 159.99
 *                   tax: 8.5
 *               - productId: "664f9b86aab2a19b13df0f89"
 *                 region: "US"
 *                 pricing:
 *                   basePrice: 299.99
 *                   salePrice: 249.99
 *                   tax: 8.5
 *     responses:
 *       200:
 *         description: Prices updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Prices updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     matched:
 *                       type: integer
 *                       example: 2
 *                     modified:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Invalid request
 */
router.post('/bulk/update-prices', authMiddleware, productController.bulkUpdatePrices);

/**
 * @swagger
 * /api/v2/products/{id}/analytics:
 *   get:
 *     summary: Get product analytics
 *     description: Retrieve analytics data for a product including inventory and regional data
 *     tags: [Products V2 - Multi-Region, Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 664f9b86aab2a19b13df0f88
 *     responses:
 *       200:
 *         description: Product analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     sku:
 *                       type: string
 *                     totalInventory:
 *                       type: integer
 *                       example: 150
 *                     inventoryByRegion:
 *                       type: object
 *                       example:
 *                         US: 100
 *                         EU: 50
 *                     availableRegions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["US", "EU", "UK"]
 *                     regionalPricing:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RegionalPricing'
 *                     ratings:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                         count:
 *                           type: integer
 *                     isFeatured:
 *                       type: boolean
 *       404:
 *         description: Product not found
 */
router.get('/:id/analytics', authMiddleware, productController.getProductAnalytics);

module.exports = router;