const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeAdmin = require('../middlewares/authorizeAdmin'); // ✅ new import

// All cart routes require authentication
router.use(authMiddleware);
//const optionalAuth = require('../middlewares/optionalAuth');
//router.use(optionalAuth);

/**
 * @swagger
 * /api/v1/cart/all:
 *   get:
 *     summary: Get all carts (Admin only)
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter products by category ID or slug
 *       - in: query
 *         name: sku
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by SKU name or slug
 *       - in: query
 *         name: name
 *         required: false
 *         schema:
 *           type: string
 *         description: Product name search (partial match)
     *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of carts
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
 *                     $ref: '#/components/schemas/CartResponse'
 */
router.get('/all', authorizeAdmin, cartController.getAllCarts);

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Get user's cart
 *     description: Retrieve the current user's shopping cart with all items
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *             example:
 *               success: true
 *               data:
 *                 _id: "690e595aa06064479fd559b4"
 *                 user: "664f9b86aab2a19b13df0f89"
 *                 items:
 *                   - product: "664f9b86aab2a19b13df0f90"
 *                     productDetails:
 *                       name: "Wireless Mouse"
 *                       price: 999.99
 *                       sku: "MOUSE-001"
 *                       image:
 *                         url: "https://example.com/image.jpg"
 *                     quantity: 2
 *                     priceAtAdd: 999.99
 *                     subtotal: 1999.98
 *                 itemCount: 2
 *                 subtotal: 1999.98
 *                 discount: 0
 *                 tax: 0
 *                 total: 1999.98
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/', cartController.getCart);

/**
 * @swagger
 * /api/v1/cart/summary:
 *   get:
 *     summary: Get cart summary
 *     description: Get a quick summary of cart totals without full item details
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart summary
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
 *                     itemCount:
 *                       type: integer
 *                       example: 3
 *                     totalQuantity:    
 *                       type: integer
 *                       example: 6
 *                     subtotal:
 *                       type: number
 *                       example: 2999.97
 *                     discount:
 *                       type: number
 *                       example: 100
 *                     tax:
 *                       type: number
 *                       example: 250
 *                     total:
 *                       type: number
 *                       example: 3149.97
 *                     savings:
 *                       type: number
 *                       example: 200
 */
router.get('/summary', cartController.getCartSummary);

/**
 * @swagger
 * /api/v1/cart/items:
 *   post:
 *     summary: Add Single / multiple items to cart
 *     description: Add multiple products to cart in a single request
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                       example: "690e595aa06064479fd559b4"
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                       example: 2
 *           example:
 *             items:
 *               - productId: "690e595aa06064479fd559b4"
 *                 quantity: 2
 *               - productId: "690e57e4a06064479fc95ba4"
 *                 quantity: 1
 *               - productId: "690e57cea06064479fc86219"
 *                 quantity: 3
 *     responses:
 *       200:
 *         description: Items added successfully
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
 *                   example: "Items added to cart"
 *                 data:
 *                   type: object
 *                   properties:
 *                     cart:
 *                       $ref: '#/components/schemas/Cart'
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid request
 */
router.post('/items', cartController.addMultipleItems);

/**
 * @swagger
 * /api/v1/cart/item/{productId}:
 *   put:
 *     summary: Update item quantity
 *     description: Update the quantity of an item in the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 690e595aa06064479fd559b4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quantity]
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 description: New quantity (0 to remove item)
 *                 example: 3
 *     responses:
 *       200:
 *         description: Quantity updated successfully
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
 *                   example: "Item quantity updated"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid quantity or insufficient stock
 *       404:
 *         description: Item not found in cart
 */
router.put('/item/:productId', cartController.updateItemQuantity);

/**
 * @swagger
 * /api/v1/cart/item/{productId}:
 *   delete:
 *     summary: Remove item from cart
 *     description: Remove a single product from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *         example: 690e595aa06064479fd559b4
 *     responses:
 *       200:
 *         description: Item removed successfully
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
 *                   example: "Item removed from cart"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       404:
 *         description: Item not found in cart
 */
router.delete('/item/:productId', cartController.removeItem);

/**
 * @swagger
 * /api/v1/cart/items:
 *   delete:
 *     summary: Remove multiple items from cart
 *     description: Remove multiple products from cart in a single request
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productIds]
 *             properties:
 *               productIds:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 example: ["690e595aa06064479fd559b4", "664f9b86aab2a19b13df0f89"]
 *     responses:
 *       200:
 *         description: Items removed successfully
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
 *                   example: "Items removed from cart"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid request
 */
router.delete('/items', cartController.removeMultipleItems);

/**
 * @swagger
 * /api/v1/cart:
 *   delete:
 *     summary: Clear cart
 *     description: Remove all items from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared successfully
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
 *                   example: "Cart cleared successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 */
router.delete('/', cartController.clearCart);

/**
 * @swagger
 * /api/v1/cart/coupon:
 *   post:
 *     summary: Apply coupon
 *     description: Apply a discount coupon to the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Coupon code
 *                 example: "SAVE10"
 *     responses:
 *       200:
 *         description: Coupon applied successfully
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
 *                   example: "Coupon applied successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid or expired coupon
 */
router.post('/coupon', cartController.applyCoupon);

/**
 * @swagger
 * /api/v1/cart/coupon/{code}:
 *   delete:
 *     summary: Remove coupon
 *     description: Remove an applied coupon from the cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Coupon code
 *         example: SAVE10
 *     responses:
 *       200:
 *         description: Coupon removed successfully
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
 *                   example: "Coupon removed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 */
router.delete('/coupon/:code', cartController.removeCoupon);

/**
 * @swagger
 * /api/v1/cart/check-availability:
 *   get:
 *     summary: Check cart availability
 *     description: Verify if all items in cart are available and in stock
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability check complete
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
 *                     available:
 *                       type: boolean
 *                       example: false
 *                     unavailableItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                           productName:
 *                             type: string
 *                           reason:
 *                             type: string
 *                       example:
 *                         - productId: "690e595aa06064479fd559b4"
 *                           productName: "Wireless Mouse"
 *                           reason: "Insufficient stock. Available: 5, Requested: 10"
 */
router.get('/check-availability', cartController.checkAvailability);

/**
 * @swagger
 * /api/v1/cart/sync:
 *   post:
 *     summary: Sync cart with latest product data
 *     description: Update cart with latest product prices and availability
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart synced successfully
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
 *                   example: "Cart synced successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 */
router.post('/sync', cartController.syncCart);

/**
 * @swagger
 * /api/v1/cart/merge:
 *   post:
 *     summary: Merge guest cart with user cart
 *     description: Merge a guest session cart into the authenticated user's cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Guest session ID
 *                 example: "session_abc123xyz"
 *     responses:
 *       200:
 *         description: Carts merged successfully
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
 *                   example: "Carts merged successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 */
router.post('/merge', cartController.mergeCarts);

/**
 * @swagger
 * /api/v1/cart/item:
 *   post:
 *     summary: Add single item to cart
 *     description: Add a single product to the shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity]
 *             properties:
 *               productId:
 *                 type: string
 *                 description: Product ID
 *                 example: "690e595aa06064479fd559b4"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: Quantity to add
 *                 example: 2
 *     responses:
 *       200:
 *         description: Item added successfully
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
 *                   example: "Item added to cart"
 *                 data:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Invalid request or insufficient stock
 *       404:
 *         description: Product not found
 */
router.post('/item', cartController.addItem);

module.exports = router;