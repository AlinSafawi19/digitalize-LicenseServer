import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface PaymentWithLicense {
  id: number;
  licenseId: number;
  amount: Decimal;
  paymentDate: Date;
  isAnnualSubscription: boolean;
  paymentType: 'initial' | 'annual' | 'user';
  createdAt: Date;
  license: {
    id: number;
    licenseKey: string;
    customerName: string | null;
    customerPhone: string | null;
    locationName: string | null;
  };
}

/**
 * Payment Service
 * Handles payment-related operations for admin
 */
export class PaymentService {
  /**
   * Get all payments with pagination, filtering, and search
   * @param params Filter and pagination parameters
   * @returns Promise<Paginated payments>
   */
  static async getPaymentsPaginated(params: {
    page?: number;
    pageSize?: number;
    licenseId?: number;
    startDate?: Date;
    endDate?: Date;
    isAnnualSubscription?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: PaymentWithLicense[];
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
      licenseId?: number;
      startDate?: Date;
      endDate?: Date;
      isAnnualSubscription?: boolean;
      totalAmount?: number;
    };
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;
    const sortBy = params.sortBy || 'paymentDate';
    const sortOrder = params.sortOrder || 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (params.licenseId) {
      where.licenseId = params.licenseId;
    }

    if (params.isAnnualSubscription !== undefined) {
      where.isAnnualSubscription = params.isAnnualSubscription;
    }

    // Filter by date range
    if (params.startDate || params.endDate) {
      where.paymentDate = {} as { gte?: Date; lte?: Date };
      if (params.startDate) {
        (where.paymentDate as { gte?: Date; lte?: Date }).gte = params.startDate;
      }
      if (params.endDate) {
        // Set end date to end of day
        const endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
        (where.paymentDate as { gte?: Date; lte?: Date }).lte = endDate;
      }
    }

    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const validSortFields = ['id', 'amount', 'paymentDate', 'createdAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'paymentDate';
    orderBy[sortField] = sortOrder;

    // Execute queries in parallel
    const [payments, totalItems, totalAmountResult] = await Promise.all([
      prisma.payment.findMany({
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
              customerPhone: true,
              locationName: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      // Calculate total amount for filtered results
      prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
        },
      }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Convert total amount to number
    const totalAmount = totalAmountResult._sum.amount
      ? parseFloat(totalAmountResult._sum.amount.toString())
      : 0;

    return {
      data: payments as PaymentWithLicense[],
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
        licenseId: params.licenseId,
        startDate: params.startDate,
        endDate: params.endDate,
        isAnnualSubscription: params.isAnnualSubscription,
        totalAmount,
      },
    };
  }

  /**
   * Get payment by ID with license details
   * @param id Payment ID
   * @returns Promise<PaymentWithLicense | null> Payment details
   */
  static async getPaymentById(id: number): Promise<PaymentWithLicense | null> {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            customerPhone: true,
            locationName: true,
          },
        },
      },
    });

    return payment as PaymentWithLicense | null;
  }

  /**
   * Get payment statistics
   * @param params Optional date range filter
   * @returns Promise<Payment statistics>
   */
  static async getPaymentStatistics(params?: {
    startDate?: Date;
    endDate?: Date;
    licenseId?: number;
  }): Promise<{
    totalPayments: number;
    totalAmount: number;
    averageAmount: number;
    annualSubscriptionPayments: number;
    initialLicensePayments: number;
    totalAnnualAmount: number;
    totalInitialAmount: number;
  }> {
    const where: Record<string, unknown> = {};

    if (params?.licenseId) {
      where.licenseId = params.licenseId;
    }

    if (params?.startDate || params?.endDate) {
      where.paymentDate = {} as { gte?: Date; lte?: Date };
      if (params.startDate) {
        (where.paymentDate as { gte?: Date; lte?: Date }).gte = params.startDate;
      }
      if (params.endDate) {
        const endDate = new Date(params.endDate);
        endDate.setHours(23, 59, 59, 999);
        (where.paymentDate as { gte?: Date; lte?: Date }).lte = endDate;
      }
    }

    const [
      totalCount,
      totalAmountResult,
      annualCount,
      initialCount,
      annualAmountResult,
      initialAmountResult,
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: { ...where, isAnnualSubscription: true },
      }),
      prisma.payment.count({
        where: { ...where, isAnnualSubscription: false },
      }),
      prisma.payment.aggregate({
        where: { ...where, isAnnualSubscription: true },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...where, isAnnualSubscription: false },
        _sum: { amount: true },
      }),
    ]);

    const totalAmount = totalAmountResult._sum.amount
      ? parseFloat(totalAmountResult._sum.amount.toString())
      : 0;
    const annualAmount = annualAmountResult._sum.amount
      ? parseFloat(annualAmountResult._sum.amount.toString())
      : 0;
    const initialAmount = initialAmountResult._sum.amount
      ? parseFloat(initialAmountResult._sum.amount.toString())
      : 0;

    return {
      totalPayments: totalCount,
      totalAmount,
      averageAmount: totalCount > 0 ? totalAmount / totalCount : 0,
      annualSubscriptionPayments: annualCount,
      initialLicensePayments: initialCount,
      totalAnnualAmount: annualAmount,
      totalInitialAmount: initialAmount,
    };
  }

  /**
   * Create a new payment manually
   * If isAnnualSubscription is true, automatically renews the subscription
   * @param input Payment creation data
   * @returns Promise<PaymentWithLicense> Created payment
   */
  static async createPayment(input: {
    licenseId: number;
    amount: number;
    paymentDate?: Date;
    isAnnualSubscription: boolean;
    paymentType?: 'initial' | 'annual' | 'user';
    additionalUsers?: number;
  }): Promise<PaymentWithLicense> {
    // Verify license exists
    const license = await prisma.license.findUnique({
      where: { id: input.licenseId },
      include: {
        subscriptions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        payments: {
          where: {
            isAnnualSubscription: false,
          },
        },
      },
    });

    if (!license) {
      throw new Error(`License with ID ${input.licenseId} not found`);
    }

    // Validate amount
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    // Determine payment type
    // Explicitly use input.paymentType if provided, otherwise determine from isAnnualSubscription
    let paymentType: 'initial' | 'annual' | 'user';
    
    // Check if input.paymentType is explicitly provided and is a valid value
    if (input.paymentType !== undefined && input.paymentType !== null) {
      if (input.paymentType === 'user') {
        paymentType = 'user';
      } else if (input.paymentType === 'annual') {
        paymentType = 'annual';
      } else if (input.paymentType === 'initial') {
        paymentType = 'initial';
      } else {
        // Invalid payment type provided, fall back to default logic
        paymentType = input.isAnnualSubscription ? 'annual' : 'initial';
      }
    } else {
      // No payment type provided, determine from isAnnualSubscription
      paymentType = input.isAnnualSubscription ? 'annual' : 'initial';
    }
    
    // Check if license already has an initial payment
    const hasInitialPayment = license.payments && license.payments.length > 0;
    const isExpired = license.status === 'expired';

    // Block adding initial payment if license already has one
    if (paymentType === 'initial' && hasInitialPayment) {
      throw new Error('Initial payment already exists for this license. Please add an annual subscription payment or user payment instead.');
    }

    // Block user payments if initial payment not paid
    if (paymentType === 'user' && !hasInitialPayment) {
      throw new Error('Initial payment not paid yet. Please make an initial payment first before adding user payments.');
    }

    // Block user payments if license is expired
    if (paymentType === 'user' && isExpired) {
      throw new Error('Cannot add user payments for expired licenses. Please renew the license first.');
    }

    // If this is an annual payment and license is in free trial, check if initial payment was made
    if (paymentType === 'annual' && license.isFreeTrial) {
      if (!hasInitialPayment) {
        throw new Error('Initial payment not paid yet. Please make an initial payment first before adding annual subscription payments.');
      }
    }

    // Log payment type for debugging
    logger.info('Creating payment with type', {
      licenseId: input.licenseId,
      inputPaymentType: input.paymentType,
      inputPaymentTypeType: typeof input.paymentType,
      determinedPaymentType: paymentType,
      determinedPaymentTypeType: typeof paymentType,
      isAnnualSubscription: input.isAnnualSubscription,
    });

    // Create payment and renew subscription if it's an annual payment
    const payment = await prisma.$transaction(async (tx) => {
      // Create payment - explicitly set paymentType to ensure it's not using default
      const paymentData = {
        licenseId: input.licenseId,
        amount: new Decimal(input.amount),
        paymentDate: input.paymentDate || new Date(),
        isAnnualSubscription: input.isAnnualSubscription,
        paymentType: paymentType as 'initial' | 'annual' | 'user',
      };
      
      logger.info('Payment data being saved', {
        licenseId: paymentData.licenseId,
        paymentType: paymentData.paymentType,
      });
      
      const payment = await tx.payment.create({
        data: paymentData,
      });
      
      logger.info('Payment created', {
        paymentId: payment.id,
        savedPaymentType: payment.paymentType,
      });

      // Prepare license update data
      const licenseUpdateData: Record<string, unknown> = {};
      
      // If license is in free trial, convert it to paid license
      if (license.isFreeTrial) {
        licenseUpdateData.isFreeTrial = false;
        licenseUpdateData.freeTrialEndDate = null;
        
        logger.info('Converting free trial license to paid license', {
          licenseId: input.licenseId,
          paymentId: payment.id,
        });
      }
      
      // If this is an initial payment AND license is NOT a free trial, update the initial price
      // For free trials, keep the original initial price as set during license creation
      if (paymentType === 'initial' && !license.isFreeTrial) {
        licenseUpdateData.initialPrice = new Decimal(input.amount);
        
        logger.info('Updating license initial price from initial payment', {
          licenseId: input.licenseId,
          paymentId: payment.id,
          newInitialPrice: input.amount,
          previousInitialPrice: license.initialPrice.toString(),
        });
      } else if (paymentType === 'initial' && license.isFreeTrial) {
        logger.info('Free trial initial payment - keeping original initial price', {
          licenseId: input.licenseId,
          paymentId: payment.id,
          originalInitialPrice: license.initialPrice.toString(),
          paymentAmount: input.amount,
        });
      }
      
      // If additional users are specified, increment user limit
      if (input.additionalUsers && input.additionalUsers > 0) {
        licenseUpdateData.userLimit = {
          increment: input.additionalUsers,
        };
        
        logger.info('Incrementing user limit from payment', {
          licenseId: input.licenseId,
          paymentId: payment.id,
          additionalUsers: input.additionalUsers,
          previousLimit: license.userLimit,
          newLimit: license.userLimit + input.additionalUsers,
        });
      }

      // Handle subscription updates based on payment type
      const latestSubscription = license.subscriptions[0];
      
      if (paymentType === 'annual') {
        // Annual subscription payment - extend subscription by 1 year
        if (latestSubscription) {
          // Renew existing subscription - always extend from the current endDate
          // This ensures the customer gets the full period they paid for, even if subscription expired
          const startDate = latestSubscription.endDate;
          const endDate = new Date(startDate);
          // For regular licenses, extend by 1 year
          endDate.setFullYear(endDate.getFullYear() + 1);
          
          // Grace period end always equals endDate (no grace period)
          const gracePeriodEnd = new Date(endDate);
          
          await tx.subscription.update({
            where: { id: latestSubscription.id },
            data: {
              startDate,
              endDate,
              status: 'active',
              gracePeriodEnd,
              annualFee: new Decimal(config.annualSubscriptionPrice),
            },
          });
          
          logger.info('Subscription automatically renewed via annual payment', {
            subscriptionId: latestSubscription.id,
            licenseId: input.licenseId,
            paymentId: payment.id,
            newEndDate: endDate,
            extendedFrom: startDate,
          });
        } else {
          // No existing subscription, create a new one
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          
          // Grace period end always equals endDate (no grace period)
          const gracePeriodEnd = new Date(endDate);
          
          await tx.subscription.create({
            data: {
              licenseId: input.licenseId,
              startDate,
              endDate,
              status: 'active',
              annualFee: new Decimal(config.annualSubscriptionPrice),
              gracePeriodEnd,
            },
          });
          
          logger.info('New subscription created via annual payment', {
            licenseId: input.licenseId,
            paymentId: payment.id,
            endDate,
          });
        }
      } else {
        // Initial payment (not annual subscription) - convert free trial to full license
        // Extend subscription to 1 year from now
        if (latestSubscription) {
          const now = new Date();
          const currentEndDate = new Date(latestSubscription.endDate);
          
          // Start from the later of: now or current subscription end date
          const startDate = currentEndDate > now ? currentEndDate : now;
          const endDate = new Date(startDate);
          // For regular licenses, extend by 1 year
          endDate.setFullYear(endDate.getFullYear() + 1);
          
          // Grace period end always equals endDate (no grace period)
          const gracePeriodEnd = new Date(endDate);
          
          await tx.subscription.update({
            where: { id: latestSubscription.id },
            data: {
              startDate,
              endDate,
              status: 'active',
              gracePeriodEnd,
              annualFee: new Decimal(config.annualSubscriptionPrice),
            },
          });
          
          logger.info('Subscription extended via initial payment', {
            subscriptionId: latestSubscription.id,
            licenseId: input.licenseId,
            paymentId: payment.id,
            newEndDate: endDate,
            wasFreeTrial: license.isFreeTrial,
          });
        } else {
          // No existing subscription, create a new one starting from now
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1);
          
          // Grace period end always equals endDate (no grace period)
          const gracePeriodEnd = new Date(endDate);
          
          await tx.subscription.create({
            data: {
              licenseId: input.licenseId,
              startDate,
              endDate,
              status: 'active',
              annualFee: new Decimal(config.annualSubscriptionPrice),
              gracePeriodEnd,
            },
          });
          
          logger.info('New subscription created via initial payment', {
            licenseId: input.licenseId,
            paymentId: payment.id,
            endDate,
            wasFreeTrial: license.isFreeTrial,
          });
        }
      }

      // Update license (for free trial conversion and/or initial price update)
      if (Object.keys(licenseUpdateData).length > 0) {
        await tx.license.update({
          where: { id: input.licenseId },
          data: licenseUpdateData as Parameters<typeof tx.license.update>[0]['data'],
        });
      }

      // Return payment with license details
      const paymentWithLicense = await tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          license: {
            select: {
              id: true,
              licenseKey: true,
              customerName: true,
              customerPhone: true,
              locationName: true,
            },
          },
        },
      });

      if (!paymentWithLicense) {
        throw new Error('Failed to retrieve created payment');
      }

      return paymentWithLicense;
    });

    logger.info('Payment created', {
      paymentId: payment.id,
      licenseId: input.licenseId,
      amount: input.amount.toString(),
      isAnnualSubscription: input.isAnnualSubscription,
      subscriptionRenewed: input.isAnnualSubscription,
    });

    return payment as PaymentWithLicense;
  }
}

