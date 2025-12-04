import { Request, Response } from 'express';
import { metricsCollector } from '../utils/metrics.util';
import { getSystemInfo, getMemoryUsageMB } from '../utils/system.util';
import { logger } from '../utils/logger';

/**
 * Metrics Controller
 * Provides system performance metrics and statistics
 * Requires admin authentication
 */

export const getMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const systemInfo = getSystemInfo();
    const memoryUsage = getMemoryUsageMB();
    const metrics = metricsCollector.getMetrics();

    const response = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: metrics.uptime,
        memory: {
          system: {
            total: `${Math.round(systemInfo.memory.total / 1024 / 1024)}MB`,
            free: `${Math.round(systemInfo.memory.free / 1024 / 1024)}MB`,
            used: `${Math.round(systemInfo.memory.used / 1024 / 1024)}MB`,
            usagePercent: `${systemInfo.memory.usagePercent.toFixed(2)}%`,
          },
          process: memoryUsage,
        },
        cpu: {
          cores: systemInfo.cpu.cores,
          loadAverage: systemInfo.cpu.loadAverage.map(load => Math.round(load * 100) / 100),
        },
        nodeVersion: systemInfo.nodeVersion,
        platform: systemInfo.platform,
        arch: systemInfo.arch,
      },
      requests: metrics.requests,
      responseTime: metrics.responseTime,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error retrieving metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics',
    });
  }
};

/**
 * Reset metrics (admin only)
 */
export const resetMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    metricsCollector.reset();
    logger.info('Metrics reset by admin', { adminId: _req.admin?.id });
    
    res.json({
      success: true,
      message: 'Metrics reset successfully',
    });
  } catch (error) {
    logger.error('Error resetting metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to reset metrics',
    });
  }
};

