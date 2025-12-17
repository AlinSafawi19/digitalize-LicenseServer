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

export const connectDatabase = async (forceReconnect: boolean = false): Promise<void> => {
  // If already connected and not forcing reconnect, return early
  if (isConnected && !forceReconnect) return;
  
  // If forcing reconnect, disconnect first
  if (forceReconnect && isConnected) {
    try {
      await prisma.$disconnect();
      isConnected = false;
      logger.info('Disconnected from database for reconnection');
    } catch (disconnectError) {
      // Ignore disconnect errors - connection might already be closed
      logger.debug('Error during disconnect (ignored)', { error: disconnectError });
      isConnected = false;
    }
  }
  
  // Validate DATABASE_URL is set
  if (!databaseUrl || databaseUrl.trim() === '') {
    const errorMessage = 'DATABASE_URL environment variable is not set. Please check your .env file.';
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // Retry connection with exponential backoff
  const maxRetries = 5;
  const baseDelay = 1000; // 1 second
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      isConnected = true;
      logger.info('Database connected successfully', {
        attempt,
        totalAttempts: attempt > 1 ? attempt : undefined,
      });
      return; // Success - exit function
    } catch (error: unknown) {
      lastError = error;
      const errorObj = error as { errorCode?: string; code?: string; message?: string };
      const errorCode = errorObj?.errorCode || errorObj?.code;
      const errorMessage = errorObj?.message || String(error);
      
      // If it's the last attempt, don't retry
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`, {
        errorCode,
        errorMessage: errorMessage.substring(0, 100), // Truncate long messages
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all retries failed
  const errorObj = lastError as { errorCode?: string; code?: string; message?: string };
  const errorCode = errorObj?.errorCode || errorObj?.code;
  const errorMessage = errorObj?.message || String(lastError);
  
  // Parse DATABASE_URL to show connection details (without password)
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  const connectionInfo = urlMatch 
    ? {
        user: urlMatch[1],
        host: urlMatch[3],
        port: urlMatch[4],
        database: urlMatch[5],
      }
    : null;
  
  // Get troubleshooting message based on error code
  const troubleshootingMessages: Record<string, string> = {
    P1001: 'Cannot reach database server. Check if PostgreSQL is running and accessible.',
    P1003: 'Database does not exist. Create the database or check the database name in DATABASE_URL.',
    P1000: 'Authentication failed. Check username and password in DATABASE_URL.',
    default: 'Check your DATABASE_URL format: postgresql://user:password@host:port/database',
  };
  
  const troubleshooting = errorCode && troubleshootingMessages[errorCode] 
    ? troubleshootingMessages[errorCode]
    : troubleshootingMessages.default || 'Unknown database connection error. Check your DATABASE_URL and PostgreSQL server status.';
  
  logger.error('Database connection failed after all retries', {
    errorCode,
    errorMessage,
    connectionInfo,
    troubleshooting,
    totalAttempts: maxRetries,
  });
  
  // Provide helpful suggestions based on error code
  if (errorCode === 'P1003') {
    logger.error('Database does not exist. To create it, run:', {
      command: `psql -U ${connectionInfo?.user || 'postgres'} -h ${connectionInfo?.host || 'localhost'} -c "CREATE DATABASE ${connectionInfo?.database || 'digitalizePOS_licenses'};"`,
      alternative: `Or use: npx prisma migrate dev (this will create the database if it doesn't exist)`,
    });
  }
  
  throw lastError;
};

// Graceful shutdown
process.on('beforeExit', async () => {
  if (isConnected) {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  }
});

export default prisma;

