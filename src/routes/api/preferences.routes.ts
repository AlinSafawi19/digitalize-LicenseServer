import { Router } from 'express';
import { PreferencesController } from '../../controllers/preferences.controller';
import { authenticateAdmin } from '../../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/preferences:
 *   get:
 *     summary: Get application preferences
 *     description: Retrieves the current application preferences including general, customer, and license type version preferences
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences retrieved successfully
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
 *                   example: Preferences retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     general:
 *                       type: object
 *                       properties:
 *                         phoneNumberVerification:
 *                           type: boolean
 *                           example: true
 *                     customer:
 *                       type: object
 *                       example: {}
 *                     licenseTypeVersion:
 *                       type: object
 *                       example: {}
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/preferences/public:
 *   get:
 *     summary: Get public preferences (phone verification status)
 *     description: Retrieves the phone verification preference setting without authentication
 *     tags: [Preferences]
 *     responses:
 *       200:
 *         description: Public preferences retrieved successfully
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
 *                   example: Public preferences retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     general:
 *                       type: object
 *                       properties:
 *                         phoneNumberVerification:
 *                           type: boolean
 *                           example: true
 *       500:
 *         description: Internal server error
 */
router.get('/public', PreferencesController.getPublicPreferences);

router.get('/', authenticateAdmin, PreferencesController.getPreferences);

/**
 * @swagger
 * /api/preferences:
 *   patch:
 *     summary: Update application preferences
 *     description: Updates one or more preference sections (general, customer, licenseTypeVersion)
 *     tags: [Preferences]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               general:
 *                 type: object
 *                 properties:
 *                   phoneNumberVerification:
 *                     type: boolean
 *                     example: true
 *               customer:
 *                 type: object
 *                 example: {}
 *               licenseTypeVersion:
 *                 type: object
 *                 example: {}
 *     responses:
 *       200:
 *         description: Preferences updated successfully
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
 *                   example: Preferences updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     general:
 *                       type: object
 *                       properties:
 *                         phoneNumberVerification:
 *                           type: boolean
 *                           example: true
 *                     customer:
 *                       type: object
 *                       example: {}
 *                     licenseTypeVersion:
 *                       type: object
 *                       example: {}
 *       400:
 *         description: Bad request - at least one preference section must be provided
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch('/', authenticateAdmin, PreferencesController.updatePreferences);

export default router;

