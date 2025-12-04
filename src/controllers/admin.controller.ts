import { Request, Response } from 'express';
import { AdminService, LoginInput } from '../services/admin.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Admin Controller
 * Handles HTTP requests for admin operations
 */
export class AdminController {
  /**
   * Admin login
   * POST /api/admin/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body as LoginInput;

      // Validate input
      if (!username || !password) {
        ResponseUtil.error(res, 'Username and password are required', 400);
        return;
      }

      // Authenticate and get token
      const result = await AdminService.login({ username, password });

      logger.info('Admin login successful', { username });

      ResponseUtil.success(
        res,
        {
          token: result.token,
          admin: result.admin,
        },
        'Login successful',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      logger.error('Admin login failed', { error: errorMessage, username: req.body.username });
      const statusCode = errorMessage.includes('Invalid') || errorMessage.includes('inactive') ? 401 : 500;
      ResponseUtil.error(res, errorMessage, statusCode);
    }
  }

  /**
   * Get current admin profile
   * GET /api/admin/me
   * Requires authentication
   */
  static async getCurrentAdmin(req: Request, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        ResponseUtil.unauthorized(res, 'Unauthorized');
        return;
      }

      const admin = await AdminService.getAdminById(req.admin.id);

      if (!admin) {
        ResponseUtil.notFound(res, 'Admin not found');
        return;
      }

      ResponseUtil.success(
        res,
        {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          isActive: admin.isActive,
          lastLogin: admin.lastLogin,
        },
        'Admin profile retrieved successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch admin profile';
      logger.error('Error fetching admin profile', { error: errorMessage, adminId: req.admin?.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Admin logout
   * POST /api/admin/logout
   * Requires authentication
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        ResponseUtil.unauthorized(res, 'Unauthorized');
        return;
      }

      logger.info('Admin logout successful', {
        adminId: req.admin.id,
        username: req.admin.username,
      });

      ResponseUtil.success(res, null, 'Logout successful', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      logger.error('Error during logout', { error: errorMessage, adminId: req.admin?.id });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Update admin profile
   * PUT /api/admin/profile
   * Requires authentication
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        ResponseUtil.unauthorized(res, 'Unauthorized');
        return;
      }

      const { username, email } = req.body;

      // Validate that at least one field is provided
      if (!username && !email) {
        ResponseUtil.error(res, 'At least one field (username or email) must be provided', 400);
        return;
      }

      const updates: { username?: string; email?: string } = {};
      if (username) updates.username = username;
      if (email) updates.email = email;

      const updatedAdmin = await AdminService.updateProfile(req.admin.id, updates);

      logger.info('Admin profile updated', {
        adminId: req.admin.id,
        updates,
      });

      ResponseUtil.success(
        res,
        {
          id: updatedAdmin.id,
          username: updatedAdmin.username,
          email: updatedAdmin.email,
        },
        'Profile updated successfully',
        200
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      logger.error('Error updating admin profile', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      const statusCode =
        errorMessage.includes('already exists') || errorMessage.includes('required') ? 400 : 500;
      ResponseUtil.error(res, errorMessage, statusCode);
    }
  }

  /**
   * Change admin password
   * PUT /api/admin/password
   * Requires authentication
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.admin) {
        ResponseUtil.unauthorized(res, 'Unauthorized');
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Validate input
      if (!currentPassword || !newPassword) {
        ResponseUtil.error(res, 'Current password and new password are required', 400);
        return;
      }

      if (newPassword.length < 6) {
        ResponseUtil.error(res, 'New password must be at least 6 characters long', 400);
        return;
      }

      await AdminService.updatePassword(req.admin.id, currentPassword, newPassword);

      logger.info('Admin password changed', {
        adminId: req.admin.id,
        username: req.admin.username,
      });

      ResponseUtil.success(res, null, 'Password changed successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      logger.error('Error changing admin password', {
        error: errorMessage,
        adminId: req.admin?.id,
      });
      const statusCode = errorMessage.includes('incorrect') ? 401 : 500;
      ResponseUtil.error(res, errorMessage, statusCode);
    }
  }
}

