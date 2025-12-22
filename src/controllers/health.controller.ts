import { Request, Response } from 'express';
import { getSystemInfo, checkDatabaseHealth, getMemoryUsageMB } from '../utils/system.util';
import { logger } from '../utils/logger';
import { config } from '../config/config';

/**
 * Health Check Controller
 * Provides comprehensive health status of the application
 */

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get system information
    const systemInfo = getSystemInfo();
    const memoryUsage = getMemoryUsageMB();
    
    // Check database connection
    const dbHealth = await checkDatabaseHealth();
    
    // Determine overall health status
    const isHealthy = dbHealth.status === 'connected' && systemInfo.memory.usagePercent < 95;
    const statusCode = isHealthy ? 200 : 503;
    
    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: systemInfo.uptime,
        formatted: systemInfo.uptimeFormatted,
      },
      database: {
        status: dbHealth.status,
        ...(dbHealth.responseTime && { responseTime: `${dbHealth.responseTime}ms` }),
        ...(dbHealth.error && { error: dbHealth.error }),
      },
      memory: {
        system: {
          total: `${Math.round(systemInfo.memory.total / 1024 / 1024)}MB`,
          free: `${Math.round(systemInfo.memory.free / 1024 / 1024)}MB`,
          used: `${Math.round(systemInfo.memory.used / 1024 / 1024)}MB`,
          usagePercent: `${systemInfo.memory.usagePercent.toFixed(2)}%`,
        },
        process: memoryUsage,
      },
      system: {
        nodeVersion: systemInfo.nodeVersion,
        platform: systemInfo.platform,
        arch: systemInfo.arch,
        cpuCores: systemInfo.cpu.cores,
      },
      whatsapp: {
        enabled: config.whatsappEnabled,
        configured: !!(config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber) || !!config.whatsappApiUrl,
        provider: config.whatsappAccountSid ? 'Twilio' : config.whatsappApiUrl ? 'Custom API' : 'None',
      },
    };
    
    // Log health check if unhealthy
    if (!isHealthy) {
      logger.warn('Health check failed', {
        status: response.status,
        database: dbHealth.status,
        memoryUsage: systemInfo.memory.usagePercent,
      });
    }
    
    res.status(statusCode).json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check error', { error: errorMessage });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });
  }
};

