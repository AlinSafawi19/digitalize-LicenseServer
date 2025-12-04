import { Router } from 'express';
import { AdminActivationController } from '../../controllers/adminActivation.controller';
import { authenticateAdmin } from '../../middleware/auth.middleware';
import { query, param } from 'express-validator';
import { validateRequest } from '../../middleware/validation.middleware';
import { adminLimiter } from '../../config/rateLimit.config';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Apply admin rate limiting to all routes
router.use(adminLimiter);

/**
 * @swagger
 * /api/admin/activations:
 *   get:
 *     summary: Get paginated list of all activations with filtering
 *     description: Retrieve a paginated list of all activations with optional filtering, searching, and sorting
 *     tags: [Admin - Activations]
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
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: [true, false, 1, 0]
 *         description: Filter by activation status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by hardware ID or machine name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, hardwareId, machineName, activatedAt, lastValidation, isActive]
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
 *         description: List of activations retrieved successfully
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
    query('isActive')
      .optional()
      .isIn(['true', 'false', '1', '0'])
      .withMessage('isActive must be true, false, 1, or 0'),
    query('search')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Search query must be between 1 and 255 characters'),
    query('sortBy')
      .optional()
      .isString()
      .isIn(['id', 'hardwareId', 'machineName', 'activatedAt', 'lastValidation', 'isActive'])
      .withMessage('Invalid sort field'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),
  ],
  validateRequest,
  AdminActivationController.getActivations
);

/**
 * @swagger
 * /api/admin/activations/{id}:
 *   get:
 *     summary: Get activation details by ID
 *     description: Retrieve detailed information about a specific activation
 *     tags: [Admin - Activations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activation ID
 *     responses:
 *       200:
 *         description: Activation details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Activation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Activation not found
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
      .withMessage('Activation ID must be a positive integer'),
  ],
  validateRequest,
  AdminActivationController.getActivationById
);

/**
 * @swagger
 * /api/admin/activations/{id}:
 *   delete:
 *     summary: Deactivate activation
 *     description: Deactivate an activation by setting isActive to false (soft delete)
 *     tags: [Admin - Activations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activation ID
 *     responses:
 *       200:
 *         description: Activation deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Activation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Activation not found
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
      .withMessage('Activation ID must be a positive integer'),
  ],
  validateRequest,
  AdminActivationController.deactivateActivation
);

export default router;

