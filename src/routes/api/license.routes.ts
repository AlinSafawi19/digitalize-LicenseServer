import { Router } from 'express';
import { LicenseController } from '../../controllers/license.controller';
import {
  validateCustomerName,
  validateCustomerPhone,
  validateInitialPrice,
  validateLocationName,
  validateLocationAddress,
  validateLicenseKeyRequired,
  validateHardwareId,
  validateHardwareIdOptional,
  validateMachineName,
  validateCurrentTime,
  handleValidationErrors,
} from '../../middleware/validation.middleware';
import { validationLimiter } from '../../config/rateLimit.config';

const router = Router();

/**
 * @swagger
 * /api/license/generate:
 *   post:
 *     summary: Generate a new license key
 *     tags: [License]
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
 *         description: License generated successfully
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
 *                         licenseKey:
 *                           type: string
 *                           example: ABCD-1234-EFGH-5678-XXXX
 *                         licenseId:
 *                           type: integer
 *                           example: 1
 *                         status:
 *                           type: string
 *                           example: active
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/generate',
  [
    validateCustomerName(),
    validateCustomerPhone(),
    validateInitialPrice(),
    validateLocationName(),
    validateLocationAddress(),
    handleValidationErrors,
  ],
  LicenseController.generateLicense,
);

/**
 * @swagger
 * /api/license/activate:
 *   post:
 *     summary: Activate a license key for a device
 *     description: Activate a license key with hardware ID. Allows multiple devices at the same location.
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - hardwareId
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 example: abc123def456...
 *               machineName:
 *                 type: string
 *                 example: DESKTOP-ABC123
 *               appType:
 *                 type: string
 *                 enum: [grocery]
 *                 description: Type of POS application (grocery)
 *                 example: grocery
 *     responses:
 *       200:
 *         description: License activated successfully
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
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         gracePeriodEnd:
 *                           type: string
 *                           format: date-time
 *                         token:
 *                           type: string
 *                           description: JWT validation token
 *                         locationId:
 *                           type: integer
 *                         locationName:
 *                           type: string
 *                           example: ABC Grocery Shop
 *                         locationAddress:
 *                           type: string
 *                           example: 123 Main Street, City, Country
 *       400:
 *         description: Activation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/activate',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareId(),
    validateMachineName(),
    handleValidationErrors,
  ],
  LicenseController.activate,
);

/**
 * @swagger
 * /api/license/validate:
 *   post:
 *     summary: Validate a license
 *     description: Validate license status. Hardware ID is optional and used only for tracking. Returns current license status and expiration information.
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 description: Optional - used for tracking purposes only
 *                 example: abc123def456...
 *               currentTime:
 *                 type: number
 *                 description: Current timestamp (optional)
 *                 example: 1704067200000
 *               locationAddress:
 *                 type: string
 *                 description: Location address for verification
 *                 example: 123 Main Street, City, Country
 *     responses:
 *       200:
 *         description: License is valid
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
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         gracePeriodEnd:
 *                           type: string
 *                           format: date-time
 *                         daysRemaining:
 *                           type: integer
 *       400:
 *         description: License is invalid or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/validate',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareIdOptional(), // Optional - no longer required for validation
    validateCurrentTime(),
    handleValidationErrors,
  ],
  LicenseController.validate,
);

/**
 * @swagger
 * /api/license/send-credentials:
 *   post:
 *     summary: Send activation credentials via WhatsApp
 *     description: Sends login credentials to the customer's phone number via WhatsApp after license activation
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - username
 *               - password
 *               - locationName
 *               - locationAddress
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               username:
 *                 type: string
 *                 example: admin_abc_grocery_shop
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *               locationName:
 *                 type: string
 *                 example: ABC Grocery Shop
 *               locationAddress:
 *                 type: string
 *                 example: 123 Main Street, City, Country
 *               customerName:
 *                 type: string
 *                 example: John Doe
 *               customerPhone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *     responses:
 *       200:
 *         description: Credentials WhatsApp message sent successfully (or WhatsApp service disabled)
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
 *                         phone:
 *                           type: string
 *                         whatsappSent:
 *                           type: boolean
 *       400:
 *         description: Invalid request or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/send-credentials',
  validationLimiter,
  [validateLicenseKeyRequired(), handleValidationErrors],
  LicenseController.sendCredentials,
);

/**
 * @swagger
 * /api/license/send-license-details:
 *   post:
 *     summary: Send license details via WhatsApp after phone verification
 *     description: Sends license key and details to the customer's phone number via WhatsApp after phone verification
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - customerPhone
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               customerPhone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *     responses:
 *       200:
 *         description: License details WhatsApp message sent successfully (or WhatsApp service disabled)
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
 *                         phone:
 *                           type: string
 *                         whatsappSent:
 *                           type: boolean
 *       400:
 *         description: Invalid request, phone not verified, or phone doesn't match license
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/send-license-details',
  validationLimiter,
  [validateLicenseKeyRequired(), validateCustomerPhone(), handleValidationErrors],
  LicenseController.sendLicenseDetails,
);

/**
 * @swagger
 * /api/license/{key}:
 *   get:
 *     summary: Get license details by key
 *     tags: [License]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: License key
 *         example: ABCD-1234-EFGH-5678-XXXX
 *     responses:
 *       200:
 *         description: License details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/License'
 *       404:
 *         description: License not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:key', validationLimiter, LicenseController.getLicenseByKey);

/**
 * @swagger
 * /api/license/{key}/status:
 *   get:
 *     summary: Check license status
 *     tags: [License]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: License key
 *         example: ABCD-1234-EFGH-5678-XXXX
 *     responses:
 *       200:
 *         description: License status
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LicenseStatus'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:key/status', validationLimiter, LicenseController.checkStatus);

/**
 * @swagger
 * /api/license/check-user-creation:
 *   post:
 *     summary: Check if user creation is allowed for a license
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 description: Optional - used for tracking purposes only
 *                 example: ABC123XYZ
 *     responses:
 *       200:
 *         description: User creation check result
 *       403:
 *         description: User creation not allowed
 *       500:
 *         description: Server error
 */
router.post(
  '/check-user-creation',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareIdOptional(), // Optional - no longer required
  ],
  handleValidationErrors,
  LicenseController.checkUserCreation
);

/**
 * @swagger
 * /api/license/increment-user-count:
 *   post:
 *     summary: Increment user count when a user is created in POS app
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 description: Optional - used for tracking purposes only
 *                 example: ABC123XYZ
 *     responses:
 *       200:
 *         description: User count incremented successfully
 *       403:
 *         description: User limit reached or invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/increment-user-count',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareIdOptional(), // Optional - no longer required
  ],
  handleValidationErrors,
  LicenseController.incrementUserCount
);

/**
 * @swagger
 * /api/license/decrement-user-count:
 *   post:
 *     summary: Decrement user count when a user is deleted in POS app
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 description: Optional - used for tracking purposes only
 *                 example: ABC123XYZ
 *     responses:
 *       200:
 *         description: User count decremented successfully
 *       403:
 *         description: Invalid request or user count already at 0
 *       500:
 *         description: Server error
 */
router.post(
  '/decrement-user-count',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareIdOptional(), // Optional - no longer required
  ],
  handleValidationErrors,
  LicenseController.decrementUserCount
);

/**
 * @swagger
 * /api/license/sync-user-count:
 *   post:
 *     summary: Sync user count with actual number of users from POS app
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - licenseKey
 *               - actualUserCount
 *             properties:
 *               licenseKey:
 *                 type: string
 *                 example: ABCD-1234-EFGH-5678-XXXX
 *               hardwareId:
 *                 type: string
 *                 description: Optional - used for tracking purposes only
 *                 example: ABC123XYZ
 *               actualUserCount:
 *                 type: integer
 *                 minimum: 0
 *                 example: 3
 *     responses:
 *       200:
 *         description: User count synced successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post(
  '/sync-user-count',
  validationLimiter,
  [
    validateLicenseKeyRequired(),
    validateHardwareIdOptional(), // Optional - no longer required
  ],
  handleValidationErrors,
  LicenseController.syncUserCount
);

/**
 * @swagger
 * /api/license/test-whatsapp:
 *   post:
 *     summary: Test WhatsApp configuration and send a test message
 *     tags: [License]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 format: tel
 *                 example: +9611234567
 *                 description: Phone number in E.164 format (e.g., +9611234567)
 *               message:
 *                 type: string
 *                 example: Test message
 *                 description: Optional custom test message
 *     responses:
 *       200:
 *         description: Test message sent successfully
 *       400:
 *         description: Invalid request or configuration error
 *       500:
 *         description: Server error
 */
router.post(
  '/test-whatsapp',
  validationLimiter,
  [
    validateCustomerPhone(), // Reuse phone validation
  ],
  handleValidationErrors,
  LicenseController.testWhatsApp
);

export default router;

