import cron from 'node-cron';
import { SubscriptionService } from './subscription.service';
import { LicenseService } from './license.service';
import { logger } from '../utils/logger';

/**
 * Scheduler Service
 * Handles scheduled tasks and cron jobs
 */
export class SchedulerService {
  private static isRunning = false;

  /**
   * Start all scheduled tasks
   */
  static async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting scheduler service...');

    // ============================================================================
    // PRODUCTION MODE: Daily schedule
    // ============================================================================
    
    // Run daily at 2:00 AM to check for expired subscriptions
    // Cron format: minute hour day month day-of-week
    // '0 2 * * *' = Every day at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Running scheduled task: Update expired subscriptions');
        const result = await SubscriptionService.updateExpiredSubscriptions();
        logger.info('Scheduled task completed', { updated: result.updated });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('Error in scheduled task: Update expired subscriptions', {
          error: errorMessage,
          stack: errorStack,
        });
      }
    });

    // Run daily at 2:05 AM to expire free trial licenses
    // '5 2 * * *' = Every day at 2:05 AM
    cron.schedule('5 2 * * *', async () => {
      try {
        logger.info('Running scheduled task: Expire free trial licenses');
        const result = await LicenseService.expireFreeTrialLicenses();
        logger.info('Scheduled task completed', { expired: result.expired });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('Error in scheduled task: Expire free trial licenses', {
          error: errorMessage,
          stack: errorStack,
        });
      }
    });

    // Run daily at 2:10 AM to send expiration warnings
    // '10 2 * * *' = Every day at 2:10 AM
    cron.schedule('10 2 * * *', async () => {
      try {
        logger.info('Running scheduled task: Send expiration warnings');
        const result = await LicenseService.sendExpirationWarnings();
        logger.info('Scheduled task completed', { warningsSent: result.warningsSent });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('Error in scheduled task: Send expiration warnings', {
          error: errorMessage,
          stack: errorStack,
        });
      }
    });

    // Also run on server startup to catch any subscriptions that expired while server was down
    await this.runOnStartup();

    this.isRunning = true;
    logger.info('Scheduler service started successfully');
  }

  /**
   * Run scheduled tasks immediately on startup
   */
  private static async runOnStartup(): Promise<void> {
    try {
      logger.info('Running startup task: Update expired subscriptions');
      const result = await SubscriptionService.updateExpiredSubscriptions();
      logger.info('Startup task completed', { updated: result.updated });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error in startup task: Update expired subscriptions', {
        error: errorMessage,
        stack: errorStack,
      });
    }

    try {
      logger.info('Running startup task: Expire free trial licenses');
      const result = await LicenseService.expireFreeTrialLicenses();
      logger.info('Startup task completed', { expired: result.expired });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error in startup task: Expire free trial licenses', {
        error: errorMessage,
        stack: errorStack,
      });
    }

    try {
      logger.info('Running startup task: Send expiration warnings');
      const result = await LicenseService.sendExpirationWarnings();
      logger.info('Startup task completed', { warningsSent: result.warningsSent });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error in startup task: Send expiration warnings', {
        error: errorMessage,
        stack: errorStack,
      });
    }
  }

  /**
   * Stop all scheduled tasks
   */
  static stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Note: node-cron doesn't have a built-in way to stop all tasks
    // In a production environment, you might want to track task references
    logger.info('Stopping scheduler service...');
    this.isRunning = false;
    logger.info('Scheduler service stopped');
  }
}

