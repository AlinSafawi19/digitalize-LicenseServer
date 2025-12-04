import { Request, Response } from 'express';
import { SubscriptionService, UpdateSubscriptionInput } from '../services/subscription.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Admin Subscription Controller
 * Handles HTTP requests for admin subscription management operations
 */
export class AdminSubscriptionController {
  /**
   * Get paginated list of subscriptions with filtering
   * GET /api/admin/subscriptions
   */
  static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as string | undefined;
      const licenseId = req.query.licenseId ? parseInt(req.query.licenseId as string) : undefined;
      const expiringSoon = req.query.expiringSoon === 'true' || req.query.expiringSoon === '1';
      const expired = req.query.expired === 'true' || req.query.expired === '1';
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'asc';

      if (licenseId && isNaN(licenseId)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      const result = await SubscriptionService.getSubscriptionsPaginated({
        page,
        pageSize,
        status,
        licenseId,
        expiringSoon,
        expired,
        sortBy,
        sortOrder,
      });

      logger.info('Admin retrieved subscriptions list', {
        adminId: req.admin?.id,
        page,
        pageSize,
        totalItems: result.pagination.totalItems,
      });

      ResponseUtil.success(
        res,
        {
          subscriptions: result.data,
          pagination: result.pagination,
          meta: result.meta,
        },
        'Subscriptions retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve subscriptions';
      logger.error('Error retrieving subscriptions', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get subscription by ID
   * GET /api/admin/subscriptions/:id
   */
  static async getSubscriptionById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid subscription ID', 400);
        return;
      }

      const subscription = await SubscriptionService.getSubscriptionById(id);

      if (!subscription) {
        ResponseUtil.notFound(res, 'Subscription not found');
        return;
      }

      logger.info('Admin retrieved subscription details', {
        adminId: req.admin?.id,
        subscriptionId: id,
      });

      ResponseUtil.success(res, subscription, 'Subscription retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve subscription';
      logger.error('Error retrieving subscription', {
        error: errorMessage,
        adminId: req.admin?.id,
        subscriptionId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Update subscription information
   * PUT /api/admin/subscriptions/:id
   */
  static async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid subscription ID', 400);
        return;
      }

      // Check if subscription exists
      const existing = await SubscriptionService.getSubscriptionById(id);
      if (!existing) {
        ResponseUtil.notFound(res, 'Subscription not found');
        return;
      }

      const input: UpdateSubscriptionInput = {
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        annualFee: req.body.annualFee,
        status: req.body.status,
        gracePeriodEnd: req.body.gracePeriodEnd !== undefined
          ? req.body.gracePeriodEnd ? new Date(req.body.gracePeriodEnd) : null
          : undefined,
      };

      const subscription = await SubscriptionService.updateSubscription(id, input);

      logger.info('Admin updated subscription', {
        adminId: req.admin?.id,
        subscriptionId: id,
        changes: Object.keys(input).filter(key => input[key as keyof UpdateSubscriptionInput] !== undefined),
      });

      ResponseUtil.success(
        res,
        subscription,
        'Subscription updated successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update subscription';
      logger.error('Error updating subscription', {
        error: errorMessage,
        adminId: req.admin?.id,
        subscriptionId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Renew subscription (extend by 1 year)
   * POST /api/admin/subscriptions/:id/renew
   */
  static async renewSubscription(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid subscription ID', 400);
        return;
      }

      // Check if subscription exists
      const existing = await SubscriptionService.getSubscriptionById(id);
      if (!existing) {
        ResponseUtil.notFound(res, 'Subscription not found');
        return;
      }

      const extendFromNow = req.body.extendFromNow === true || req.body.extendFromNow === 'true';

      const subscription = await SubscriptionService.renewSubscription(id, extendFromNow);

      logger.info('Admin renewed subscription', {
        adminId: req.admin?.id,
        subscriptionId: id,
        licenseId: subscription.licenseId,
        extendFromNow,
      });

      ResponseUtil.success(
        res,
        subscription,
        'Subscription renewed successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to renew subscription';
      logger.error('Error renewing subscription', {
        error: errorMessage,
        adminId: req.admin?.id,
        subscriptionId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

