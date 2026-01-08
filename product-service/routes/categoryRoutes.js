const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
//const authMiddleware = require('../middlewares/authMiddleware');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * /api/v2/categories:
 *   get:
 *     summary: Get all categories
 *     description: Retrieve list of categories with optional filters
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: parent
 *         schema:
 *           type: string
 *         description: Filter by parent category ID (use "null" for root categories)
 *         example: null
 *       - in: query
 *         name: level
 *         schema:
 *           type: integer
 *         description: Filter by hierarchy level (0 = root)
 *         example: 0
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter active/inactive categories
 *         example: true
 *     responses:
 *       200:
 *         description: List of categories
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
 *                     $ref: '#/components/schemas/Category'
 *                 count:
 *                   type: integer
 *                   example: 10
 *             example:
 *               success: true
 *               data:
 *                 - _id: "664f9b86aab2a19b13df0f88"
 *                   name: "Electronics"
 *                   slug: "electronics"
 *                   level: 0
 *                   parent: null
 *                   order: 1
 *                   isActive: true
 *                 - _id: "664f9b86aab2a19b13df0f89"
 *                   name: "Clothing"
 *                   slug: "clothing"
 *                   level: 0
 *                   parent: null
 *                   order: 2
 *                   isActive: true
 *               count: 2
 *       500:
 *         description: Server error
 */
router.get('/', categoryController.getCategories);

/**
 * @swagger
 * /api/v2/categories/tree:
 *   get:
 *     summary: Get category tree
 *     description: |
 *       Retrieve complete category hierarchy as a tree structure.
 *       
 *       **Returns:** Nested structure with all categories and subcategories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Category tree
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Category'
 *                       - type: object
 *                         properties:
 *                           subcategories:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/Category'
 *             example:
 *               success: true
 *               data:
 *                 - _id: "664f9b86aab2a19b13df0f88"
 *                   name: "Electronics"
 *                   slug: "electronics"
 *                   level: 0
 *                   subcategories:
 *                     - _id: "664f9b86aab2a19b13df0f89"
 *                       name: "Audio"
 *                       slug: "audio"
 *                       level: 1
 *                       parent: "664f9b86aab2a19b13df0f88"
 *                       subcategories:
 *                         - _id: "664f9b86aab2a19b13df0f90"
 *                           name: "Headphones"
 *                           slug: "headphones"
 *                           level: 2
 *                           parent: "664f9b86aab2a19b13df0f89"
 *                           subcategories: []
 *       500:
 *         description: Server error
 */
router.get('/tree', categoryController.getCategoryTree);

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     description: Retrieve detailed information about a specific category
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: 664f9b86aab2a19b13df0f88
 *     responses:
 *       200:
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Category'
 *                     - type: object
 *                       properties:
 *                         parent:
 *                           $ref: '#/components/schemas/Category'
 *                         subcategories:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', categoryController.getCategory);

/**
 * @swagger
 * /api/v2/categories/{id}/path:
 *   get:
 *     summary: Get category path
 *     description: |
 *       Retrieve the full path from root to the specified category.
 *       
 *       **Example:** Electronics > Audio > Headphones
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: 664f9b86aab2a19b13df0f90
 *     responses:
 *       200:
 *         description: Category path (breadcrumb)
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
 *                     $ref: '#/components/schemas/Category'
 *             example:
 *               success: true
 *               data:
 *                 - _id: "664f9b86aab2a19b13df0f88"
 *                   name: "Electronics"
 *                   slug: "electronics"
 *                   level: 0
 *                 - _id: "664f9b86aab2a19b13df0f89"
 *                   name: "Audio"
 *                   slug: "audio"
 *                   level: 1
 *                 - _id: "664f9b86aab2a19b13df0f90"
 *                   name: "Headphones"
 *                   slug: "headphones"
 *                   level: 2
 *       404:
 *         description: Category not found
 */
router.get('/:id/path', categoryController.getCategoryPath);

/**
 * @swagger
 * /api/v2/categories:
 *   post:
 *     summary: Create category
 *     description: |
 *       Create a new category or subcategory.
 *       
 *       **Auto-generates:** Slug from name, calculates level from parent
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Electronics"
 *               description:
 *                 type: string
 *                 example: "Electronic devices and gadgets"
 *               parent:
 *                 type: string
 *                 nullable: true
 *                 description: Parent category ID (null for root category)
 *                 example: null
 *               image:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                     example: "https://example.com/categories/electronics.jpg"
 *                   alt:
 *                     type: string
 *                     example: "Electronics category"
 *               icon:
 *                 type: string
 *                 example: "electronics-icon"
 *               order:
 *                 type: integer
 *                 example: 1
 *               metaTitle:
 *                 type: string
 *                 example: "Electronics - Shop Online"
 *               metaDescription:
 *                 type: string
 *                 example: "Browse our collection of electronic devices"
 *               metaKeywords:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["electronics", "gadgets", "devices"]
 *           examples:
 *             rootCategory:
 *               summary: Root Category
 *               value:
 *                 name: "Electronics"
 *                 description: "Electronic devices and gadgets"
 *                 parent: null
 *                 order: 1
 *             subcategory:
 *               summary: Subcategory
 *               value:
 *                 name: "Audio"
 *                 description: "Audio devices and accessories"
 *                 parent: "664f9b86aab2a19b13df0f88"
 *                 order: 1
 *     responses:
 *       201:
 *         description: Category created successfully
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
 *                   example: "Category created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 */
router.post('/', authMiddleware, categoryController.createCategory);

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   put:
 *     summary: Update category
 *     description: Update an existing category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: 664f9b86aab2a19b13df0f88
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               order:
 *                 type: integer
 *               image:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                   alt:
 *                     type: string
 *               icon:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *           example:
 *             name: "Consumer Electronics"
 *             description: "Updated description"
 *             order: 2
 *             isActive: true
 *     responses:
 *       200:
 *         description: Category updated successfully
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
 *                   example: "Category updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', authMiddleware, categoryController.updateCategory);

/**
 * @swagger
 * /api/v2/categories/{id}:
 *   delete:
 *     summary: Delete category
 *     description: |
 *       Soft delete a category (sets isActive to false).
 *       
 *       **Note:** Consider moving products to another category before deletion
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *         example: 664f9b86aab2a19b13df0f88
 *     responses:
 *       200:
 *         description: Category deleted successfully
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
 *                   example: "Category deleted successfully"
 *       404:
 *         description: Category not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authMiddleware, categoryController.deleteCategory);

module.exports = router;