import prisma from '../config/database';
import { LicenseKeyGeneratorService } from './licenseKeyGenerator.service';
import { LicenseService } from './license.service';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { logger, logLicenseOperation } from '../utils/logger';
import { config } from '../config/config';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface ActivateLicenseInput {
  licenseKey: string;
  hardwareId: string;
  machineName?: string;
  appType?: 'grocery'; // Type of POS application (grocery)
  location?: {
    name: string;
    address: string;
  };
}

export interface ActivateLicenseResult {
  success: boolean;
  message: string;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  token?: string;
  locationId?: number;
  locationName?: string;
  locationAddress?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  isReactivatingActive?: boolean; // Flag indicating if reactivating an already active license
}

export interface ValidateLicenseInput {
  licenseKey: string;
  hardwareId?: string; // Optional - no longer required for validation
  currentTime?: number;
  locationAddress?: string;
}

export interface ValidateLicenseResult {
  valid: boolean;
  expiresAt?: Date;
  gracePeriodEnd?: Date;
  daysRemaining?: number;
  message: string;
}

/**
 * Public License Service
 * Handles public-facing license operations: activation and validation
 */
export class PublicLicenseService {
  /**
   * Activate a license key for a device at a location
   * @param input Activation input data
   * @returns Promise<ActivateLicenseResult> Activation result
   */
  static async activateLicense(input: ActivateLicenseInput): Promise<ActivateLicenseResult> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Validate license key format and checksum
      if (!LicenseKeyGeneratorService.validateLicenseKeyFormatAndChecksum(normalizedKey)) {
        return {
          success: false,
          message: 'License key format is invalid',
        };
      }

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          success: false,
          message: 'License key is invalid',
        };
      }

      // Check if license is revoked or suspended
      if (license.status === 'revoked') {
        return {
          success: false,
          message: 'License has been revoked',
        };
      }

      if (license.status === 'suspended') {
        return {
          success: false,
          message: 'License is currently suspended',
        };
      }

      if (!license.locationName || !license.locationAddress) {
        return {
          success: false,
          message: 'License does not have location information. Please contact administrator to update the location information.',
        };
      }

      // Validate license version matches app type
      // For grocery POS app, license version must be 'grocery'
      if (input.appType === 'grocery' && license.version !== 'grocery') {
        return {
          success: false,
          message: `This license is not valid for grocery POS. License version is '${license.version}', but grocery POS requires 'grocery' version.`,
        };
      }

      const locationName = license.locationName;
      const locationAddress = license.locationAddress;

      // Check if this hardware ID is already activated for ANY other license
      // This prevents activating multiple licenses on the same device
      const existingActivationForOtherLicense = await prisma.activation.findFirst({
        where: {
          hardwareId: input.hardwareId,
          isActive: true,
          licenseId: {
            not: license.id, // Different license
          },
        },
        include: {
          license: {
            select: {
              licenseKey: true,
              customerName: true,
            },
          },
        },
      });

      if (existingActivationForOtherLicense) {
        logger.warn('License activation blocked: device already has a different license activated', {
          hardwareId: input.hardwareId,
          existingLicenseKey: existingActivationForOtherLicense.license.licenseKey.substring(0, 8) + '...',
          newLicenseKey: normalizedKey.substring(0, 8) + '...',
        });
        return {
          success: false,
          message: 'This device already has a license activated. You cannot activate a different license on the same device. If you need more users, please contact your license supplier to add more users to your existing license.',
        };
      }

      // Check if this hardware ID is already activated for this license
      const existingActivation = await prisma.activation.findUnique({
        where: {
          licenseId_hardwareId: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
          },
        },
      });

      // Handle reactivation scenarios
      let activation;
      let isNewActivation = false;
      let isReactivatingActiveLicense = false;
      
      if (existingActivation && existingActivation.isActive) {
        // License is already active - allow reactivation but preserve existing data
        // Just update the last validation timestamp and machine name
        activation = await prisma.activation.update({
          where: {
            id: existingActivation.id,
          },
          data: {
            machineName: input.machineName,
            lastValidation: new Date(),
            // Don't update activatedAt - preserve original activation date
          },
        });
        
        isReactivatingActiveLicense = true;
        logger.info('Reactivating already active license - preserving existing data', {
          activationId: activation.id,
          licenseId: license.id,
          hardwareId: input.hardwareId,
        });
      } else if (existingActivation && !existingActivation.isActive) {
        // Reactivate inactive activation
        activation = await prisma.activation.update({
          where: {
            id: existingActivation.id,
          },
          data: {
            isActive: true,
            machineName: input.machineName,
            lastValidation: new Date(),
            activatedAt: new Date(), // Update activation date for reactivation
          },
        });

        logger.info('Activation reactivated', {
          activationId: activation.id,
          licenseId: license.id,
          hardwareId: input.hardwareId,
        });
      } else {
        // Create new activation record
        activation = await prisma.activation.create({
          data: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
            machineName: input.machineName,
            isActive: true,
            lastValidation: new Date(),
          },
        });
        isNewActivation = true;
      }
      
      // Set userCount = 1 when license is first activated (default user is created)
      // Only update if this is a NEW activation AND userCount is 0 (first activation ever)
      // Do NOT update userCount on reactivation, as the default user already exists
      // Note: User count will be synced by POS app after reactivation
      if (isNewActivation && license.userCount === 0) {
        await prisma.license.update({
          where: { id: license.id },
          data: { userCount: 1 },
        });
        
        logger.info('User count set to 1 for new license activation', {
          licenseId: license.id,
          licenseKey: license.licenseKey,
          hardwareId: input.hardwareId,
        });
      }

      // Ensure subscription exists (should already exist, but create if missing)
      let activeSubscription = license.subscriptions.find((sub) => sub.status === 'active');
      if (!activeSubscription) {
        // Create subscription if it doesn't exist
        const startDate = new Date();
        // Default: subscription ends in 1 year (exactly 365 days)
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        // Subtract 1 day to get exactly 365 days (not 365+ hours)
        endDate.setDate(endDate.getDate() - 1);
        // Set to end of day (23:59:59.999) to ensure full day is counted
        endDate.setHours(23, 59, 59, 999);
        // No grace period - expiration is exact end date

        const newSubscription = await SubscriptionService.createSubscription(license.id, {
          startDate,
          endDate,
          annualFee: config.annualSubscriptionPrice,
        });

        activeSubscription = {
          id: newSubscription.id,
          startDate: newSubscription.startDate,
          endDate: newSubscription.endDate,
          status: newSubscription.status,
          gracePeriodEnd: newSubscription.gracePeriodEnd,
        } as NonNullable<typeof activeSubscription>;
      }

      // At this point, activeSubscription is guaranteed to be defined
      if (!activeSubscription) {
        throw new Error('Failed to create or find active subscription');
      }

      // Generate JWT token for validation
      const tokenPayload = {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId,
        locationId: license.id, // Using license ID as location ID
      };

      const jwtSecret = config.jwtSecret;
      if (!jwtSecret || jwtSecret.trim() === '') {
        throw new Error('JWT_SECRET is not configured');
      }

      const token = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: '365d', // Token valid for 1 year
      } as SignOptions);

      // Log activation
      logLicenseOperation('activation', {
        operation: 'activation',
        activationId: activation.id,
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId,
        machineName: input.machineName,
        locationName: locationName,
        locationAddress: locationAddress,
      });

      return {
        success: true,
        message: isReactivatingActiveLicense 
          ? 'License reactivated successfully (already active - data preserved)'
          : 'License activated successfully',
        expiresAt: activeSubscription.endDate,
        gracePeriodEnd: activeSubscription.endDate, // No grace period - equals endDate
        token,
        locationId: license.id,
        locationName,
        locationAddress,
        customerName: license.customerName,
        customerPhone: license.customerPhone,
        // Add flag to indicate if this is a reactivation of an active license
        isReactivatingActive: isReactivatingActiveLicense,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error activating license', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      // Handle unique constraint violation (hardware ID already activated)
      const errorWithCode = error as Error & { code?: string };
      if (errorWithCode.code === 'P2002') {
        return {
          success: false,
          message: 'This device is already activated for this license',
        };
      }

      return {
        success: false,
        message: errorMessage || 'Failed to activate license',
      };
    }
  }

  /**
   * Validate a license for a device
   * @param input Validation input data
   * @returns Promise<ValidateLicenseResult> Validation result
   */
  static async validateLicense(input: ValidateLicenseInput): Promise<ValidateLicenseResult> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Validate license key format
      if (!LicenseKeyGeneratorService.validateLicenseKeyFormatAndChecksum(normalizedKey)) {
        return {
          valid: false,
          message: 'License key format is invalid',
        };
      }

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          valid: false,
          message: 'License key not found',
        };
      }

      // Check if license is revoked or suspended
      if (license.status === 'revoked') {
        return {
          valid: false,
          message: 'License has been revoked',
        };
      }

      if (license.status === 'suspended') {
        return {
          valid: false,
          message: 'License is currently suspended',
        };
      }

      // Hardware ID is optional - if provided, update activation record for tracking
      // But validation no longer requires hardware ID match
      if (input.hardwareId) {
        const activation = await prisma.activation.findUnique({
          where: {
            licenseId_hardwareId: {
              licenseId: license.id,
              hardwareId: input.hardwareId,
            },
          },
        });

        // Update last validation timestamp if activation exists
        if (activation && activation.isActive) {
          await prisma.activation.update({
            where: { id: activation.id },
            data: { lastValidation: new Date() },
          });
        }
      }

      // Verify location matches if locationAddress is provided
      if (input.locationAddress) {
        const existingAddress = (license.locationAddress || '').toLowerCase().trim();
        const providedAddress = input.locationAddress.toLowerCase().trim();

        if (existingAddress !== providedAddress) {
          return {
            valid: false,
            message: 'Location address does not match the activated location',
          };
        }
      }

      // Check subscription status
      const activeSubscription = license.subscriptions.find((sub) => sub.status === 'active');
      const now = input.currentTime ? new Date(input.currentTime) : new Date();

      if (!activeSubscription) {
        // No grace period - license expires exactly at endDate
        const expiredSubscription = license.subscriptions[0];
        return {
          valid: false,
          message: 'License subscription has expired. Please contact administrator to renew your subscription.',
          expiresAt: expiredSubscription?.endDate,
          gracePeriodEnd: expiredSubscription?.endDate || undefined,
        };
      }

      // Calculate days remaining (no grace period - expiration is exact end date)
      const expiresAt = activeSubscription.endDate;
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      // No grace period - gracePeriodEnd equals endDate
      const gracePeriodEnd = expiresAt;

      if (now > expiresAt) {
        // Subscription expired (no grace period)
        return {
          valid: false,
          message: 'License subscription has expired. Please contact administrator to renew your subscription.',
          expiresAt,
          gracePeriodEnd,
        };
      }

      return {
        valid: true,
        expiresAt,
        gracePeriodEnd,
        daysRemaining,
        message: `License is valid. ${daysRemaining} days remaining.`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error validating license', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      return {
        valid: false,
        message: errorMessage || 'Failed to validate license',
      };
    }
  }

  /**
   * Check if a new user can be created for a license
   * @param input License key and optional hardware ID
   * @returns Promise<{ canCreate: boolean; userCount: number; userLimit: number; message?: string }>
   */
  static async checkUserCreationAllowed(input: {
    licenseKey: string;
    hardwareId?: string; // Optional - no longer required
  }): Promise<{
    canCreate: boolean;
    userCount: number;
    userLimit: number;
    message?: string;
  }> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          canCreate: false,
          userCount: 0,
          userLimit: 0,
          message: 'License key is invalid',
        };
      }

      // Hardware ID is optional - if provided, verify it exists (for tracking)
      // But no longer required for user creation
      if (input.hardwareId) {
        const activation = await prisma.activation.findFirst({
          where: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
            isActive: true,
          },
        });

        // Log if hardware ID doesn't match, but don't block user creation
        if (!activation) {
          logger.info('Hardware ID not found for license, but allowing user creation', {
            licenseId: license.id,
            hardwareId: input.hardwareId,
          });
        }
      }

      // Check if user limit is reached
      if (license.userCount >= license.userLimit) {
        return {
          canCreate: false,
          userCount: license.userCount,
          userLimit: license.userLimit,
          message: `User limit reached (${license.userCount}/${license.userLimit}). Please contact administrator to increase your user limit.`,
        };
      }

      return {
        canCreate: true,
        userCount: license.userCount,
        userLimit: license.userLimit,
        message: `You can create ${license.userLimit - license.userCount} more user(s).`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error checking user creation allowed', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      return {
        canCreate: false,
        userCount: 0,
        userLimit: 0,
        message: errorMessage || 'Failed to check user creation status',
      };
    }
  }

  /**
   * Increment user count when a user is created in POS app
   * @param input License key and optional hardware ID
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  static async incrementUserCount(input: {
    licenseKey: string;
    hardwareId?: string; // Optional - no longer required
  }): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'License key is invalid',
        };
      }

      // Hardware ID is optional - if provided, verify it exists (for tracking)
      // But no longer required for user count operations
      if (input.hardwareId) {
        const activation = await prisma.activation.findFirst({
          where: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
            isActive: true,
          },
        });

        // Log if hardware ID doesn't match, but don't block operation
        if (!activation) {
          logger.info('Hardware ID not found for license, but allowing user count increment', {
            licenseId: license.id,
            hardwareId: input.hardwareId,
          });
        }
      }

      // Check if user limit is reached
      if (license.userCount >= license.userLimit) {
        return {
          success: false,
          userCount: license.userCount,
          userLimit: license.userLimit,
          message: `User limit reached (${license.userCount}/${license.userLimit}). Cannot create more users.`,
        };
      }

      // Check if license has an initial payment (required for user payments)
      const hasInitialPayment = license.payments && license.payments.length > 0 && 
        license.payments.some(p => !p.isAnnualSubscription);

      // Increment user count
      const updatedLicense = await prisma.license.update({
        where: { id: license.id },
        data: {
          userCount: {
            increment: 1,
          },
        },
        select: {
          userCount: true,
          userLimit: true,
        },
      });

      logger.info('User count incremented', {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId || 'not provided',
        newUserCount: updatedLicense.userCount,
        userLimit: updatedLicense.userLimit,
      });

      // Create payment for the additional user if initial payment exists
      let finalUserLimit = updatedLicense.userLimit;
      if (hasInitialPayment && license.pricePerUser) {
        try {
          const pricePerUser = Number(license.pricePerUser);
          if (pricePerUser > 0) {
            await PaymentService.createPayment({
              licenseId: license.id,
              amount: pricePerUser,
              paymentDate: new Date(),
              isAnnualSubscription: false,
              paymentType: 'user' as const,
              additionalUsers: 1,
            });

            // Payment service increments userLimit by 1 when additionalUsers is provided
            finalUserLimit = updatedLicense.userLimit + 1;

            logger.info('Payment created for additional user', {
              licenseId: license.id,
              licenseKey: license.licenseKey,
              hardwareId: input.hardwareId,
              amount: pricePerUser,
            });
          }
        } catch (paymentError: unknown) {
          const paymentErrorMessage = paymentError instanceof Error ? paymentError.message : 'Unknown error';
          logger.warn('Failed to create payment for additional user', {
            error: paymentErrorMessage,
            licenseId: license.id,
            licenseKey: license.licenseKey,
            hardwareId: input.hardwareId,
          });
          // Continue even if payment creation fails - user was already created
        }
      } else {
        logger.warn('Skipping payment creation for additional user', {
          licenseId: license.id,
          licenseKey: license.licenseKey,
          hasInitialPayment,
          hasPricePerUser: !!license.pricePerUser,
          reason: !hasInitialPayment ? 'No initial payment found' : 'No price per user configured',
        });
      }

      return {
        success: true,
        userCount: updatedLicense.userCount,
        userLimit: finalUserLimit,
        message: `User created successfully. Current users: ${updatedLicense.userCount}/${finalUserLimit}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error incrementing user count', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: errorMessage || 'Failed to increment user count',
      };
    }
  }

  /**
   * Decrement user count when a user is deleted
   * @param input License key and optional hardware ID
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  static async decrementUserCount(input: {
    licenseKey: string;
    hardwareId?: string; // Optional - no longer required
  }): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'License key is invalid',
        };
      }

      // Hardware ID is optional - if provided, verify it exists (for tracking)
      // But no longer required for user count operations
      if (input.hardwareId) {
        const activation = await prisma.activation.findFirst({
          where: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
            isActive: true,
          },
        });

        // Log if hardware ID doesn't match, but don't block operation
        if (!activation) {
          logger.info('Hardware ID not found for license, but allowing user count decrement', {
            licenseId: license.id,
            hardwareId: input.hardwareId,
          });
        }
      }

      // Check if user count is already at 0
      if (license.userCount <= 0) {
        return {
          success: false,
          userCount: license.userCount,
          userLimit: license.userLimit,
          message: 'User count is already at 0. Cannot decrement further.',
        };
      }

      // Decrement user count
      const updatedLicense = await prisma.license.update({
        where: { id: license.id },
        data: {
          userCount: {
            decrement: 1,
          },
        },
        select: {
          userCount: true,
          userLimit: true,
        },
      });

      logger.info('User count decremented', {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId || 'not provided',
        previousUserCount: license.userCount,
        newUserCount: updatedLicense.userCount,
        userLimit: updatedLicense.userLimit,
      });

      return {
        success: true,
        userCount: updatedLicense.userCount,
        userLimit: updatedLicense.userLimit,
        message: `User deleted successfully. Current users: ${updatedLicense.userCount}/${updatedLicense.userLimit}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error decrementing user count', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: errorMessage || 'Failed to decrement user count',
      };
    }
  }

  /**
   * Sync user count with actual number of users from POS app
   * Used when reactivating a license to ensure userCount matches actual users
   * @param input License key, optional hardware ID, and actual user count
   * @returns Promise<{ success: boolean; userCount: number; userLimit: number; message: string }>
   */
  static async syncUserCount(input: {
    licenseKey: string;
    hardwareId?: string; // Optional - no longer required
    actualUserCount: number;
  }): Promise<{
    success: boolean;
    userCount: number;
    userLimit: number;
    message: string;
  }> {
    try {
      // Normalize license key
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      // Find license by key
      const license = await LicenseService.findLicenseByKey(normalizedKey);

      if (!license) {
        return {
          success: false,
          userCount: 0,
          userLimit: 0,
          message: 'License key is invalid',
        };
      }

      // Hardware ID is optional - if provided, verify it exists (for tracking)
      // But no longer required for user count operations
      if (input.hardwareId) {
        const activation = await prisma.activation.findFirst({
          where: {
            licenseId: license.id,
            hardwareId: input.hardwareId,
            isActive: true,
          },
        });

        // Log if hardware ID doesn't match, but don't block operation
        if (!activation) {
          logger.info('Hardware ID not found for license, but allowing user count sync', {
            licenseId: license.id,
            hardwareId: input.hardwareId,
          });
        }
      }

      // Validate actual user count
      if (input.actualUserCount < 0) {
        return {
          success: false,
          userCount: license.userCount,
          userLimit: license.userLimit,
          message: 'Actual user count cannot be negative',
        };
      }

      // Update user count to match actual count
      const updatedLicense = await prisma.license.update({
        where: { id: license.id },
        data: {
          userCount: input.actualUserCount,
        },
        select: {
          userCount: true,
          userLimit: true,
        },
      });

      logger.info('User count synced with actual users', {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId || 'not provided',
        previousUserCount: license.userCount,
        newUserCount: updatedLicense.userCount,
        actualUserCount: input.actualUserCount,
      });

      return {
        success: true,
        userCount: updatedLicense.userCount,
        userLimit: updatedLicense.userLimit,
        message: `User count synced successfully. Updated from ${license.userCount} to ${updatedLicense.userCount} users.`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error syncing user count', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
        actualUserCount: input.actualUserCount,
      });

      return {
        success: false,
        userCount: 0,
        userLimit: 0,
        message: errorMessage || 'Failed to sync user count',
      };
    }
  }

  /**
   * Roll back a license activation when POS-side activation fails.
   * Used by the POS app if local user creation or database initialization fails
   * after the server has already created an activation record.
   *
   * Behavior:
   * - Deactivates the activation for the given licenseKey + hardwareId (if it exists)
   * - If this was effectively the first activation (userCount <= 1), resets userCount back to 0
   *   so that the license can be cleanly activated again.
   */
  static async rollbackActivation(input: {
    licenseKey: string;
    hardwareId: string;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(input.licenseKey);

      const license = await LicenseService.findLicenseByKey(normalizedKey);
      if (!license) {
        return {
          success: false,
          message: 'License key is invalid',
        };
      }

      // Find active activation for this license + hardwareId
      const activation = await prisma.activation.findFirst({
        where: {
          licenseId: license.id,
          hardwareId: input.hardwareId,
          isActive: true,
        },
      });

      if (!activation) {
        // Nothing to roll back – treat as success so client logic can continue
        logger.info('No active activation found to roll back', {
          licenseId: license.id,
          licenseKey: license.licenseKey,
          hardwareId: input.hardwareId,
        });

        return {
          success: true,
          message: 'No active activation found to roll back',
        };
      }

      // Perform rollback in a transaction
      await prisma.$transaction(async (tx) => {
        // Deactivate this activation
        await tx.activation.update({
          where: { id: activation.id },
          data: {
            isActive: false,
          },
        });

        // If this was effectively the first activation (userCount <= 1),
        // reset userCount back to 0 so license can be activated cleanly again.
        if (license.userCount <= 1) {
          await tx.license.update({
            where: { id: license.id },
            data: {
              userCount: 0,
            },
          });
        }
      });

      logger.info('License activation rolled back due to POS activation failure', {
        licenseId: license.id,
        licenseKey: license.licenseKey,
        hardwareId: input.hardwareId,
        previousUserCount: license.userCount,
      });

      return {
        success: true,
        message: 'Activation rolled back successfully',
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error rolling back activation', {
        error: errorMessage,
        licenseKey: input.licenseKey,
        hardwareId: input.hardwareId,
      });

      return {
        success: false,
        message: errorMessage || 'Failed to roll back activation',
      };
    }
  }
}

