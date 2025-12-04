import { Router } from 'express';
import { AdminSubscriptionController } from '../../controllers/adminSubscription.controller';
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
 * /api/admin/subscriptions:
 *   get:
 *     summary: Get paginated list of subscriptions with filtering
 *     description: Retrieve a paginated list of all subscriptions with optional filtering and sorting
 *     tags: [Admin - Subscriptions]
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
 *           enum: [active, expired, grace_period]
 *         description: Filter by subscription status
 *       - in: query
 *         name: licenseId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by license ID
 *       - in: query
 *         name: expiringSoon
 *         schema:
 *           type: string
 *           enum: [true, false, 1, 0]
 *         description: Filter subscriptions expiring soon
 *       - in: query
 *         name: expired
 *         schema:
 *           type: string
 *           enum: [true, false, 1, 0]
 *         description: Filter expired subscriptions
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, startDate, endDate, status, annualFee, createdAt]
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
 *         description: List of subscriptions retrieved successfully
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
 *                         subscriptions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Subscription'
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
      .isIn(['active', 'expired', 'grace_period'])
      .withMessage('Status must be one of: active, expired, grace_period'),
    query('licenseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('License ID must be a positive integer'),
    query('expiringSoon')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('expiringSoon must be true, false, 1, or 0'),
    query('expired')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('expired must be true, false, 1, or 0'),
    query('sortBy')
      .optional()
      .isString()
      .isIn(['id', 'startDate', 'endDate', 'status', 'annualFee', 'createdAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),
  ],
  validateRequest,
  AdminSubscriptionController.getSubscriptions
);

/**
 * @swagger
 * /api/admin/subscriptions/{id}:
 *   get:
 *     summary: Get subscription details by ID
 *     description: Retrieve detailed information about a specific subscription
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Subscription'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Subscription not found
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
      .withMessage('Subscription ID must be a positive integer'),
  ],
  validateRequest,
  AdminSubscriptionController.getSubscriptionById
);

/**
 * @swagger
 * /api/admin/subscriptions/{id}:
 *   put:
 *     summary: Update subscription information
 *     description: Update subscription details including dates, fees, and status
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-01T00:00:00Z
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-01-01T00:00:00Z
 *               annualFee:
 *                 type: number
 *                 minimum: 0
 *                 example: 50.0
 *               status:
 *                 type: string
 *                 enum: [active, expired, grace_period]
 *                 example: active
 *               gracePeriodEnd:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: 2025-01-15T00:00:00Z
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Subscription'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Subscription not found
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
      .withMessage('Subscription ID must be a positive integer'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    body('annualFee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Annual fee must be a positive number'),
    body('status')
      .optional()
      .isIn(['active', 'expired', 'grace_period'])
      .withMessage('Status must be one of: active, expired, grace_period'),
    body('gracePeriodEnd')
      .optional()
      .custom((value) => {
        if (value === null) return true;
        if (typeof value === 'string') {
          return !isNaN(Date.parse(value));
        }
        return false;
      })
      .withMessage('Grace period end must be a valid date or null'),
  ],
  validateRequest,
  AdminSubscriptionController.updateSubscription
);

/**
 * @swagger
 * /api/admin/subscriptions/{id}/renew:
 *   post:
 *     summary: Renew subscription
 *     description: Renew a subscription by extending it by 1 year from the current end date or from now
 *     tags: [Admin - Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Subscription ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               extendFromNow:
 *                 type: boolean
 *                 default: false
 *                 description: If true, extend from current date. If false, extend from end date
 *                 example: false
 *     responses:
 *       200:
 *         description: Subscription renewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Subscription'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Subscription not found
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
  '/:id/renew',
  [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Subscription ID must be a positive integer'),
    body('extendFromNow')
      .optional()
      .isBoolean()
      .withMessage('extendFromNow must be a boolean'),
  ],
  validateRequest,
  AdminSubscriptionController.renewSubscription
);

export default router;

