// IMPORTANT: Import instrument.ts at the very top to initialize Sentry before everything else
import './instrument';
// Import type augmentations early to ensure they're available throughout the app
import './types/express';

import { setupExpressErrorHandler } from '@sentry/node';
import express from 'express';
import compression from 'compression';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/requestLogger.middleware';
import healthRoutes from './routes/health.routes';
import apiRoutes from './routes/api';
import metricsRoutes from './routes/metrics.routes';
import { connectDatabase } from './config/database';
import prisma from './config/database';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { SchedulerService } from './services/scheduler.service';
import { SeedService } from './services/seed.service';
import {
  configureHelmet,
  configureCORS,
  enforceHTTPS,
  sanitizeInputMiddleware,
  REQUEST_SIZE_LIMITS,
} from './config/security.config';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - Required when behind a reverse proxy (Railway, Vercel, etc.)
// This allows Express to properly read X-Forwarded-For headers for rate limiting
// Set to true in production environments where the app is behind a proxy
app.set('trust proxy', process.env.NODE_ENV === 'production' ? true : 1);

// Security Middleware (order matters!)
// 1. HTTPS enforcement (in production)
app.use(enforceHTTPS);

// 2. Helmet.js - Security headers
app.use(configureHelmet());

// 3. CORS - Configure allowed origins
app.use(configureCORS());

// 4. Response compression - Reduces payload size by 60-80%
// Performance optimization: Compress responses to reduce bandwidth and improve load times
// Lower threshold to 512 bytes for better compression of small JSON responses
app.use(compression({ threshold: 512 }));

// 5. Body parsing with size limits
app.use(express.json({ limit: REQUEST_SIZE_LIMITS.json }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_SIZE_LIMITS.urlencoded }));

// 6. Input sanitization
app.use(sanitizeInputMiddleware);

// 7. Request/Response logging middleware (with response time)
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api', apiRoutes);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'DigitalizePOS License Server API',
    version: '1.0.0',
    status: 'running',
  });
});

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Sentry error handler must be before the custom error handler
setupExpressErrorHandler(app);

// Error handling middleware (must be last)
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  const errorStack = reason instanceof Error ? reason.stack : undefined;
  
  logger.error('Unhandled Promise Rejection', {
    reason: errorMessage,
    stack: errorStack,
    promise,
  });
  // Don't exit in development to allow debugging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  // For port already in use errors, provide helpful message
  if (error.message.includes('EADDRINUSE')) {
    logger.error(`Port ${PORT} is already in use. Please stop the process using this port or change the PORT environment variable.`);
  }
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Run database migrations FIRST in production (before connecting)
    // This avoids connection conflicts - migrations use their own Prisma client
    if (process.env.NODE_ENV === 'production') {
      try {
        logger.info('Running database migrations...');
        console.log('[SERVER] Running database migrations...');
        execSync('npx prisma migrate deploy', { 
          stdio: 'inherit',
          env: { ...process.env }
        });
        logger.info('Database migrations completed successfully');
        console.log('[SERVER] Database migrations completed successfully');
        
        // Wait a moment for any connection cleanup to complete
        logger.info('Waiting for connection cleanup...');
        console.log('[SERVER] Waiting for connection cleanup...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        logger.info('Connection cleanup wait completed');
        console.log('[SERVER] Connection cleanup wait completed');
      } catch (migrationError: unknown) {
        const errorMessage = migrationError instanceof Error ? migrationError.message : String(migrationError);
        logger.warn('Database migration warning', { 
          error: errorMessage 
        });
        console.log('[SERVER] Database migration warning:', errorMessage);
        // Don't exit - migrations might have already been applied
        // Server will start and show actual errors if tables are missing
      }
    }
    
    // Connect to database AFTER migrations
    // This ensures we have a fresh connection after migrations complete
    logger.info('Connecting to database...');
    console.log('[SERVER] Connecting to database...');
    await connectDatabase();
    console.log('[SERVER] connectDatabase() completed');
    
    // Verify the connection is working
    try {
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection verified');
    } catch (connectionError) {
      logger.error('Database connection verification failed', {
        error: connectionError instanceof Error ? connectionError.message : String(connectionError)
      });
      // Try reconnecting one more time
      logger.info('Attempting to reconnect...');
      await connectDatabase(true);
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connection verified after retry');
    }
    
    // Run initial seed if no admin exists (safe to run multiple times)
    await SeedService.runInitialSeed();
    
    // Start scheduled tasks (subscription expiration updates, etc.)
    await SchedulerService.start();
    
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
      });
    }).on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please stop the process using this port or change the PORT environment variable.`, {
          port: PORT,
          error: error.message,
        });
        logger.info('To find and kill the process using this port, run: netstat -ano | findstr :3000');
      } else {
        logger.error('Failed to start server', { error: error.message, stack: error.stack });
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;

