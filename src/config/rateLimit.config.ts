import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response.util';

/**
 * Rate Limiting Configuration
 * Different rate limits for different endpoint types
 */

/**
 * Standard rate limit handler
 */
const standardHandler = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
  });

  ResponseUtil.error(
    res,
    'Too many requests from this IP, please try again later.',
    429
  );
};

/**
 * General API rate limiter
 * 1000 requests per hour per IP
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: standardHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  },
});

/**
 * Activation endpoint rate limiter
 * 20 requests per hour per IP (strict limit to prevent abuse)
 */
export const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 activation attempts per hour
  message: 'Too many activation attempts from this IP. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Activation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      body: { licenseKey: req.body?.licenseKey ? '***' : undefined },
    });

    ResponseUtil.error(
      res,
      'Too many activation attempts from this IP. Please try again in an hour.',
      429
    );
  },
  skipSuccessfulRequests: false, // Count all requests, even successful ones
});

/**
 * Validation endpoint rate limiter
 * 1000 requests per hour per IP
 */
export const validationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 validation requests per hour
  message: 'Too many validation requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Validation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    ResponseUtil.error(
      res,
      'Too many validation requests from this IP. Please try again later.',
      429
    );
  },
});

/**
 * Admin endpoints rate limiter
 * 2000 requests per hour per admin (identified by JWT token)
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2000, // Limit each admin to 2000 requests per hour
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use admin ID from JWT token if available, otherwise fall back to IP
    if (req.admin?.id) {
      return `admin:${req.admin.id}`;
    }
    // Use ipKeyGenerator helper to properly handle IPv6 addresses
    return ipKeyGenerator(req.ip || 'unknown');
  },
  handler: (req: Request, res: Response) => {
    logger.warn('Admin rate limit exceeded', {
      adminId: req.admin?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    ResponseUtil.error(
      res,
      'Too many requests. Please try again later.',
      429
    );
  },
  skip: (req: Request) => {
    // Skip rate limiting for admin login (but it has its own limiter)
    return req.path === '/api/admin/login';
  },
});

/**
 * Admin login rate limiter
 * 20 login attempts per 15 minutes per IP (to prevent brute force)
 */
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Admin login rate limit exceeded', {
      ip: req.ip,
      username: req.body?.username,
      path: req.path,
    });

    ResponseUtil.error(
      res,
      'Too many login attempts. Please try again in 15 minutes.',
      429
    );
  },
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * License generation rate limiter (admin only)
 * 200 license generations per hour per admin
 */
export const licenseGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // Limit each admin to 200 license generations per hour
  message: 'Too many license generation requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.admin?.id) {
      return `admin:${req.admin.id}`;
    }
    // Use ipKeyGenerator helper to properly handle IPv6 addresses
    return ipKeyGenerator(req.ip || 'unknown');
  },
  handler: (req: Request, res: Response) => {
    logger.warn('License generation rate limit exceeded', {
      adminId: req.admin?.id,
      ip: req.ip,
      path: req.path,
    });

    ResponseUtil.error(
      res,
      'Too many license generation requests. Please try again later.',
      429
    );
  },
});

