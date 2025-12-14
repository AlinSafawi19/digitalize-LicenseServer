import { Request, Response } from 'express';
import { PhoneVerificationService } from '../services/phoneVerification.service';
import { ResponseUtil } from '../utils/response.util';
import { logger } from '../utils/logger';

/**
 * Phone Verification Controller
 * Handles HTTP requests for phone verification operations
 */
export class PhoneVerificationController {
  /**
   * Send OTP to phone number
   * POST /api/phone-verification/send-otp
   */
  static async sendOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone } = req.body;

      if (!phone) {
        ResponseUtil.error(res, 'Phone number is required', 400);
        return;
      }

      const result = await PhoneVerificationService.sendOTP({ phone });

      if (result.success) {
        logger.info('OTP sent successfully', { phone });
        ResponseUtil.success(
          res,
          {
            expiresAt: result.expiresAt,
          },
          result.message,
          200
        );
      } else {
        logger.warn('Failed to send OTP', { phone, message: result.message });
        ResponseUtil.error(res, result.message, 400);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send OTP';
      logger.error('Error sending OTP', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Verify OTP code
   * POST /api/phone-verification/verify-otp
   */
  static async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { phone, otpCode } = req.body;

      if (!phone) {
        ResponseUtil.error(res, 'Phone number is required', 400);
        return;
      }

      if (!otpCode) {
        ResponseUtil.error(res, 'OTP code is required', 400);
        return;
      }

      const result = await PhoneVerificationService.verifyOTP({ phone, otpCode });

      if (result.success) {
        logger.info('OTP verified successfully', { phone });
        ResponseUtil.success(
          res,
          {
            verificationToken: result.verificationToken,
          },
          result.message,
          200
        );
      } else {
        logger.warn('OTP verification failed', { phone, message: result.message });
        ResponseUtil.error(res, result.message, 400);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify OTP';
      logger.error('Error verifying OTP', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

