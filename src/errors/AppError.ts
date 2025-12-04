/**
 * Base Application Error Class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string,
    details?: unknown
  ) {
    super(message);
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Validation Error (400)
 * Used for input validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', errors?: unknown) {
    super(message, 400, true, 'VALIDATION_ERROR', errors);
  }
}

/**
 * Unauthorized Error (401)
 * Used when authentication is required or failed
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden Error (403)
 * Used when user is authenticated but lacks permissions
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true, 'FORBIDDEN');
  }
}

/**
 * Not Found Error (404)
 * Used when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', resource?: string) {
    super(message, 404, true, 'NOT_FOUND', { resource });
  }
}

/**
 * Conflict Error (409)
 * Used when there's a conflict with the current state
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 409, true, 'CONFLICT', details);
  }
}

/**
 * Too Many Requests Error (429)
 * Used for rate limiting
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, true, 'TOO_MANY_REQUESTS', { retryAfter });
  }
}

/**
 * Internal Server Error (500)
 * Used for unexpected server errors
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', originalError?: Error) {
    super(message, 500, false, 'INTERNAL_SERVER_ERROR', {
      originalError: originalError?.message,
    });
  }
}

/**
 * Database Error
 * Used for database-related errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', originalError?: Error) {
    super(message, 500, false, 'DATABASE_ERROR', {
      originalError: originalError?.message,
    });
  }
}

/**
 * Service Unavailable Error (503)
 * Used when a service is temporarily unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', retryAfter?: number) {
    super(message, 503, true, 'SERVICE_UNAVAILABLE', { retryAfter });
  }
}

