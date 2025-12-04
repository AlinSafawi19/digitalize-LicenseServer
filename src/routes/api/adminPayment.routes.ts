import { Router } from 'express';
import { AdminPaymentController } from '../../controllers/adminPayment.controller';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import { query, param, body } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { adminLimiter } from '../../config/rateLimit.config';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Apply admin rate limiting to all routes
router.use(adminLimiter);

/**
 * @swagger
 * /api/admin/payments/stats:
 *   get:
 *     summary: Get payment statistics
 *     description: Retrieve payment statistics with optional date range and license filtering
 *     tags: [Admin - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics (ISO 8601 format)
 *       - in: query
 *         name: licenseId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by license ID
 *     responses:
 *       200:
 *         description: Payment statistics retrieved successfully
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
 *                         totalRevenue:
 *                           type: number
 *                           example: 10000.0
 *                         totalPayments:
 *                           type: integer
 *                           example: 50
 *                         averagePayment:
 *                           type: number
 *                           example: 200.0
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
  '/stats',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('licenseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
  ],
  validateRequest,
  AdminPaymentController.getPaymentStatistics
);

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: Get paginated list of payments with filtering
 *     description: Retrieve a paginated list of all payments with optional filtering and sorting
 *     tags: [Admin - Payments]
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
 *         name: licenseId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by license ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter payments from this date (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter payments until this date (ISO 8601 format)
 *       - in: query
 *         name: isAnnualSubscription
 *         schema:
 *           type: string
 *           enum: [true, false, 1, 0]
 *         description: Filter by annual subscription payments
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, amount, paymentDate, createdAt]
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
 *         description: List of payments retrieved successfully
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
 *                         payments:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Payment'
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
    query('licenseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    query('isAnnualSubscription')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('isAnnualSubscription must be true, false, 1, or 0'),
    query('sortBy')
      .optional()
      .isString()
      .isIn(['id', 'amount', 'paymentDate', 'createdAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),
  ],
  validateRequest,
  AdminPaymentController.getPayments
);

/**
 * @swagger
 * /api/admin/payments/{id}:
 *   get:
 *     summary: Get payment details by ID
 *     description: Retrieve detailed information about a specific payment
 *     tags: [Admin - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Payment'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Payment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @swagger
 * /api/admin/payments:
 *   post:
 *     summary: Create a new payment manually
 *     description: Create a payment record for a license (typically for annual subscription payments)
 *     tags: [Admin - Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseId
 *               - amount
 *               - isAnnualSubscription
 *             properties:
 *               licenseId:
 *                 type: integer
 *                 minimum: 1
 *                 description: License ID
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Payment amount
 *               paymentDate:
 *                 type: string
 *                 format: date-time
 *                 description: Payment date (defaults to now if not provided)
 *               isAnnualSubscription:
 *                 type: boolean
 *                 description: Whether this is an annual subscription payment
 *     responses:
 *       201:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Payment'
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
router.post(
  '/',
  [
    body('licenseId')
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number'),
    body('paymentDate')
      .optional()
      .isISO8601()
      .withMessage('Payment date must be a valid ISO 8601 date'),
    body('isAnnualSubscription')
      .isBoolean()
      .withMessage('isAnnualSubscription must be a boolean'),
    body('paymentType')
      .optional()
      .isIn(['initial', 'annual', 'user'])
      .withMessage('paymentType must be one of: initial, annual, user'),
    body('additionalUsers')
      .optional()
      .isInt({ min: 1 })
      .withMessage('additionalUsers must be a positive integer'),
  ],
  validateRequest,
  AdminPaymentController.createPayment
);

/**
 * @swagger
 * /api/admin/payments/{id}:
 *   get:
 *     summary: Get payment details by ID
 *     description: Retrieve detailed information about a specific payment
 *     tags: [Admin - Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Payment'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Payment not found
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
      .withMessage('Payment ID must be a positive integer'),
  ],
  validateRequest,
  AdminPaymentController.getPaymentById
);

export default router;

