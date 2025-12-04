import { Router } from 'express';
import { getMetrics, resetMetrics } from '../controllers/metrics.controller';
import { authenticateAdmin } from '../middleware/auth.middleware';

const router = Router();

// All metrics routes require admin authentication
router.use(authenticateAdmin);

/**
 * @swagger
 * /api/metrics:
 *   get:
 *     summary: Get system metrics
 *     description: Retrieve system performance metrics including request counts, response times, and error rates (admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
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
 *                         totalRequests:
 *                           type: integer
 *                           example: 1000
 *                         successfulRequests:
 *                           type: integer
 *                           example: 950
 *                         failedRequests:
 *                           type: integer
 *                           example: 50
 *                         averageResponseTime:
 *                           type: number
 *                           example: 125.5
 *                         errorRate:
 *                           type: number
 *                           example: 0.05
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/', getMetrics);

/**
 * @swagger
 * /api/metrics/reset:
 *   post:
 *     summary: Reset system metrics
 *     description: Reset all system metrics counters to zero (admin only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
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
 *                         message:
 *                           type: string
 *                           example: Metrics reset successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/reset', resetMetrics);

export default router;

