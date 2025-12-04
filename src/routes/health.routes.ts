import { Router } from 'express';
import { healthCheck } from '../controllers/health.controller';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the server, database, and system resources
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: object
 *                   properties:
 *                     seconds:
 *                       type: number
 *                       example: 86400
 *                     formatted:
 *                       type: string
 *                       example: 1d 0h 0m 0s
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: connected
 *                     responseTime:
 *                       type: string
 *                       example: 5ms
 *                 memory:
 *                   type: object
 *                   properties:
 *                     system:
 *                       type: object
 *                     process:
 *                       type: object
 *                 system:
 *                   type: object
 *       503:
 *         description: Server is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/', healthCheck);

export default router;

