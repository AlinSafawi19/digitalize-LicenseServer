import { Router } from 'express';
import { PhoneVerificationController } from '../../controllers/phoneVerification.controller';
import { body } from 'express-validator';
import { handleValidationErrors } from '../../middleware/validation.middleware';
import { validationLimiter } from '../../config/rateLimit.config';

const router = Router();

/**
 * @swagger
 * /api/phone-verification/send-otp:
 *   post:
 *     summary: Send OTP to phone number for verification
 *     tags: [Phone Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *     responses:
 *       200:
 *         description: OTP sent successfully
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
 *       400:
 *         description: Validation error or failed to send OTP
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
  '/send-otp',
  validationLimiter,
  [
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isString()
      .withMessage('Phone number must be a string')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('Phone number must be a valid phone number'),
    handleValidationErrors,
  ],
  PhoneVerificationController.sendOTP
);

/**
 * @swagger
 * /api/phone-verification/verify-otp:
 *   post:
 *     summary: Verify OTP code
 *     tags: [Phone Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otpCode
 *             properties:
 *               phone:
 *                 type: string
 *                 format: tel
 *                 example: +1234567890
 *               otpCode:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully
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
 *                         verificationToken:
 *                           type: string
 *                           description: Token to be used when creating license
 *       400:
 *         description: Validation error or invalid/expired OTP
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
  '/verify-otp',
  validationLimiter,
  [
    body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isString()
      .withMessage('Phone number must be a string')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
      .withMessage('Phone number must be a valid phone number'),
    body('otpCode')
      .notEmpty()
      .withMessage('OTP code is required')
      .isString()
      .withMessage('OTP code must be a string')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP code must be 6 digits'),
    handleValidationErrors,
  ],
  PhoneVerificationController.verifyOTP
);

export default router;

