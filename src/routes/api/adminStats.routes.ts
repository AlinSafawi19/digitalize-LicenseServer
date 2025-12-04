import { Router } from 'express';
import { AdminStatsController } from '../../controllers/adminStats.controller';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import { query } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { adminLimiter } from '../../config/rateLimit.config';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Apply admin rate limiting to all routes
router.use(adminLimiter);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Retrieve comprehensive dashboard statistics including license counts, activations, subscriptions, and revenue
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
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
 *                         totalLicenses:
 *                           type: integer
 *                           example: 100
 *                         activeLicenses:
 *                           type: integer
 *                           example: 85
 *                         totalActivations:
 *                           type: integer
 *                           example: 120
 *                         activeActivations:
 *                           type: integer
 *                           example: 95
 *                         totalRevenue:
 *                           type: number
 *                           example: 50000.0
 *                         totalSubscriptions:
 *                           type: integer
 *                           example: 80
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/stats', AdminStatsController.getStats);

/**
 * @swagger
 * /api/admin/reports/licenses:
 *   get:
 *     summary: Export license list as CSV
 *     description: Export a filtered list of licenses as a CSV file
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Search by license key, customer name, email, or location
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, licenseKey, customerName, customerEmail, status, purchaseDate, createdAt, updatedAt]
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
 *         description: CSV file with license data
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
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
  '/reports/licenses',
  [
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
    query('sortBy')
      .optional()
      .isString()
      .isIn(['id', 'licenseKey', 'customerName', 'customerEmail', 'status', 'purchaseDate', 'createdAt', 'updatedAt'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),
  ],
  validateRequest,
  AdminStatsController.exportLicenses
);

/**
 * @swagger
 * /api/admin/reports/revenue:
 *   get:
 *     summary: Get revenue report by period and trends
 *     description: Retrieve revenue statistics and trends for a specified date range
 *     tags: [Admin - Statistics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for revenue report (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for revenue report (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Revenue report retrieved successfully
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
 *                         periodRevenue:
 *                           type: number
 *                           example: 5000.0
 *                         revenueByMonth:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               month:
 *                                 type: string
 *                               revenue:
 *                                 type: number
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
  '/reports/revenue',
  [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
  ],
  validateRequest,
  AdminStatsController.getRevenueReport
);

/**
 * @swagger
 * /api/admin/jobs/update-expired-licenses:
 *   post:
 *     summary: Manually trigger update expired licenses job
 *     description: Updates expired licenses based on subscription status. This should be run as a cron job every 1-2 hours. Prevents concurrent executions.
 *     tags: [Admin - Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job completed successfully
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
 *                         updated:
 *                           type: integer
 *                           example: 5
 *                         message:
 *                           type: string
 *                           example: Successfully updated 5 expired license(s)
 *       409:
 *         description: Job is already running
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/jobs/update-expired-licenses', AdminStatsController.updateExpiredLicenses);

export default router;

