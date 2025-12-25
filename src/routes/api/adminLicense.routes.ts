import { Router } from 'express';
import { AdminLicenseController } from '../../controllers/adminLicense.controller';
import { AdminActivationController } from '../../controllers/adminActivation.controller';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import { query, param, body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { adminLimiter, licenseGenerationLimiter } from '../../config/rateLimit.config';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Apply admin rate limiting to all routes
router.use(adminLimiter);

/**
 * @swagger
 * /api/admin/licenses:
 *   get:
 *     summary: Get paginated list of licenses with filtering and search
 *     description: Retrieve a paginated list of all licenses with optional filtering, searching, and sorting
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, expired, revoked, suspended]
 *         description: Filter by license status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by license key, customer name, phone, or location
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, licenseKey, customerName, customerPhone, status, purchaseDate, createdAt, updatedAt]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of licenses retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         licenses:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/License'
 *                         pagination:
 *                           $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Page size must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['active', 'expired', 'revoked', 'suspended'])
      .withMessage('Status must be one of: active, expired, revoked, suspended'),
    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Search query must be between 1 and 255 characters'),
    query('isFreeTrial')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('isFreeTrial must be true, false, 1, or 0'),
    query('sortBy')
      .optional()
      .isString()
      .isIn(['id', 'licenseKey', 'customerName', 'customerPhone', 'status', 'purchaseDate', 'createdAt', 'updatedAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),
  ],
  validateRequest,
  AdminLicenseController.getLicenses
);

/**
 * @swagger
 * /api/admin/licenses/{id}/activations:
 *   get:
 *     summary: Get all activations for a specific license
 *     description: Retrieve all activations associated with a specific license
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: [true, false, 1, 0]
 *         description: Filter by activation status
 *     responses:
 *       200:
 *         description: Activations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         activations:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Activation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id/activations',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    query('isActive')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('isActive must be true, false, 1, or 0'),
  ],
  validateRequest,
  AdminActivationController.getLicenseActivations
);

/**
 * @swagger
 * /api/admin/licenses/{id}:
 *   get:
 *     summary: Get license details by ID
 *     description: Retrieve detailed information about a specific license
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *     responses:
 *       200:
 *         description: License details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/License'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
  ],
  validateRequest,
  AdminLicenseController.getLicenseById
);

/**
 * @swagger
 * /api/admin/licenses:
 *   post:
 *     summary: Create new license manually
 *     description: Create a new license with optional customer and location information
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: John Doe
 *               customerPhone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *               initialPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 350.0
 *               locationName:
 *                 type: string
 *                 example: ABC Grocery Shop
 *               locationAddress:
 *                 type: string
 *                 example: 123 Main Street, City, Country
 *     responses:
 *       201:
 *         description: License created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/License'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/',
  licenseGenerationLimiter, // Apply license generation rate limiter
  [
    body('customerName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Customer name must be between 1 and 255 characters'),
    body('customerPhone')
      .optional()
      .isString()
      .withMessage('Customer phone must be a string')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('Customer phone must be a valid phone number'),
    body('initialPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Initial price must be a positive number'),
    body('annualPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Annual price must be a positive number'),
    body('pricePerUser')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price per user must be a positive number'),
    body('locationName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Location name must be between 1 and 255 characters'),
    body('locationAddress')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Location address must be between 1 and 500 characters'),
    body('isFreeTrial')
      .optional()
      .isBoolean()
      .withMessage('isFreeTrial must be a boolean'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date string'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date string'),
  ],
  validateRequest,
  AdminLicenseController.createLicense
);

/**
 * @swagger
 * /api/admin/licenses/{id}:
 *   put:
 *     summary: Update license information
 *     description: Update license details including customer information, status, and location
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: John Doe
 *               customerPhone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *               status:
 *                 type: string
 *                 enum: [active, expired, revoked, suspended]
 *                 example: active
 *               locationName:
 *                 type: string
 *                 example: ABC Grocery Shop
 *               locationAddress:
 *                 type: string
 *                 example: 123 Main Street, City, Country
 *               initialPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 350.0
 *               annualPrice:
 *                 type: number
 *                 minimum: 0
 *                 example: 50.0
 *               pricePerUser:
 *                 type: number
 *                 minimum: 0
 *                 example: 25.0
 *               isFreeTrial:
 *                 type: boolean
 *                 example: false
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-01T00:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-01-01T23:59:59.999Z"
 *     responses:
 *       200:
 *         description: License updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/License'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    body('customerName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Customer name must be between 1 and 255 characters'),
    body('customerPhone')
      .optional()
      .isString()
      .withMessage('Customer phone must be a string')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('Customer phone must be a valid phone number'),
    body('status')
      .optional()
      .isIn(['active', 'expired', 'revoked', 'suspended'])
      .withMessage('Status must be one of: active, expired, revoked, suspended'),
    body('locationName')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Location name must be between 1 and 255 characters'),
    body('locationAddress')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Location address must be between 1 and 500 characters'),
    body('initialPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Initial price must be a positive number'),
    body('annualPrice')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Annual price must be a positive number'),
    body('pricePerUser')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price per user must be a positive number'),
    body('isFreeTrial')
      .optional()
      .isBoolean()
      .withMessage('isFreeTrial must be a boolean'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date string'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date string'),
  ],
  validateRequest,
  AdminLicenseController.updateLicense
);

/**
 * @swagger
 * /api/admin/licenses/{id}:
 *   delete:
 *     summary: Revoke license
 *     description: Revoke a license by setting its status to revoked (soft delete)
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *     responses:
 *       200:
 *         description: License revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/License'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/:id',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
  ],
  validateRequest,
  AdminLicenseController.revokeLicense
);

/**
 * @swagger
 * /api/admin/licenses/{id}/user-limit:
 *   patch:
 *     summary: Increase user limit for a license
 *     description: Manually increase the user limit when payment is received for additional users
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - additionalUsers
 *             properties:
 *               additionalUsers:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *                 description: Number of additional users to add to the limit
 *     responses:
 *       200:
 *         description: User limit increased successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: License not found
 *       500:
 *         description: Server error
 */
router.patch(
  '/:id/user-limit',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    body('additionalUsers')
      .isInt({ min: 1 })
      .withMessage('additionalUsers must be a positive integer'),
  ],
  validateRequest,
  AdminLicenseController.increaseUserLimit
);

/**
 * @swagger
 * /api/admin/licenses/{id}/reactivate:
 *   post:
 *     summary: Reactivate a license (reset activations)
 *     description: Deactivate all existing activations for a license to allow customer to re-enter license key. This keeps all license data (subscriptions, payments, deadlines) intact.
 *     tags: [Admin - Licenses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: License ID
 *     responses:
 *       200:
 *         description: License reactivation reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         license:
 *                           $ref: '#/components/schemas/License'
 *                         deactivatedActivations:
 *                           type: integer
 *                           description: Number of activations that were deactivated
 *                         message:
 *                           type: string
 *       400:
 *         description: Invalid request
 *       404:
 *         description: License not found
 *       500:
 *         description: Server error
 */
router.post(
  '/:id/reactivate',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
  ],
  validateRequest,
  AdminLicenseController.reactivateLicense
);

export default router;

