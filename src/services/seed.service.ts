import prisma from '../config/database';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

/**
 * Seed Service
 * Handles database seeding operations
 */
export class SeedService {
  /**
   * Run initial seed - creates admin user if none exists
   * This is safe to run multiple times - it only creates if admin doesn't exist
   */
  static async runInitialSeed(): Promise<void> {
    try {
      logger.info('Checking if admin user exists...');
      
      // Check if any admin exists
      const adminCount = await prisma.admin.count();
      
      if (adminCount > 0) {
        logger.info('Admin user already exists, skipping seed');
        return;
      }

      logger.info('No admin user found, creating initial admin...');
      
      // Create admin user
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const saltRounds = 10;
      const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

      const admin = await prisma.admin.create({
        data: {
          username: 'admin',
          phone: '+1234567890',
          passwordHash: adminPasswordHash,
          isActive: true,
        },
      });

      logger.info('✅ Initial seed completed successfully!', {
        adminId: admin.id,
        username: admin.username,
        phone: admin.phone,
      });
      logger.warn('⚠️  Default admin password is: admin123');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error running initial seed', { error: errorMessage });
      // Don't throw - allow server to start even if seed fails
      // Admin can be created manually if needed
    }
  }
}

