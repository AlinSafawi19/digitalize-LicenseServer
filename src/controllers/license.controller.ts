import { Request, Response } from 'express';
import { LicenseService, CreateLicenseInput } from '../services/license.service';
import { PublicLicenseService } from '../services/publicLicense.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { ResponseUtil } from '../utils/response.util';
import { logger } from '../utils/logger';

/**
 * License Controller
 * Handles HTTP requests for license operations
 */
export class LicenseController {
  /**
   * Generate a new license
   * POST /api/license/generate
   */
  static async generateLicense(req: Request, res: Response): Promise<void> {
    try {
      const input: CreateLicenseInput = {
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        verificationToken: req.body.verificationToken,
        initialPrice: req.body.initialPrice !== undefined && req.body.initialPrice !== null 
          ? parseFloat(String(req.body.initialPrice)) 
          : undefined,
        annualPrice: req.body.annualPrice !== undefined && req.body.annualPrice !== null
          ? parseFloat(String(req.body.annualPrice))
          : undefined,
        pricePerUser: req.body.pricePerUser !== undefined && req.body.pricePerUser !== null
          ? parseFloat(String(req.body.pricePerUser))
          : undefined,
        locationName: req.body.locationName,
        locationAddress: req.body.locationAddress,
        isFreeTrial: req.body.isFreeTrial === true || req.body.isFreeTrial === 'true',
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        version: req.body.version || 'grocery',
      };

      // Phone verification is no longer required before creating a license.
      // Free trials and paid licenses are created the same way here.
      const license = await LicenseService.createLicense(input);

      logger.info('License generated successfully', {
        licenseId: license.id,
        licenseKey: license.licenseKey,
      });

      ResponseUtil.success(
        res,
        {
          licenseKey: license.licenseKey,
          licenseId: license.id,
          status: license.status,
          isFreeTrial: license.isFreeTrial,
          freeTrialEndDate: license.freeTrialEndDate,
          expiresAt: license.subscriptions[0]?.endDate,
        },
        'License generated successfully',
        201,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate license';
      logger.error('Error generating license', { error: errorMessage });
      // Return 400 for validation errors (duplicate license), 500 for other errors
      const statusCode = errorMessage.includes('already exists') ? 400 : 500;
      ResponseUtil.error(res, errorMessage, statusCode);
    }
  }

  /**
   * Get license by key
   * GET /api/license/:key
   */
  static async getLicenseByKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const license = await LicenseService.findLicenseByKey(key);

      if (!license) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      // Get status information
      const status = await LicenseService.checkLicenseStatus(key);

      ResponseUtil.success(res, {
        id: license.id,
        licenseKey: license.licenseKey,
        customerName: license.customerName,
        customerPhone: license.customerPhone,
        status: license.status,
        isFreeTrial: license.isFreeTrial,
        freeTrialEndDate: license.freeTrialEndDate,
        locationName: license.locationName,
        locationAddress: license.locationAddress,
        purchaseDate: license.purchaseDate,
        initialPrice: license.initialPrice,
        pricePerUser: license.pricePerUser,
        userCount: license.userCount,
        userLimit: license.userLimit,
        isValid: status.valid,
        statusDetails: {
          status: status.status,
          message: status.message,
          expiresAt: status.expiresAt,
          gracePeriodEnd: status.gracePeriodEnd,
        },
        activations: license.activations,
        subscriptions: license.subscriptions,
        payments: license.payments,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get license';
      logger.error('Error getting license', { error: errorMessage, key: req.params.key });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Check license status
   * GET /api/license/:key/status
   */
  static async checkStatus(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;

      if (!key) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const status = await LicenseService.checkLicenseStatus(key);

      ResponseUtil.success(res, status);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check license status';
      logger.error('Error checking license status', { error: errorMessage, key: req.params.key });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Activate a license key for a device
   * POST /api/license/activate
   */
  static async activate(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId, machineName, appType } = req.body;

      if (!licenseKey || !hardwareId) {
        ResponseUtil.error(res, 'License key and hardware ID are required', 400);
        return;
      }

      const result = await PublicLicenseService.activateLicense({
        licenseKey,
        hardwareId,
        machineName,
        appType,
      });

      if (result.success) {
        // Return activation result matching plan format
        res.status(200).json({
          success: true,
          message: result.message,
          expiresAt: result.expiresAt,
          gracePeriodEnd: result.gracePeriodEnd,
          token: result.token,
          locationId: result.locationId,
          locationName: result.locationName,
          locationAddress: result.locationAddress,
          customerName: result.customerName,
          customerPhone: result.customerPhone,
          isReactivatingActive: result.isReactivatingActive || false,
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate license';
      logger.error('Error activating license', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Validate a license for a device
   * POST /api/license/validate
   */
  static async validate(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId, currentTime, locationAddress } = req.body;

      if (!licenseKey) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const result = await PublicLicenseService.validateLicense({
        licenseKey,
        hardwareId, // Optional - no longer required
        currentTime,
        locationAddress,
      });

      if (result.valid) {
        // Return validation result matching plan format
        res.status(200).json({
          valid: true,
          expiresAt: result.expiresAt,
          gracePeriodEnd: result.gracePeriodEnd,
          daysRemaining: result.daysRemaining,
          message: result.message,
        });
      } else {
        // Return validation result with additional data (expiresAt, gracePeriodEnd)
        res.status(400).json({
          valid: false,
          message: result.message,
          ...(result.expiresAt && { expiresAt: result.expiresAt }),
          ...(result.gracePeriodEnd && { gracePeriodEnd: result.gracePeriodEnd }),
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate license';
      logger.error('Error validating license', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Send activation credentials via WhatsApp
   * POST /api/license/send-credentials
   */
  static async sendCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, username, password, locationName, locationAddress, customerName, customerPhone } = req.body;

      if (!licenseKey || !username || !password || !locationName || !locationAddress) {
        ResponseUtil.error(
          res,
          'License key, username, password, location name, and location address are required',
          400
        );
        return;
      }

      // If customer phone is not provided, try to get it from the license
      let phone = customerPhone;
      if (!phone) {
        const license = await LicenseService.findLicenseByKey(licenseKey);
        if (license) {
          phone = license.customerPhone;
        }
      }

      if (!phone) {
        ResponseUtil.error(res, 'Customer phone number is required to send credentials', 400);
        return;
      }

      // Only send license-related messages to verified phone numbers
      const { PhoneVerificationService } = await import('../services/phoneVerification.service');
      const isVerified = await PhoneVerificationService.hasPhoneBeenVerified(phone);
      if (!isVerified) {
        ResponseUtil.error(res, 'Phone number must be verified before sending license-related information', 400);
        return;
      }

      const whatsappSent = await WhatsAppService.sendActivationCredentials(phone, {
        username,
        password,
        licenseKey,
        locationName,
        locationAddress,
        customerName: customerName || null,
      });

      if (whatsappSent) {
        logger.info('Credentials WhatsApp message sent successfully', {
          licenseKey: licenseKey.substring(0, 8) + '...',
          phone,
        });
        ResponseUtil.success(res, { phone }, 'Credentials WhatsApp message sent successfully');
      } else {
        logger.warn('Failed to send credentials WhatsApp message (WhatsApp service may be disabled)', {
          licenseKey: licenseKey.substring(0, 8) + '...',
          phone,
        });
        // Return success even if WhatsApp fails, as credentials are still saved locally
        ResponseUtil.success(
          res,
          { phone, whatsappSent: false },
          'Credentials saved, but WhatsApp message could not be sent. Please check WhatsApp configuration.',
          200
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send credentials WhatsApp message';
      logger.error('Error sending credentials WhatsApp message', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Check if user creation is allowed for a license
   * POST /api/license/check-user-creation
   */
  static async checkUserCreation(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId } = req.body;

      if (!licenseKey) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const result = await PublicLicenseService.checkUserCreationAllowed({
        licenseKey,
        hardwareId, // Optional - no longer required
      });

      if (result.canCreate) {
        ResponseUtil.success(res, result, result.message || 'User creation is allowed', 200);
      } else {
        ResponseUtil.error(res, result.message || 'User creation is not allowed', 403);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check user creation status';
      logger.error('Error checking user creation', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Increment user count when a user is created
   * POST /api/license/increment-user-count
   */
  static async incrementUserCount(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId } = req.body;

      if (!licenseKey) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const result = await PublicLicenseService.incrementUserCount({
        licenseKey,
        hardwareId, // Optional - no longer required
      });

      if (result.success) {
        ResponseUtil.success(res, result, result.message, 200);
      } else {
        ResponseUtil.error(res, result.message, 403);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to increment user count';
      logger.error('Error incrementing user count', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Decrement user count when a user is deleted in POS app
   * POST /api/license/decrement-user-count
   */
  static async decrementUserCount(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId } = req.body;

      if (!licenseKey) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      const result = await PublicLicenseService.decrementUserCount({
        licenseKey,
        hardwareId, // Optional - no longer required
      });

      if (result.success) {
        ResponseUtil.success(res, result, result.message, 200);
      } else {
        ResponseUtil.error(res, result.message, 403);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decrement user count';
      logger.error('Error decrementing user count', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Sync user count with actual number of users from POS app
   * POST /api/license/sync-user-count
   */
  static async syncUserCount(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId, actualUserCount } = req.body;

      if (!licenseKey) {
        ResponseUtil.error(res, 'License key is required', 400);
        return;
      }

      if (typeof actualUserCount !== 'number' || actualUserCount < 0) {
        ResponseUtil.error(res, 'Actual user count must be a non-negative number', 400);
        return;
      }

      const result = await PublicLicenseService.syncUserCount({
        licenseKey,
        hardwareId, // Optional - no longer required
        actualUserCount,
      });

      if (result.success) {
        ResponseUtil.success(res, result, result.message, 200);
      } else {
        ResponseUtil.error(res, result.message, 403);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync user count';
      logger.error('Error syncing user count', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Send license details via WhatsApp after phone verification
   * POST /api/license/send-license-details
   */
  static async sendLicenseDetails(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, customerPhone } = req.body;

      if (!licenseKey || !customerPhone) {
        ResponseUtil.error(
          res,
          'License key and customer phone number are required',
          400
        );
        return;
      }

      // Find the license
      const license = await LicenseService.findLicenseByKey(licenseKey);
      if (!license) {
        ResponseUtil.error(res, 'License not found', 404);
        return;
      }

      // Verify that the phone number matches
      const normalizedRequestPhone = customerPhone.trim().replace(/\D/g, '');
      const normalizedLicensePhone = license.customerPhone?.trim().replace(/\D/g, '') || '';
      
      if (normalizedRequestPhone !== normalizedLicensePhone) {
        ResponseUtil.error(res, 'Phone number does not match the license', 400);
        return;
      }

      // Only send license-related messages to verified phone numbers
      const { PhoneVerificationService } = await import('../services/phoneVerification.service');
      const isVerified = await PhoneVerificationService.hasPhoneBeenVerified(customerPhone);
      if (!isVerified) {
        ResponseUtil.error(res, 'Phone number must be verified before sending license-related information', 400);
        return;
      }

      // Get the active subscription for expiration date
      const activeSubscription = license.subscriptions?.find(sub => sub.status === 'active');
      const expiresAt = activeSubscription?.endDate || null;

      const whatsappSent = await WhatsAppService.sendLicenseDetails({
        customerName: license.customerName,
        customerPhone: customerPhone,
        licenseKey: license.licenseKey,
        locationName: license.locationName || '',
        locationAddress: license.locationAddress || '',
        isFreeTrial: license.isFreeTrial,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      if (whatsappSent) {
        logger.info('License details WhatsApp message sent successfully', {
          licenseKey,
          customerPhone,
        });
      }

      ResponseUtil.success(
        res,
        {
          phone: customerPhone,
          whatsappSent,
        },
        whatsappSent 
          ? 'License details sent successfully via WhatsApp' 
          : 'License details message queued (WhatsApp service may be disabled)',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send license details';
      logger.error('Error sending license details', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Roll back a license activation when POS-side activation fails
   * POST /api/license/rollback-activation
   */
  static async rollbackActivation(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, hardwareId } = req.body;

      if (!licenseKey || !hardwareId) {
        ResponseUtil.error(res, 'License key and hardware ID are required', 400);
        return;
      }

      const result = await PublicLicenseService.rollbackActivation({
        licenseKey,
        hardwareId,
      });

      if (result.success) {
        ResponseUtil.success(res, result, result.message, 200);
      } else {
        ResponseUtil.error(res, result.message, 400);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to roll back activation';
      logger.error('Error rolling back activation', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Test WhatsApp configuration and send a test message
   * POST /api/license/test-whatsapp
   */
  static async testWhatsApp(req: Request, res: Response): Promise<void> {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber) {
        ResponseUtil.error(res, 'Phone number is required', 400);
        return;
      }

      const testMessage = message || '🧪 This is a test message from DigitalizePOS License Server. WhatsApp integration is working correctly!';

      // Format phone number to E.164 format (add + if missing)
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        // Remove all non-digits and add +
        const digits = formattedPhone.replace(/\D/g, '');
        if (digits.length >= 8) {
          formattedPhone = '+' + digits;
        } else {
          ResponseUtil.error(
            res,
            `Invalid phone number format. Phone number must have at least 8 digits. Received: ${phoneNumber}`,
            400
          );
          return;
        }
      }

      logger.info('Attempting to send test WhatsApp message', {
        originalPhone: phoneNumber,
        formattedPhone: formattedPhone,
      });

      // First verify configuration
      const configValid = await WhatsAppService.verifyConfiguration();
      if (!configValid) {
        ResponseUtil.error(
          res,
          'WhatsApp configuration is invalid. Please check your environment variables (WHATSAPP_ACCOUNT_SID, WHATSAPP_AUTH_TOKEN, WHATSAPP_FROM_NUMBER).',
          400,
          {
            phoneNumber: formattedPhone,
            check: 'Verify all Twilio credentials are set in .env file',
          }
        );
        return;
      }

      // Send test message
      const result = await WhatsAppService.sendOTP(formattedPhone, testMessage);

      if (result.success) {
        ResponseUtil.success(
          res,
          { 
            phoneNumber: formattedPhone, 
            message: testMessage,
            note: phoneNumber !== formattedPhone 
              ? 'Phone number was automatically formatted to E.164 format' 
              : 'Phone number was already in E.164 format'
          },
          'Test WhatsApp message sent successfully!',
          200
        );
      } else {
        // Provide detailed error information from the service
        const errorInfo = result.error;
        const errorMessage = errorInfo?.message || 'Failed to send test WhatsApp message';
        
        ResponseUtil.error(
          res,
          errorMessage,
          500,
          {
            phoneNumber: formattedPhone,
            originalPhone: phoneNumber,
            errorCode: errorInfo?.code,
            errorStatus: errorInfo?.status,
            errorDetails: errorInfo?.details,
            moreInfo: errorInfo?.moreInfo,
            suggestions: [
              'Check server logs for detailed Twilio error messages',
              'Verify your Twilio WhatsApp number is approved and active',
              'Ensure your Twilio account has sufficient credits',
              'Verify the recipient phone number is valid and can receive WhatsApp messages',
              'Check that your WhatsApp Business account is properly configured in Twilio',
              errorInfo?.code === 21610 ? 'Note: For new conversations, you may need to use a message template approved by WhatsApp' : null,
              errorInfo?.code === 21608 ? 'Note: The recipient has opted out of WhatsApp messages' : null,
              errorInfo?.code === 63007 ? 'Note: Error 63007 - The recipient may not be in your allowed list. For test numbers, ensure they are added in Twilio Console under WhatsApp > Senders > Test Numbers' : null,
              errorInfo?.code === 63007 ? 'Note: Your WhatsApp Business account may not be fully configured. Check Twilio Console for WhatsApp setup status' : null,
              errorInfo?.code === 63016 ? 'Note: Your WhatsApp sender number is not registered or approved. Complete the WhatsApp Business registration in Twilio Console' : null,
              errorInfo?.code === 63040 ? 'Note: Your message template was rejected. Check template status in Twilio Console and resubmit if needed' : null,
              errorInfo?.code === 63041 ? 'Note: Your message template is paused. Review template quality issues in Twilio Console' : null,
              errorInfo?.status === 401 ? 'Note: Check your Twilio Account SID and Auth Token' : null,
              errorInfo?.status === 403 ? 'Note: Check your Twilio account permissions and WhatsApp sender approval' : null,
              errorInfo?.moreInfo ? `More info: ${errorInfo.moreInfo}` : null,
            ].filter(Boolean),
          }
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send test WhatsApp message';
      logger.error('Error sending test WhatsApp message', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

