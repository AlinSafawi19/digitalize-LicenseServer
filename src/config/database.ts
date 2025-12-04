import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { createQueryPerformanceMiddleware } from '../utils/queryPerformance.util';
import { setInterval } from 'timers';

// Connection pool configuration
// Prisma uses connection pooling automatically with PostgreSQL
// The connection string should include pool parameters in DATABASE_URL:
// postgresql://user:password@host:port/database?connection_limit=10&pool_timeout=20
// 
// Performance optimization: Configure connection pool explicitly
// Default values if not in DATABASE_URL:
// - connection_limit: 10 (max concurrent connections)
// - pool_timeout: 20 (seconds to wait for connection)
// Performance optimization: Explicitly configure connection pool
// Parse DATABASE_URL and ensure connection pool parameters are set
const databaseUrl = process.env.DATABASE_URL || '';
const hasConnectionLimit = databaseUrl.includes('connection_limit');
const hasPoolTimeout = databaseUrl.includes('pool_timeout');

// Build DATABASE_URL with connection pool parameters if not already present
let finalDatabaseUrl = databaseUrl;
if (!hasConnectionLimit || !hasPoolTimeout) {
  const separator = databaseUrl.includes('?') ? '&' : '?';
  const poolParams = [];
  if (!hasConnectionLimit) {
    poolParams.push('connection_limit=10');
  }
  if (!hasPoolTimeout) {
    poolParams.push('pool_timeout=20');
  }
  if (poolParams.length > 0) {
    finalDatabaseUrl = `${databaseUrl}${separator}${poolParams.join('&')}`;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: finalDatabaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

// Setup query performance monitoring middleware
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_QUERY_MONITORING === 'true') {
  createQueryPerformanceMiddleware(prisma);
}

// Performance optimization: Monitor connection pool usage
// Log pool statistics periodically to detect potential issues
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_POOL_MONITORING === 'true') {
  setInterval(async () => {
    try {
      // Get connection pool metrics from Prisma
      // Note: Prisma doesn't expose direct pool metrics, but we can monitor query performance
      const poolInfo = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
      `;
      
      const activeConnections = Number(poolInfo[0]?.count || 0);
      
      // Log warning if connection count is high (indicates potential pool exhaustion)
      if (activeConnections > 15) {
        logger.warn('High database connection count detected', {
          activeConnections,
          threshold: 15,
          message: 'Consider increasing connection_limit in DATABASE_URL or optimizing queries',
        });
      } else {
        logger.debug('Database connection pool status', {
          activeConnections,
        });
      }
    } catch (error) {
      // Silently fail - pool monitoring shouldn't break the app
      logger.debug('Failed to check connection pool status', { error });
    }
  }, 60000); // Check every minute
}

// Handle Prisma connection on first use
let isConnected = false;

export const connectDatabase = async (): Promise<void> => {
  if (isConnected) return;
  
  try {
    await prisma.$connect();
    isConnected = true;
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  if (isConnected) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
});

export default prisma;

