import { Request, Response } from 'express';
import { LicenseService, CreateLicenseInput } from '../services/license.service';
import { PublicLicenseService } from '../services/publicLicense.service';
import { EmailService } from '../services/email.service';
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
        customerEmail: req.body.customerEmail,
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
        customerEmail: license.customerEmail,
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
          customerEmail: result.customerEmail,
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
   * Send activation credentials via email
   * POST /api/license/send-credentials
   */
  static async sendCredentials(req: Request, res: Response): Promise<void> {
    try {
      const { licenseKey, username, password, locationName, locationAddress, customerName, customerEmail } = req.body;

      if (!licenseKey || !username || !password || !locationName || !locationAddress) {
        ResponseUtil.error(
          res,
          'License key, username, password, location name, and location address are required',
          400
        );
        return;
      }

      // If customer email is not provided, try to get it from the license
      let email = customerEmail;
      if (!email) {
        const license = await LicenseService.findLicenseByKey(licenseKey);
        if (license) {
          email = license.customerEmail;
        }
      }

      if (!email) {
        ResponseUtil.error(res, 'Customer email is required to send credentials', 400);
        return;
      }

      const emailSent = await EmailService.sendActivationCredentials(email, {
        username,
        password,
        licenseKey,
        locationName,
        locationAddress,
        customerName: customerName || null,
      });

      if (emailSent) {
        logger.info('Credentials email sent successfully', {
          licenseKey: licenseKey.substring(0, 8) + '...',
          email,
        });
        ResponseUtil.success(res, { email }, 'Credentials email sent successfully');
      } else {
        logger.warn('Failed to send credentials email (email service may be disabled)', {
          licenseKey: licenseKey.substring(0, 8) + '...',
          email,
        });
        // Return success even if email fails, as credentials are still saved locally
        ResponseUtil.success(
          res,
          { email, emailSent: false },
          'Credentials saved, but email could not be sent. Please check email configuration.',
          200
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send credentials email';
      logger.error('Error sending credentials email', { error: errorMessage });
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
}

