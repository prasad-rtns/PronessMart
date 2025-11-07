const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Get all products (V1 - Single Region)
 *     description: Retrieve a list of products with filtering, pagination, and sorting
 *     tags: [Products V1]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [electronics, clothing, books, home, sports, beauty, toys, food, other]
 *         description: Filter by category
 *         example: electronics
 *       - in: query
 *         name: subcategory
 *         schema:
 *           type: string
 *         description: Filter by subcategory
 *         example: computer-accessories
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *         example: 100
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *         example: 1000
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in product name, description, and tags
 *         example: wireless mouse
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort field (prefix with - for descending)
 *         example: -createdAt
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
 *                 products:
 *                   - _id: "664f9b86aab2a19b13df0f88"
 *                     name: "Wireless Mouse"
 *                     price: 999.99
 *                     category: "electronics"
 *                     stock: 45
 *                 pagination:
 *                   page: 1
 *                   limit: 20
 *                   total: 150
 *                   pages: 8
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', productController.getAllProducts);

/**
 * @swagger
 * /api/v1/products/{productId}:
 *   get:
 *     summary: Get product by ID (V1)
 *     description: Retrieve detailed information about a specific product
 *     tags: [Products V1]
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 664f9b86aab2a19b13df0f88
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
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Product not found"
 *       500:
 *         description: Server error
 */
router.get('/:productId', productController.getProductById);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create a new product (V1)
 *     description: Create a new product (Admin only)
 *     tags: [Products V1]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreate'
 *           example:
 *             name: "Wireless Keyboard"
 *             description: "Mechanical wireless keyboard with RGB"
 *             price: 1299.99
 *             comparePrice: 1599.99
 *             category: "electronics"
 *             subcategory: "computer-accessories"
 *             brand: "TechGear"
 *             sku: "KB-RGB-001"
 *             stock: 50
 *             images:
 *               - url: "https://example.com/image1.jpg"
 *                 alt: "Keyboard front view"
 *             specifications:
 *               "Switch Type": "Mechanical Red"
 *               "Connectivity": "Bluetooth 5.0"
 *               "Battery": "2000mAh"
 *             tags: ["wireless", "mechanical", "rgb"]
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
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', authMiddleware, productController.createProduct);

/**
 * @swagger
 * /api/v1/products/{productId}:
 *   put:
 *     summary: Update a product (V1)
 *     description: Update an existing product (Admin only)
 *     tags: [Products V1]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *             $ref: '#/components/schemas/ProductCreate'
 *           example:
 *             name: "Wireless Keyboard Pro"
 *             price: 1199.99
 *             stock: 60
 *             isFeatured: true
 *     responses:
 *       200:
 *         description: Product updated successfully
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
 *                   example: "Product updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:productId', authMiddleware, productController.updateProduct);

/**
 * @swagger
 * /api/v1/products/{productId}:
 *   delete:
 *     summary: Delete product (V1)
 *     description: Delete a product permanently (Admin only)
 *     tags: [Products V1]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Product deleted successfully"
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:productId', authMiddleware, productController.deleteProduct);

module.exports = router;