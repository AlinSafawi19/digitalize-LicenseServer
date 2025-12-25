import { Request, Response } from 'express';
import { LicenseService, CreateLicenseInput, UpdateLicenseInput } from '../services/license.service';
import { PaymentService } from '../services/payment.service';
import { ActivationService } from '../services/activation.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';
import prisma from '../config/database';

/**
 * Admin License Controller
 * Handles HTTP requests for admin license management operations
 */
export class AdminLicenseController {
  /**
   * Get paginated list of licenses
   * GET /api/admin/licenses
   */
  static async getLicenses(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const isFreeTrial = req.query.isFreeTrial !== undefined 
        ? req.query.isFreeTrial === 'true' || req.query.isFreeTrial === '1'
        : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      // Performance optimization: For list views, exclude full relations to reduce payload size
      // Set includeRelations=false to get only summary counts instead of full relation arrays
      const includeRelations = req.query.includeRelations !== undefined 
        ? req.query.includeRelations === 'true' || req.query.includeRelations === '1'
        : false; // Default to false for list views (better performance)

      const result = await LicenseService.getLicensesPaginated({
        page,
        pageSize,
        status,
        search,
        isFreeTrial,
        sortBy,
        sortOrder,
        includeRelations,
      });

      logger.info('Admin retrieved licenses list', {
        adminId: req.admin?.id,
        page,
        pageSize,
        totalItems: result.pagination.totalItems,
      });

      ResponseUtil.success(
        res,
        {
          licenses: result.data,
          pagination: result.pagination,
          meta: result.meta,
        },
        'Licenses retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve licenses';
      logger.error('Error retrieving licenses', { error: errorMessage, adminId: req.admin?.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get license by ID with all details
   * GET /api/admin/licenses/:id
   */
  static async getLicenseById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      const license = await LicenseService.getLicenseById(id);

      if (!license) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      logger.info('Admin retrieved license details', {
        adminId: req.admin?.id,
        licenseId: id,
      });

      ResponseUtil.success(res, license, 'License retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve license';
      logger.error('Error retrieving license', { error: errorMessage, adminId: req.admin?.id, licenseId: req.params.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Create new license manually
   * POST /api/admin/licenses
   */
  static async createLicense(req: Request, res: Response): Promise<void> {
    try {
      const input: CreateLicenseInput = {
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        verificationToken: req.body.verificationToken, // Optional for admin, but recommended
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
      const license = await LicenseService.createLicense(input);

      logger.info('Admin created license', {
        adminId: req.admin?.id,
        licenseId: license.id,
        licenseKey: license.licenseKey,
      });

      ResponseUtil.success(
        res,
        license,
        'License created successfully',
        201
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create license';
      logger.error('Error creating license', { error: errorMessage, adminId: req.admin?.id });
      // Return 400 for validation errors (duplicate license), 500 for other errors
      const statusCode = errorMessage.includes('already exists') ? 400 : 500;
      ResponseUtil.error(res, errorMessage, statusCode);
    }
  }

  /**
   * Update license information
   * PUT /api/admin/licenses/:id
   */
  static async updateLicense(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      // Check if license exists
      const existingLicense = await LicenseService.getLicenseById(id);
      if (!existingLicense) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      const input: UpdateLicenseInput = {
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        status: req.body.status,
        locationName: req.body.locationName,
        locationAddress: req.body.locationAddress,
        initialPrice: req.body.initialPrice !== undefined && req.body.initialPrice !== null
          ? parseFloat(String(req.body.initialPrice))
          : undefined,
        annualPrice: req.body.annualPrice !== undefined && req.body.annualPrice !== null
          ? parseFloat(String(req.body.annualPrice))
          : undefined,
        pricePerUser: req.body.pricePerUser !== undefined && req.body.pricePerUser !== null
          ? parseFloat(String(req.body.pricePerUser))
          : undefined,
        isFreeTrial: req.body.isFreeTrial !== undefined
          ? (req.body.isFreeTrial === true || req.body.isFreeTrial === 'true')
          : undefined,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };

      const license = await LicenseService.updateLicenseById(id, input);

      logger.info('Admin updated license', {
        adminId: req.admin?.id,
        licenseId: id,
        changes: Object.keys(input),
      });

      ResponseUtil.success(
        res,
        license,
        'License updated successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update license';
      logger.error('Error updating license', { error: errorMessage, adminId: req.admin?.id, licenseId: req.params.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Revoke license (soft delete - set status to revoked)
   * DELETE /api/admin/licenses/:id
   */
  static async revokeLicense(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      // Check if license exists
      const existingLicense = await LicenseService.getLicenseById(id);
      if (!existingLicense) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      const license = await LicenseService.revokeLicenseById(id);

      logger.info('Admin revoked license', {
        adminId: req.admin?.id,
        licenseId: id,
        licenseKey: license.licenseKey,
      });

      ResponseUtil.success(
        res,
        license,
        'License revoked successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to revoke license';
      logger.error('Error revoking license', { error: errorMessage, adminId: req.admin?.id, licenseId: req.params.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Increase user limit for a license (manual operation when payment is received)
   * PATCH /api/admin/licenses/:id/user-limit
   */
  static async increaseUserLimit(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      const { additionalUsers } = req.body;
      if (!additionalUsers || typeof additionalUsers !== 'number' || additionalUsers <= 0) {
        ResponseUtil.error(res, 'additionalUsers must be a positive number', 400);
        return;
      }

      // Check if license exists
      const existingLicense = await LicenseService.getLicenseById(id);
      if (!existingLicense) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      // Check if license has an initial payment (required for user payments)
      const hasInitialPayment = existingLicense.payments && existingLicense.payments.length > 0 && 
        existingLicense.payments.some(p => !p.isAnnualSubscription);

      let updatedLicense;
      let paymentCreated = false;

      // Create payment if initial payment exists and pricePerUser is configured
      if (hasInitialPayment && existingLicense.pricePerUser) {
        try {
          const pricePerUser = Number(existingLicense.pricePerUser);
          const totalAmount = pricePerUser * additionalUsers;
          
          if (pricePerUser > 0) {
            // Create payment - payment service will increment userLimit when additionalUsers is provided
            const paymentInput = {
              licenseId: id,
              amount: totalAmount,
              paymentDate: new Date(),
              isAnnualSubscription: false,
              paymentType: 'user' as const,
              additionalUsers: additionalUsers,
            };
            
            logger.info('Creating payment from increaseUserLimit', {
              adminId: req.admin?.id,
              licenseId: id,
              paymentType: paymentInput.paymentType,
              additionalUsers: paymentInput.additionalUsers,
              amount: paymentInput.amount,
            });
            
            const payment = await PaymentService.createPayment(paymentInput);

            // Get updated license after payment creation
            const licenseAfterPayment = await LicenseService.getLicenseById(id);
            if (licenseAfterPayment) {
              updatedLicense = licenseAfterPayment;
            }
            paymentCreated = true;

            logger.info('Admin increased user limit with payment', {
              adminId: req.admin?.id,
              licenseId: id,
              licenseKey: existingLicense.licenseKey,
              previousLimit: existingLicense.userLimit,
              newLimit: licenseAfterPayment?.userLimit || existingLicense.userLimit + additionalUsers,
              additionalUsers,
              paymentId: payment.id,
              amount: totalAmount,
            });
          }
        } catch (paymentError: unknown) {
          const paymentErrorMessage = paymentError instanceof Error ? paymentError.message : 'Unknown error';
          logger.warn('Failed to create payment when increasing user limit', {
            error: paymentErrorMessage,
            adminId: req.admin?.id,
            licenseId: id,
            additionalUsers,
          });
          // Fall back to manual limit increase if payment creation fails
        }
      }

      // If payment wasn't created, manually increase user limit
      if (!paymentCreated) {
        updatedLicense = await prisma.license.update({
          where: { id },
          data: {
            userLimit: {
              increment: additionalUsers,
            },
          },
        });

        logger.info('Admin increased user limit manually (no payment created)', {
          adminId: req.admin?.id,
          licenseId: id,
          licenseKey: existingLicense.licenseKey,
          previousLimit: existingLicense.userLimit,
          newLimit: updatedLicense.userLimit,
          additionalUsers,
          reason: !hasInitialPayment ? 'No initial payment found' : 'No price per user configured',
        });
      }

      if (!updatedLicense) {
        updatedLicense = await LicenseService.getLicenseById(id);
      }

      if (!updatedLicense) {
        ResponseUtil.error(res, 'Failed to retrieve updated license', 500);
        return;
      }

      ResponseUtil.success(
        res,
        {
          id: updatedLicense.id,
          licenseKey: updatedLicense.licenseKey,
          userCount: updatedLicense.userCount,
          userLimit: updatedLicense.userLimit,
          previousLimit: existingLicense.userLimit,
          paymentCreated,
        },
        paymentCreated 
          ? `User limit increased by ${additionalUsers} and payment created. New limit: ${updatedLicense.userLimit}`
          : `User limit increased by ${additionalUsers}. New limit: ${updatedLicense.userLimit}`,
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to increase user limit';
      logger.error('Error increasing user limit', {
        error: errorMessage,
        adminId: req.admin?.id,
        licenseId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Reactivate a license (reset activations to allow customer to re-enter license key)
   * This deactivates all existing activations while keeping license data intact
   * POST /api/admin/licenses/:id/reactivate
   */
  static async reactivateLicense(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      // Check if license exists
      const existingLicense = await LicenseService.getLicenseById(id);
      if (!existingLicense) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      // Deactivate all active activations for this license
      const deactivatedCount = await ActivationService.deactivateAllActivationsForLicense(id);

      logger.info('Admin reactivated license (reset activations)', {
        adminId: req.admin?.id,
        licenseId: id,
        licenseKey: existingLicense.licenseKey,
        deactivatedActivations: deactivatedCount,
      });

      // Get updated license with activations
      const updatedLicense = await LicenseService.getLicenseById(id);

      ResponseUtil.success(
        res,
        {
          license: updatedLicense,
          deactivatedActivations: deactivatedCount,
          message: `License reactivation reset. ${deactivatedCount} activation(s) deactivated. Customer can now re-enter license key to activate.`,
        },
        'License reactivation reset successfully. Customer can now re-enter license key.',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reactivate license';
      logger.error('Error reactivating license', {
        error: errorMessage,
        adminId: req.admin?.id,
        licenseId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

