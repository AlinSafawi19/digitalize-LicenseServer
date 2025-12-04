import { Request, Response } from 'express';
import { ActivationService } from '../services/activation.service';
import { LicenseService } from '../services/license.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Admin Activation Controller
 * Handles HTTP requests for admin activation management operations
 */
export class AdminActivationController {
  /**
   * Get all activations for a specific license
   * GET /api/admin/licenses/:id/activations
   */
  static async getLicenseActivations(req: Request, res: Response): Promise<void> {
    try {
      const licenseId = parseInt(req.params.id);
      if (isNaN(licenseId)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      // Check if license exists
      const license = await LicenseService.getLicenseById(licenseId);
      if (!license) {
        ResponseUtil.notFound(res, 'License not found');
        return;
      }

      // Get optional filter
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' || req.query.isActive === '1'
        : undefined;

      const activations = await ActivationService.getActivationsByLicenseId(licenseId, {
        isActive,
      });

      logger.info('Admin retrieved license activations', {
        adminId: req.admin?.id,
        licenseId,
        count: activations.length,
      });

      ResponseUtil.success(
        res,
        {
          license: {
            id: license.id,
            licenseKey: license.licenseKey,
            customerName: license.customerName,
          },
          activations,
        },
        'Activations retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve activations';
      logger.error('Error retrieving license activations', {
        error: errorMessage,
        adminId: req.admin?.id,
        licenseId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get activation by ID
   * GET /api/admin/activations/:id
   */
  static async getActivationById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid activation ID', 400);
        return;
      }

      const activation = await ActivationService.getActivationById(id);

      if (!activation) {
        ResponseUtil.notFound(res, 'Activation not found');
        return;
      }

      logger.info('Admin retrieved activation details', {
        adminId: req.admin?.id,
        activationId: id,
      });

      ResponseUtil.success(res, activation, 'Activation retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve activation';
      logger.error('Error retrieving activation', {
        error: errorMessage,
        adminId: req.admin?.id,
        activationId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get paginated list of all activations with filtering
   * GET /api/admin/activations
   */
  static async getActivations(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const licenseId = req.query.licenseId ? parseInt(req.query.licenseId as string) : undefined;
      const isActive = req.query.isActive !== undefined
        ? req.query.isActive === 'true' || req.query.isActive === '1'
        : undefined;
      const search = req.query.search as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      if (licenseId && isNaN(licenseId)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      const result = await ActivationService.getActivationsPaginated({
        page,
        pageSize,
        licenseId,
        isActive,
        search,
        sortBy,
        sortOrder,
      });

      logger.info('Admin retrieved activations list', {
        adminId: req.admin?.id,
        page,
        pageSize,
        totalItems: result.pagination.totalItems,
      });

      ResponseUtil.success(
        res,
        {
          activations: result.data,
          pagination: result.pagination,
          meta: result.meta,
        },
        'Activations retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve activations';
      logger.error('Error retrieving activations', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Deactivate an activation (soft delete - set isActive to false)
   * DELETE /api/admin/activations/:id
   */
  static async deactivateActivation(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid activation ID', 400);
        return;
      }

      // Check if activation exists
      const existing = await ActivationService.getActivationById(id);
      if (!existing) {
        ResponseUtil.notFound(res, 'Activation not found');
        return;
      }

      const activation = await ActivationService.deactivateActivation(id);

      logger.info('Admin deactivated activation', {
        adminId: req.admin?.id,
        activationId: id,
        licenseId: activation.licenseId,
        hardwareId: activation.hardwareId,
      });

      ResponseUtil.success(
        res,
        activation,
        'Activation deactivated successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate activation';
      logger.error('Error deactivating activation', {
        error: errorMessage,
        adminId: req.admin?.id,
        activationId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

