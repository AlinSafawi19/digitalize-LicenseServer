/**
 * Query Performance Monitoring Utility
 * Tracks and logs slow database queries
 */

import { logger } from './logger';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: unknown;
}

class QueryPerformanceMonitor {
  private slowQueryThreshold: number; // milliseconds
  private queryMetrics: QueryMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 slow queries

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
    this.setupPrismaMiddleware();
  }

  /**
   * Setup Prisma middleware to monitor queries
   */
  private setupPrismaMiddleware(): void {
    // This will be called from database.ts after Prisma client is created
  }

  /**
   * Log slow query
   */
  logSlowQuery(query: string, duration: number, params?: unknown): void {
    if (duration >= this.slowQueryThreshold) {
      const metric: QueryMetrics = {
        query,
        duration,
        timestamp: new Date(),
        params,
      };

      this.queryMetrics.push(metric);

      // Keep only last maxMetrics
      if (this.queryMetrics.length > this.maxMetrics) {
        this.queryMetrics.shift();
      }

      logger.warn('Slow database query detected', {
        query: this.sanitizeQuery(query),
        duration: `${duration}ms`,
        threshold: `${this.slowQueryThreshold}ms`,
        params: this.sanitizeParams(params),
      });
    }
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove potential sensitive information from query
    return query
      .replace(/password[=:]\s*'[^']*'/gi, "password='***'")
      .replace(/token[=:]\s*'[^']*'/gi, "token='***'");
  }

  /**
   * Sanitize parameters for logging
   */
  private sanitizeParams(params: unknown): unknown {
    if (!params || typeof params !== 'object' || params === null) return undefined;

    const sanitized = { ...(params as Record<string, unknown>) };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  /**
   * Get slow query statistics
   */
  getSlowQueryStats(): {
    total: number;
    averageDuration: number;
    maxDuration: number;
    recent: QueryMetrics[];
  } {
    if (this.queryMetrics.length === 0) {
      return {
        total: 0,
        averageDuration: 0,
        maxDuration: 0,
        recent: [],
      };
    }

    const durations = this.queryMetrics.map(m => m.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    return {
      total: this.queryMetrics.length,
      averageDuration: Math.round(averageDuration * 100) / 100,
      maxDuration,
      recent: this.queryMetrics.slice(-10).reverse(), // Last 10, most recent first
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Set slow query threshold
   */
  setThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }
}

// Singleton instance
export const queryPerformanceMonitor = new QueryPerformanceMonitor(
  parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10)
);

/**
 * Create Prisma middleware for query performance monitoring
 */
export function createQueryPerformanceMiddleware(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { $use: (middleware: any) => void }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$use(async (params: any, next: any) => {
    const before = Date.now();
    const prismaParams = params as { model?: string; action?: string; args?: unknown };
    
    try {
      const result = await next(params);
      const duration = Date.now() - before;
      
      // Log slow queries
      queryPerformanceMonitor.logSlowQuery(
        `${prismaParams.model || 'unknown'}.${prismaParams.action || 'unknown'}`,
        duration,
        prismaParams.args
      );
      
      return result;
    } catch (error) {
      const duration = Date.now() - before;
      
      // Log slow queries even on error
      queryPerformanceMonitor.logSlowQuery(
        `${prismaParams.model || 'unknown'}.${prismaParams.action || 'unknown'}`,
        duration,
        prismaParams.args
      );
      
      throw error;
    }
  });
}

