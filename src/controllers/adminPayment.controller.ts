import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Admin Payment Controller
 * Handles HTTP requests for admin payment management operations
 */
export class AdminPaymentController {
  /**
   * Get paginated list of payments with filtering
   * GET /api/admin/payments
   */
  static async getPayments(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const licenseId = req.query.licenseId ? parseInt(req.query.licenseId as string) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const isAnnualSubscription =
        req.query.isAnnualSubscription !== undefined
          ? req.query.isAnnualSubscription === 'true' || req.query.isAnnualSubscription === '1'
          : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      if (licenseId && isNaN(licenseId)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      if (startDate && isNaN(startDate.getTime())) {
        ResponseUtil.error(res, 'Invalid start date format', 400);
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        ResponseUtil.error(res, 'Invalid end date format', 400);
        return;
      }

      const result = await PaymentService.getPaymentsPaginated({
        page,
        pageSize,
        licenseId,
        startDate,
        endDate,
        isAnnualSubscription,
        sortBy,
        sortOrder,
      });

      logger.info('Admin retrieved payments list', {
        adminId: req.admin?.id,
        page,
        pageSize,
        totalItems: result.pagination.totalItems,
        totalAmount: result.meta.totalAmount,
      });

      ResponseUtil.success(
        res,
        {
          payments: result.data,
          pagination: result.pagination,
          meta: result.meta,
        },
        'Payments retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve payments';
      logger.error('Error retrieving payments', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get payment by ID
   * GET /api/admin/payments/:id
   */
  static async getPaymentById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        ResponseUtil.error(res, 'Invalid payment ID', 400);
        return;
      }

      const payment = await PaymentService.getPaymentById(id);

      if (!payment) {
        ResponseUtil.notFound(res, 'Payment not found');
        return;
      }

      logger.info('Admin retrieved payment details', {
        adminId: req.admin?.id,
        paymentId: id,
      });

      ResponseUtil.success(res, payment, 'Payment retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve payment';
      logger.error('Error retrieving payment', {
        error: errorMessage,
        adminId: req.admin?.id,
        paymentId: req.params.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get payment statistics
   * GET /api/admin/payments/stats
   */
  static async getPaymentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const licenseId = req.query.licenseId ? parseInt(req.query.licenseId as string) : undefined;

      if (startDate && isNaN(startDate.getTime())) {
        ResponseUtil.error(res, 'Invalid start date format', 400);
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        ResponseUtil.error(res, 'Invalid end date format', 400);
        return;
      }

      if (licenseId && isNaN(licenseId)) {
        ResponseUtil.error(res, 'Invalid license ID', 400);
        return;
      }

      const stats = await PaymentService.getPaymentStatistics({
        startDate,
        endDate,
        licenseId,
      });

      logger.info('Admin retrieved payment statistics', {
        adminId: req.admin?.id,
        totalPayments: stats.totalPayments,
        totalAmount: stats.totalAmount,
      });

      ResponseUtil.success(res, stats, 'Payment statistics retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve payment statistics';
      logger.error('Error retrieving payment statistics', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Create a new payment manually
   * POST /api/admin/payments
   */
  static async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const { licenseId, amount, paymentDate, isAnnualSubscription, paymentType, additionalUsers } = req.body;

      // Validate required fields
      if (!licenseId || typeof licenseId !== 'number') {
        ResponseUtil.error(res, 'License ID is required and must be a number', 400);
        return;
      }

      if (!amount || typeof amount !== 'number' || amount <= 0) {
        ResponseUtil.error(res, 'Amount is required and must be a positive number', 400);
        return;
      }

      if (typeof isAnnualSubscription !== 'boolean') {
        ResponseUtil.error(res, 'isAnnualSubscription is required and must be a boolean', 400);
        return;
      }

      // Validate additional users if provided
      if (additionalUsers !== undefined) {
        if (typeof additionalUsers !== 'number' || additionalUsers <= 0 || !Number.isInteger(additionalUsers)) {
          ResponseUtil.error(res, 'additionalUsers must be a positive integer', 400);
          return;
        }
      }

      // Validate payment date if provided
      let parsedPaymentDate: Date | undefined;
      if (paymentDate) {
        parsedPaymentDate = new Date(paymentDate);
        if (isNaN(parsedPaymentDate.getTime())) {
          ResponseUtil.error(res, 'Invalid payment date format', 400);
          return;
        }
      }

      const payment = await PaymentService.createPayment({
        licenseId,
        amount,
        paymentDate: parsedPaymentDate,
        isAnnualSubscription,
        paymentType: paymentType || (isAnnualSubscription ? 'annual' : 'initial'),
        additionalUsers,
      });

      logger.info('Admin created payment', {
        adminId: req.admin?.id,
        paymentId: payment.id,
        licenseId,
        amount,
        isAnnualSubscription,
      });

      ResponseUtil.success(res, payment, 'Payment created successfully', 201);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment';
      logger.error('Error creating payment', {
        error: errorMessage,
        adminId: req.admin?.id,
        body: req.body,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

