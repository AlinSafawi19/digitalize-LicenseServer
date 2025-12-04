import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface CreateAdminInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AdminPayload {
  id: number;
  username: string;
  email: string;
}

export class AdminService {
  /**
   * Create a new admin user
   */
  static async createAdmin(input: CreateAdminInput): Promise<{ id: number; username: string; email: string }> {
    try {
      // Check if username or email already exists
      const existingAdmin = await prisma.admin.findFirst({
        where: {
          OR: [
            { username: input.username },
            { email: input.email },
          ],
        },
      });

      if (existingAdmin) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(input.password, saltRounds);

      // Create admin
      const admin = await prisma.admin.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });

      logger.info('Admin user created', { username: admin.username, email: admin.email });

      return admin;
    } catch (error) {
      logger.error('Error creating admin user', { error, username: input.username });
      throw error;
    }
  }

  /**
   * Authenticate admin user and generate JWT token
   */
  static async login(input: LoginInput): Promise<{ token: string; admin: AdminPayload }> {
    try {
      // Find admin by username
      const admin = await prisma.admin.findUnique({
        where: { username: input.username },
      });

      if (!admin) {
        throw new Error('Invalid username or password');
      }

      // Check if admin is active
      if (!admin.isActive) {
        throw new Error('Admin account is inactive');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(input.password, admin.passwordHash);

      if (!isPasswordValid) {
        throw new Error('Invalid username or password');
      }

      // Update last login
      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLogin: new Date() },
      });

      // Generate JWT token
      const payload: AdminPayload = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      };

      // Ensure JWT secret is set
      const jwtSecret = config.jwtSecret;
      if (!jwtSecret || jwtSecret.trim() === '') {
        throw new Error('JWT_SECRET is not configured');
      }

      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      } as SignOptions);

      logger.info('Admin login successful', { username: admin.username });

      return {
        token,
        admin: payload,
      };
    } catch (error) {
      logger.error('Admin login failed', { error, username: input.username });
      throw error;
    }
  }

  /**
   * Verify JWT token and return admin payload
   */
  static async verifyToken(token: string): Promise<AdminPayload> {
    try {
      // Ensure JWT secret is set
      const jwtSecret = config.jwtSecret;
      if (!jwtSecret || jwtSecret.trim() === '') {
        throw new Error('JWT_SECRET is not configured');
      }

      const decoded = jwt.verify(token, jwtSecret) as AdminPayload;

      // Verify admin still exists and is active
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
        },
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      if (!admin.isActive) {
        throw new Error('Admin account is inactive');
      }

      return {
        id: admin.id,
        username: admin.username,
        email: admin.email,
      };
    } catch (error) {
      logger.error('Token verification failed', { error });
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get admin by ID
   */
  static async getAdminById(id: number): Promise<{ id: number; username: string; email: string; isActive: boolean; lastLogin: Date | null } | null> {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      });

      return admin;
    } catch (error) {
      logger.error('Error fetching admin', { error, id });
      throw error;
    }
  }

  /**
   * Verify admin password
   */
  static async verifyPassword(adminId: number, password: string): Promise<boolean> {
    try {
      const admin = await prisma.admin.findUnique({
        where: { id: adminId },
        select: { passwordHash: true },
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      return await bcrypt.compare(password, admin.passwordHash);
    } catch (error) {
      logger.error('Error verifying admin password', { error, adminId });
      throw error;
    }
  }

  /**
   * Update admin password
   */
  static async updatePassword(adminId: number, currentPassword: string, newPassword: string): Promise<void> {
    try {
      // Verify current password
      const isPasswordValid = await this.verifyPassword(adminId, currentPassword);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      await prisma.admin.update({
        where: { id: adminId },
        data: { passwordHash },
      });

      logger.info('Admin password updated', { adminId });
    } catch (error) {
      logger.error('Error updating admin password', { error, adminId });
      throw error;
    }
  }

  /**
   * Update admin profile (username and email)
   */
  static async updateProfile(
    adminId: number,
    updates: { username?: string; email?: string }
  ): Promise<{ id: number; username: string; email: string }> {
    try {
      // Check if username or email already exists (excluding current admin)
      if (updates.username || updates.email) {
        const orConditions = [];
        if (updates.username) {
          orConditions.push({ username: updates.username });
        }
        if (updates.email) {
          orConditions.push({ email: updates.email });
        }

        if (orConditions.length > 0) {
          const existingAdmin = await prisma.admin.findFirst({
            where: {
              AND: [{ id: { not: adminId } }, { OR: orConditions }],
            },
          });

          if (existingAdmin) {
            if (existingAdmin.username === updates.username) {
              throw new Error('Username already exists');
            }
            if (existingAdmin.email === updates.email) {
              throw new Error('Email already exists');
            }
          }
        }
      }

      // Update admin
      const admin = await prisma.admin.update({
        where: { id: adminId },
        data: {
          ...(updates.username && { username: updates.username }),
          ...(updates.email && { email: updates.email }),
        },
        select: {
          id: true,
          username: true,
          email: true,
        },
      });

      logger.info('Admin profile updated', { adminId, updates });
      return admin;
    } catch (error) {
      logger.error('Error updating admin profile', { error, adminId, updates });
      throw error;
    }
  }
}

