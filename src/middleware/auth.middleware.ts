import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Middleware to authenticate admin users via JWT token
 * 
 * This middleware:
 * - Extracts JWT token from Authorization header
 * - Verifies token validity and expiration
 * - Checks if admin account exists and is active
 * - Attaches admin information to request object
 * 
 * Usage:
 * router.get('/protected-route', authenticateAdmin, controller.method);
 */
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      logger.warn('Authentication attempt without Authorization header', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      ResponseUtil.unauthorized(res, 'Authentication required. Please provide a valid token.');
      return;
    }

    // Check if header starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication attempt with invalid Authorization header format', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      ResponseUtil.unauthorized(res, 'Invalid token format. Use: Authorization: Bearer <token>');
      return;
    }

    // Extract token
    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix and trim whitespace

    // Check if token exists
    if (!token) {
      logger.warn('Authentication attempt with empty token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      ResponseUtil.unauthorized(res, 'Token is required. Please provide a valid token.');
      return;
    }

    // Verify token and get admin
    // This will:
    // - Verify JWT signature and expiration
    // - Check if admin exists in database
    // - Check if admin account is active
    const admin = await AdminService.verifyToken(token);

    // Attach admin to request object for use in controllers
    req.admin = admin;

    logger.debug('Admin authenticated successfully', {
      adminId: admin.id,
      username: admin.username,
      path: req.path,
    });

    next();
  } catch (error) {
    // Handle different types of authentication errors
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    logger.error('Admin authentication failed', {
      error: errorMessage,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Determine appropriate error message and status code
    if (errorMessage.includes('expired')) {
      ResponseUtil.unauthorized(res, 'Token has expired. Please login again.');
    } else if (errorMessage.includes('not found') || errorMessage.includes('inactive')) {
      ResponseUtil.unauthorized(res, 'Admin account is not available or has been deactivated.');
    } else if (errorMessage.includes('not configured')) {
      ResponseUtil.error(res, 'Server configuration error. Please contact administrator.', 500);
    } else {
      ResponseUtil.unauthorized(res, 'Invalid or expired token. Please login again.');
    }
  }
};

