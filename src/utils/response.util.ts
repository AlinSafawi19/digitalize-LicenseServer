import { Response } from 'express';

/**
 * Response utility functions for consistent API responses
 */
export class ResponseUtil {
  /**
   * Send a success response
   */
  static success(res: Response, data: unknown, message?: string, statusCode: number = 200): void {
    res.status(statusCode).json({
      success: true,
      message: message || 'Operation successful',
      data,
    });
  }

  /**
   * Send an error response
   */
  static error(
    res: Response,
    message: string,
    statusCode: number = 400,
    errors?: unknown,
  ): void {
    const response: { success: boolean; message: string; errors?: unknown } = {
      success: false,
      message,
    };
    
    if (errors !== undefined) {
      response.errors = errors;
    }
    
    res.status(statusCode).json(response);
  }

  /**
   * Send a not found response
   */
  static notFound(res: Response, message: string = 'Resource not found'): void {
    res.status(404).json({
      success: false,
      message,
    });
  }

  /**
   * Send an unauthorized response
   */
  static unauthorized(res: Response, message: string = 'Unauthorized'): void {
    res.status(401).json({
      success: false,
      message,
    });
  }

  /**
   * Send a forbidden response
   */
  static forbidden(res: Response, message: string = 'Forbidden'): void {
    res.status(403).json({
      success: false,
      message,
    });
  }

  /**
   * Send a validation error response
   */
  static validationError(res: Response, errors: unknown, message: string = 'Validation failed'): void {
    res.status(422).json({
      success: false,
      message,
      errors,
    });
  }
}

