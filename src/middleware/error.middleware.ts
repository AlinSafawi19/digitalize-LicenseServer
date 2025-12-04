import { Request, Response, NextFunction } from 'express';
import '../types/express'; // Ensure type augmentations are loaded
import { logger } from '../utils/logger';
import { AppError } from '../errors/AppError';
import { config } from '../config/config';
import { captureException } from '../config/sentry.config';

/**
 * Sanitize error message to hide sensitive information
 */
function sanitizeErrorMessage(error: Error | AppError, isProduction: boolean): string {
  // In production, hide sensitive details
  if (isProduction) {
    // Hide database connection strings, API keys, etc.
    let message = error.message;
    
    // Replace common sensitive patterns
    message = message.replace(/password[=:]\s*\S+/gi, 'password=***');
    message = message.replace(/api[_-]?key[=:]\s*\S+/gi, 'api_key=***');
    message = message.replace(/token[=:]\s*\S+/gi, 'token=***');
    message = message.replace(/secret[=:]\s*\S+/gi, 'secret=***');
    message = message.replace(/connection[=:]\s*postgresql:\/\/[^\s]+/gi, 'connection=***');
    
    // For non-operational errors in production, return generic message
    if (error instanceof AppError && !error.isOperational) {
      return 'An unexpected error occurred. Please try again later.';
    }
    
    return message;
  }
  
  // In development, show full error message
  return error.message;
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error | AppError, isProduction: boolean): string {
  // If it's an AppError with a user-friendly message, use it
  if (error instanceof AppError) {
    return sanitizeErrorMessage(error, isProduction);
  }

  // Handle common error types
  if (error.name === 'ValidationError' || error.name === 'PrismaClientValidationError') {
    return 'Invalid input data. Please check your request and try again.';
  }

  if (error.name === 'JsonWebTokenError') {
    return 'Invalid authentication token. Please login again.';
  }

  if (error.name === 'TokenExpiredError') {
    return 'Your session has expired. Please login again.';
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    // Handle specific Prisma errors
    const prismaError = error as Error & { code?: string };
    if (prismaError.code === 'P2002') {
      return 'A record with this information already exists.';
    }
    if (prismaError.code === 'P2025') {
      return 'The requested resource was not found.';
    }
  }

  // Default user-friendly message
  return sanitizeErrorMessage(error, isProduction);
}

/**
 * Global Error Handler Middleware
 * Handles all errors in the application
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const isProduction = config.nodeEnv === 'production';
  
  // Determine status code
  let statusCode = 500;
  let errorCode: string | undefined;
  let errorDetails: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    errorDetails = err.details;
  } else {
    // Handle non-AppError errors
    const errorWithStatusCode = err as Error & { statusCode?: number; status?: number };
    if (errorWithStatusCode.statusCode) {
      statusCode = errorWithStatusCode.statusCode;
    } else if (errorWithStatusCode.status) {
      statusCode = errorWithStatusCode.status;
    }
  }

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(err, isProduction);
  const technicalMessage = err.message;

  // Prepare error log data
  const errorLogData: {
    error: {
      name: string;
      message: string;
      code?: string;
      statusCode: number;
      isOperational: boolean;
      stack?: string;
      details?: unknown;
    };
    request: {
      method: string;
      path: string;
      query: unknown;
      params: unknown;
      ip?: string;
      userAgent?: string;
    };
    user?: {
      id: number;
      username: string;
    };
  } = {
    error: {
      name: err.name,
      message: technicalMessage,
      code: errorCode,
      statusCode,
      isOperational: err instanceof AppError ? err.isOperational : false,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    user: req.admin ? {
      id: req.admin.id,
      username: req.admin.username,
    } : undefined,
  };

  // Add stack trace in development or for non-operational errors
  if (!isProduction || (err instanceof AppError && !err.isOperational)) {
    errorLogData.error.stack = err.stack;
  }

  // Add details if available
  if (errorDetails) {
    errorLogData.error.details = errorDetails;
  }

  // Log error with appropriate level
  if (statusCode >= 500) {
    logger.error('Server error occurred', errorLogData);
    // Send to Sentry for server errors
    captureException(err, errorLogData);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', errorLogData);
  } else {
    logger.info('Error occurred', errorLogData);
  }

  // Prepare response
  const response: {
    success: boolean;
    message: string;
    code?: string;
    details?: unknown;
    stack?: string;
    technicalMessage?: string;
  } = {
    success: false,
    message: userMessage,
  };

  // Add error code if available
  if (errorCode) {
    response.code = errorCode;
  }

  // Add details in development or for operational errors
  if (!isProduction || (err instanceof AppError && err.isOperational && errorDetails)) {
    if (errorDetails) {
      response.details = errorDetails;
    }
  }

  // Add stack trace only in development
  if (!isProduction) {
    response.stack = err.stack;
    response.technicalMessage = technicalMessage;
  }

  // Send error response
  res.status(statusCode).json(response);
};

/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
};

