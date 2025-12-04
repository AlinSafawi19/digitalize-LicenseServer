import { Request, Response } from 'express';
import { StatsService } from '../services/stats.service';
import { LicenseService } from '../services/license.service';
import { licensesToCSV } from '../utils/csv.util';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

// In-memory lock to prevent concurrent executions
let isUpdatingExpiredLicenses = false;

/**
 * Admin Stats Controller
 * Handles HTTP requests for admin statistics and reporting
 */
export class AdminStatsController {
  /**
   * Get dashboard statistics
   * GET /api/admin/stats
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await StatsService.getDashboardStats();

      logger.info('Admin retrieved dashboard stats', {
        adminId: req.admin?.id,
      });

      ResponseUtil.success(res, stats, 'Statistics retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve statistics';
      logger.error('Error retrieving statistics', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Export license list as CSV
   * GET /api/admin/reports/licenses
   */
  static async exportLicenses(req: Request, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const isFreeTrial = req.query.isFreeTrial !== undefined 
        ? req.query.isFreeTrial === 'true' || req.query.isFreeTrial === '1'
        : undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      // Get all licenses (no pagination for export)
      const result = await LicenseService.getLicensesPaginated({
        page: 1,
        pageSize: 10000, // Large page size to get all licenses
        status,
        search,
        isFreeTrial,
        sortBy,
        sortOrder,
      });

      // Convert to CSV
      const csv = licensesToCSV(result.data);

      // Set headers for CSV download
      const filename = `licenses_export_${new Date().toISOString().split('T')[0]}.csv`;

      logger.info('Admin exported licenses as CSV', {
        adminId: req.admin?.id,
        count: result.data.length,
        filename,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csv);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export licenses';
      logger.error('Error exporting licenses', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Get revenue by period and trends
   * GET /api/admin/reports/revenue
   */
  static async getRevenueReport(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      if (startDate && isNaN(startDate.getTime())) {
        ResponseUtil.error(res, 'Invalid start date format', 400);
        return;
      }

      if (endDate && isNaN(endDate.getTime())) {
        ResponseUtil.error(res, 'Invalid end date format', 400);
        return;
      }

      const revenueByPeriod = await StatsService.getRevenueByPeriod(startDate, endDate);

      // Calculate totals and trends
      const totalRevenue = revenueByPeriod.reduce((sum, period) => sum + period.amount, 0);
      const totalCount = revenueByPeriod.reduce((sum, period) => sum + period.count, 0);

      // Calculate trend (compare last two periods if available)
      let trend: number | null = null;
      if (revenueByPeriod.length >= 2) {
        const lastPeriod = revenueByPeriod[revenueByPeriod.length - 1];
        const previousPeriod = revenueByPeriod[revenueByPeriod.length - 2];
        if (previousPeriod.amount > 0) {
          trend = ((lastPeriod.amount - previousPeriod.amount) / previousPeriod.amount) * 100;
        }
      }

      logger.info('Admin retrieved revenue report', {
        adminId: req.admin?.id,
        periods: revenueByPeriod.length,
        totalRevenue,
      });

      ResponseUtil.success(
        res,
        {
          revenueByPeriod,
          summary: {
            totalRevenue,
            totalCount,
            periodCount: revenueByPeriod.length,
            trend,
          },
        },
        'Revenue report retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve revenue report';
      logger.error('Error retrieving revenue report', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Manually trigger update expired licenses job
   * POST /api/admin/jobs/update-expired-licenses
   * This endpoint should be called by a cron job every 1-2 hours
   */
  static async updateExpiredLicenses(req: Request, res: Response): Promise<void> {
    try {
      // Prevent concurrent executions
      if (isUpdatingExpiredLicenses) {
        ResponseUtil.error(res, 'Update expired licenses job is already running', 409);
        return;
      }

      isUpdatingExpiredLicenses = true;

      try {
        const result = await LicenseService.updateExpiredLicenses();

        logger.info('Admin manually triggered update expired licenses job', {
          adminId: req.admin?.id,
          updated: result.updated,
        });

        ResponseUtil.success(
          res,
          {
            updated: result.updated,
            message: `Successfully updated ${result.updated} expired license(s)`,
          },
          'Update expired licenses job completed successfully',
          200
        );
      } finally {
        isUpdatingExpiredLicenses = false;
      }
    } catch (error: unknown) {
      isUpdatingExpiredLicenses = false;
      const errorMessage = error instanceof Error ? error.message : 'Failed to update expired licenses';
      logger.error('Error in update expired licenses job', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

