import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface SubscriptionWithLicense {
  id: number;
  licenseId: number;
  startDate: Date;
  endDate: Date;
  annualFee: Decimal;
  status: string;
  gracePeriodEnd: Date | null;
  createdAt: Date;
  license: {
    id: number;
    licenseKey: string;
    customerName: string | null;
    customerEmail: string | null;
    locationName: string | null;
  };
}

export interface UpdateSubscriptionInput {
  startDate?: Date;
  endDate?: Date;
  annualFee?: number;
  status?: 'active' | 'expired' | 'grace_period';
  gracePeriodEnd?: Date | null;
}

/**
 * Subscription Service
 * Handles subscription-related operations for admin
 */
export class SubscriptionService {
  /**
   * Get all subscriptions with pagination, filtering, and search
   * @param params Filter and pagination parameters
   * @returns Promise<Paginated subscriptions>
   */
  static async getSubscriptionsPaginated(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    licenseId?: number;
    expiringSoon?: boolean; // Subscriptions expiring within 30 days
    expired?: boolean; // Show only expired subscriptions
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: SubscriptionWithLicense[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    meta: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      status?: string;
      licenseId?: number;
      expiringSoon?: boolean;
      expired?: boolean;
    };
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;
    const sortBy = params.sortBy || 'endDate';
    const sortOrder = params.sortOrder || 'asc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (params.status) {
      where.status = params.status;
    }

    if (params.licenseId) {
      where.licenseId = params.licenseId;
    }

    // Filter by expiration date
    const now = new Date();
    if (params.expiringSoon) {
      // Subscriptions expiring within 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      where.endDate = {
        gte: now,
        lte: thirtyDaysFromNow,
      } as { gte: Date; lte: Date };
      where.status = 'active'; // Only show active subscriptions that are expiring
    } else if (params.expired) {
      // Only expired subscriptions
      where.endDate = {
        lt: now,
      } as { lt: Date };
    }

    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const validSortFields = ['id', 'startDate', 'endDate', 'status', 'annualFee', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'endDate';
    orderBy[sortField] = sortOrder;

    // Execute queries in parallel
    const [subscriptions, totalItems] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          license: {
            select: {
              id: true,
              licenseKey: true,
              customerName: true,
              customerEmail: true,
              locationName: true,
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: subscriptions as SubscriptionWithLicense[],
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      meta: {
        sortBy: sortField,
        sortOrder,
        status: params.status,
        licenseId: params.licenseId,
        expiringSoon: params.expiringSoon,
        expired: params.expired,
      },
    };
  }

  /**
   * Get subscription by ID with license details
   * @param id Subscription ID
   * @returns Promise<SubscriptionWithLicense | null> Subscription details
   */
  static async getSubscriptionById(id: number): Promise<SubscriptionWithLicense | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerEmail: true,
            locationName: true,
          },
        },
      },
    });

    return subscription as SubscriptionWithLicense | null;
  }

  /**
   * Update subscription information
   * @param id Subscription ID
   * @param input Update data
   * @returns Promise<SubscriptionWithLicense> Updated subscription
   */
  static async updateSubscription(
    id: number,
    input: UpdateSubscriptionInput
  ): Promise<SubscriptionWithLicense> {
    // Check if subscription exists
    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Subscription with ID ${id} not found`);
    }

    const updateData: Record<string, unknown> = {};

    if (input.startDate !== undefined) updateData.startDate = input.startDate;
    if (input.endDate !== undefined) updateData.endDate = input.endDate;
    if (input.annualFee !== undefined) updateData.annualFee = new Decimal(input.annualFee);
    if (input.status !== undefined) updateData.status = input.status;
    if (input.gracePeriodEnd !== undefined) updateData.gracePeriodEnd = input.gracePeriodEnd;

    // If endDate is updated, recalculate gracePeriodEnd if not explicitly provided
    // Grace period end always equals endDate (no grace period)
    if (input.endDate !== undefined && input.gracePeriodEnd === undefined) {
      updateData.gracePeriodEnd = new Date(input.endDate);
    }

    const subscription = await prisma.subscription.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.subscription.update>[0]['data'],
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerEmail: true,
            locationName: true,
          },
        },
      },
    });

    logger.info('Subscription updated', {
      subscriptionId: id,
      licenseId: subscription.licenseId,
      changes: Object.keys(updateData),
    });

    return subscription as SubscriptionWithLicense;
  }

  /**
   * Renew subscription (extend by 1 year from current end date or now)
   * @param id Subscription ID
   * @param extendFromNow If true, extend from now. If false, extend from current endDate
   * @returns Promise<SubscriptionWithLicense> Renewed subscription
   */
  static async renewSubscription(
    id: number,
    extendFromNow: boolean = false
  ): Promise<SubscriptionWithLicense> {
    const existing = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Subscription with ID ${id} not found`);
    }

    // Calculate new dates
    const startDate = extendFromNow ? new Date() : existing.endDate;
    const endDate = new Date(startDate);
    // For regular licenses, extend by 1 year
    endDate.setFullYear(endDate.getFullYear() + 1);
    // Set to end of day (23:59:59.999) to ensure full day is counted
    endDate.setHours(23, 59, 59, 999);

    // Grace period end always equals endDate (no grace period)
    const gracePeriodEnd = new Date(endDate);

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        startDate,
        endDate,
        status: 'active',
        gracePeriodEnd,
        annualFee: new Decimal(config.annualSubscriptionPrice),
      },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerEmail: true,
            locationName: true,
          },
        },
      },
    });

    logger.info('Subscription renewed', {
      subscriptionId: id,
      licenseId: subscription.licenseId,
      newEndDate: endDate,
    });

    return subscription as SubscriptionWithLicense;
  }

  /**
   * Create a new subscription for a license
   * @param licenseId License ID
   * @param input Subscription data (optional - defaults to 1 year from now)
   * @returns Promise<SubscriptionWithLicense> Created subscription
   */
  static async createSubscription(
    licenseId: number,
    input?: {
      startDate?: Date;
      endDate?: Date;
      annualFee?: number;
    }
  ): Promise<SubscriptionWithLicense> {
    // Check if license exists
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
    });

    if (!license) {
      throw new Error(`License with ID ${licenseId} not found`);
    }

    // Calculate dates if not provided
    const startDate = input?.startDate || new Date();
    let endDate: Date;
    
    if (input?.endDate) {
      endDate = input.endDate instanceof Date ? input.endDate : new Date(input.endDate);
      // Set to end of day (23:59:59.999) to ensure full day is counted
      endDate.setHours(23, 59, 59, 999);
    } else {
      // For regular licenses, default to 1 year (exactly 365 days)
      endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      // Subtract 1 day to get exactly 365 days (not 365+ hours)
      endDate.setDate(endDate.getDate() - 1);
      // Set to end of day (23:59:59.999) to ensure full day is counted
      endDate.setHours(23, 59, 59, 999);
    }

    // No grace period - expiration is exact end date
    const gracePeriodEnd = new Date(endDate);

    const subscription = await prisma.subscription.create({
      data: {
        licenseId,
        startDate,
        endDate,
        annualFee: new Decimal(input?.annualFee || config.annualSubscriptionPrice),
        status: 'active',
        gracePeriodEnd,
      },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerEmail: true,
            locationName: true,
          },
        },
      },
    });

    logger.info('Subscription created', {
      subscriptionId: subscription.id,
      licenseId,
    });

    return subscription as SubscriptionWithLicense;
  }

  /**
   * Update expired subscriptions status
   * Sets status to 'expired' for subscriptions that have passed their endDate
   * No grace period - expiration is exact end date
   * @returns Promise<{ updated: number }> Number of subscriptions updated
   */
  static async updateExpiredSubscriptions(): Promise<{ updated: number }> {
    const now = new Date();
    
    // Find subscriptions that are about to expire (before updating status)
    const subscriptionsToExpire = await prisma.subscription.findMany({
      where: {
        status: {
          in: ['active', 'grace_period'],
        },
        endDate: {
          lt: now, // End date has passed
        },
      },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerEmail: true,
            locationName: true,
            isFreeTrial: true,
          },
        },
      },
    });

    // Update subscriptions that are past endDate to 'expired' (no grace period)
    const expiredSubscriptions = await prisma.subscription.updateMany({
      where: {
        status: {
          in: ['active', 'grace_period'],
        },
        endDate: {
          lt: now, // End date has passed
        },
      },
      data: {
        status: 'expired',
      },
    });

    if (expiredSubscriptions.count > 0) {
      logger.info('Updated expired subscriptions', {
        expired: expiredSubscriptions.count,
      });

      // Send expiration notification emails
      const { EmailService } = await import('./email.service');
      for (const subscription of subscriptionsToExpire) {
        if (subscription.license.customerEmail) {
          const daysRemaining = Math.ceil((subscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          try {
            await EmailService.sendExpirationNotification({
              customerName: subscription.license.customerName,
              customerEmail: subscription.license.customerEmail,
              licenseKey: subscription.license.licenseKey,
              locationName: subscription.license.locationName,
              expirationDate: subscription.endDate,
              daysRemaining: Math.max(0, daysRemaining),
              isFreeTrial: subscription.license.isFreeTrial,
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to send expiration notification email', {
              subscriptionId: subscription.id,
              licenseId: subscription.license.id,
              error: errorMessage,
            });
          }
        }
      }

      // Update license statuses to reflect expired subscriptions
      const { LicenseService } = await import('./license.service');
      await LicenseService.updateExpiredLicenses();
    }

    return { updated: expiredSubscriptions.count };
  }
}

