import prisma from '../config/database';
import { logger } from '../utils/logger';
import { WhatsAppService } from './whatsapp.service';

export interface SendOTPInput {
  phone: string;
}

export interface VerifyOTPInput {
  phone: string;
  otpCode: string;
}

export interface PhoneVerificationResult {
  success: boolean;
  verificationToken?: string;
  message: string;
  expiresAt?: Date;
}

/**
 * Phone Verification Service
 * Handles phone number verification via OTP (One-Time Password) sent via WhatsApp
 */
export class PhoneVerificationService {
  // OTP expiration time: 10 minutes
  private static readonly OTP_EXPIRY_MINUTES = 10;
  
  // OTP length: 6 digits
  private static readonly OTP_LENGTH = 6;

  /**
   * Generate a random OTP code
   */
  private static generateOTP(): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < this.OTP_LENGTH; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  /**
   * Normalize phone number (remove all non-digit characters except + at start)
   */
  private static normalizePhone(phone: string): string {
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) {
      return '+' + cleaned.slice(1).replace(/\D/g, '');
    }
    return cleaned.replace(/\D/g, '');
  }

  /**
   * Send OTP to phone number via WhatsApp
   */
  static async sendOTP(input: SendOTPInput): Promise<PhoneVerificationResult> {
    try {
      const normalizedPhone = this.normalizePhone(input.phone);

      if (!normalizedPhone || normalizedPhone.length < 10) {
        return {
          success: false,
          message: 'Invalid phone number format',
        };
      }

      // Generate OTP
      const otpCode = this.generateOTP();

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

      // Invalidate any existing unverified OTPs for this phone
      await prisma.phoneVerification.updateMany({
        where: {
          phone: normalizedPhone,
          verified: false,
        },
        data: {
          verified: true, // Mark as used/invalid
        },
      });

      // Create new verification record
      const verification = await prisma.phoneVerification.create({
        data: {
          phone: normalizedPhone,
          otpCode,
          expiresAt,
          verified: false,
        },
      });

      // Send OTP via WhatsApp
      const message = this.getOTPMessage(otpCode);
      const whatsappSent = await WhatsAppService.sendOTP(normalizedPhone, message);

      if (!whatsappSent) {
        logger.warn('Failed to send OTP via WhatsApp', { phone: normalizedPhone });
        // Still return success if WhatsApp fails (for development/testing)
        // In production, you might want to return false here
      }

      logger.info('OTP sent successfully', {
        phone: normalizedPhone,
        expiresAt: verification.expiresAt,
      });

      return {
        success: true,
        message: 'OTP sent successfully',
        expiresAt: verification.expiresAt,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending OTP', {
        phone: input.phone,
        error: errorMessage,
      });
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
      };
    }
  }

  /**
   * Verify OTP code
   */
  static async verifyOTP(input: VerifyOTPInput): Promise<PhoneVerificationResult> {
    try {
      const normalizedPhone = this.normalizePhone(input.phone);
      const otpCode = input.otpCode.trim();

      if (!normalizedPhone || normalizedPhone.length < 10) {
        return {
          success: false,
          message: 'Invalid phone number format',
        };
      }

      if (!otpCode || otpCode.length !== this.OTP_LENGTH) {
        return {
          success: false,
          message: 'Invalid OTP code format',
        };
      }

      // Find the most recent unverified OTP for this phone
      const verification = await prisma.phoneVerification.findFirst({
        where: {
          phone: normalizedPhone,
          otpCode,
          verified: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!verification) {
        logger.warn('OTP verification failed: code not found', {
          phone: normalizedPhone,
        });
        return {
          success: false,
          message: 'Invalid or expired OTP code',
        };
      }

      // Check if OTP has expired
      if (new Date() > verification.expiresAt) {
        logger.warn('OTP verification failed: expired', {
          phone: normalizedPhone,
          expiresAt: verification.expiresAt,
        });
        return {
          success: false,
          message: 'OTP code has expired. Please request a new one.',
        };
      }

      // Mark as verified
      const updated = await prisma.phoneVerification.update({
        where: {
          id: verification.id,
        },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      // Generate verification token (simple hash of phone + timestamp)
      // In production, you might want to use JWT or a more secure token
      const verificationToken = this.generateVerificationToken(normalizedPhone);

      logger.info('OTP verified successfully', {
        phone: normalizedPhone,
        verifiedAt: updated.verifiedAt,
      });

      return {
        success: true,
        verificationToken,
        message: 'Phone number verified successfully',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error verifying OTP', {
        phone: input.phone,
        error: errorMessage,
      });
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.',
      };
    }
  }

  /**
   * Check if phone number is verified (has a recent verified OTP)
   * Verification is valid for 1 hour after verification
   */
  static async isPhoneVerified(phone: string, verificationToken?: string): Promise<boolean> {
    try {
      const normalizedPhone = this.normalizePhone(phone);

      // If verification token is provided, validate it
      if (verificationToken) {
        const isValidToken = this.validateVerificationToken(verificationToken, normalizedPhone);
        if (!isValidToken) {
          return false;
        }
      }

      // Check for recent verified OTP (within last hour)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const verification = await prisma.phoneVerification.findFirst({
        where: {
          phone: normalizedPhone,
          verified: true,
          verifiedAt: {
            gte: oneHourAgo,
          },
        },
        orderBy: {
          verifiedAt: 'desc',
        },
      });

      return !!verification;
    } catch (error: unknown) {
      logger.error('Error checking phone verification', {
        phone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if phone number has ever been verified (for license-related messages)
   * This checks if there's any verified record, not just within the last hour
   */
  static async hasPhoneBeenVerified(phone: string): Promise<boolean> {
    try {
      const normalizedPhone = this.normalizePhone(phone);

      const verification = await prisma.phoneVerification.findFirst({
        where: {
          phone: normalizedPhone,
          verified: true,
          verifiedAt: {
            not: null,
          },
        },
        orderBy: {
          verifiedAt: 'desc',
        },
      });

      return !!verification;
    } catch (error: unknown) {
      logger.error('Error checking if phone has been verified', {
        phone,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generate verification token
   * Simple implementation - in production, use JWT or similar
   */
  private static generateVerificationToken(phone: string): string {
    const timestamp = Date.now();
    const data = `${phone}:${timestamp}`;
    // Simple base64 encoding (in production, use proper JWT)
    return Buffer.from(data).toString('base64');
  }

  /**
   * Validate verification token
   */
  private static validateVerificationToken(token: string, phone: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [tokenPhone, timestampStr] = decoded.split(':');
      const timestamp = parseInt(timestampStr, 10);

      // Token is valid for 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      return tokenPhone === phone && timestamp > oneHourAgo;
    } catch {
      return false;
    }
  }

  /**
   * Get OTP message template
   */
  private static getOTPMessage(otpCode: string): string {
    return `🔐 DigitalizePOS Phone Verification

Your verification code is: ${otpCode}

This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.

If you didn't request this code, please ignore this message.

This is an automated message from DigitalizePOS.`;
  }

  /**
   * Clean up expired verifications (can be called periodically)
   */
  static async cleanupExpiredVerifications(): Promise<number> {
    try {
      const result = await prisma.phoneVerification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          verified: false,
        },
      });

      logger.info('Cleaned up expired verifications', {
        count: result.count,
      });

      return result.count;
    } catch (error: unknown) {
      logger.error('Error cleaning up expired verifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

