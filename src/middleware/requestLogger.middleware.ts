import { Request, Response, NextFunction } from 'express';
import { logApiRequest } from '../utils/logger';
import { metricsCollector } from '../utils/metrics.util';

/**
 * Request/Response Logging Middleware
 * Logs all API requests with response time, status code, and metadata
 * Also collects metrics for performance monitoring
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const userId = req.admin?.id;
    const isError = res.statusCode >= 400;

    // Log the request
    logApiRequest(
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      req.ip,
      req.get('user-agent'),
      userId
    );

    // Record metrics (exclude health check and metrics endpoints from detailed tracking)
    if (!req.path.startsWith('/health') && !req.path.startsWith('/api/metrics')) {
      metricsCollector.recordRequest(req.method, req.path, responseTime, isError);
    }
  });

  next();
};

