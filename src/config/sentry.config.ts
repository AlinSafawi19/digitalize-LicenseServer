/**
 * Sentry Error Tracking Configuration
 * 
 * Note: Sentry is initialized in instrument.ts which must be imported
 * at the top of server.ts. This file provides helper functions for
 * using Sentry throughout the application.
 */

import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

/**
 * Check if Sentry is initialized
 */
function isSentryInitialized(): boolean {
  try {
    // Check if Sentry is available and has a client
    return typeof Sentry !== 'undefined' && Sentry.getClient() !== undefined;
  } catch {
    return false;
  }
}

/**
 * Capture exception to Sentry
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!isSentryInitialized()) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          // Filter sensitive data
          if (!['password', 'token', 'apiKey', 'secret', 'jwtSecret'].includes(key.toLowerCase())) {
            const value = context[key];
            // setContext expects a Record<string, unknown> or null
            // If value is already an object, use it; otherwise wrap it
            const contextValue = 
              typeof value === 'object' && value !== null && !Array.isArray(value)
                ? (value as Record<string, unknown>)
                : { value };
            scope.setContext(key, contextValue);
          }
        });
      }
      Sentry.captureException(error);
    });
  } catch (err) {
    // Silently fail if Sentry is not available
    logger.debug('Failed to capture exception to Sentry', { error: err });
  }
}

/**
 * Capture message to Sentry
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!isSentryInitialized()) {
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (err) {
    // Silently fail if Sentry is not available
    logger.debug('Failed to capture message to Sentry', { error: err });
  }
}

/**
 * Set user context for Sentry
 */
export function setSentryUser(user: { id: number | string; username?: string; phone?: string }): void {
  if (!isSentryInitialized()) {
    return;
  }

  try {
    Sentry.setUser({
      id: user.id.toString(),
      username: user.username,
      phone: user.phone,
    });
  } catch (err) {
    // Silently fail if Sentry is not available
    logger.debug('Failed to set Sentry user', { error: err });
  }
}

/**
 * Start a custom span for performance monitoring
 * Use this to instrument meaningful operations like API calls, database queries, etc.
 * 
 * @example
 * await startSpan({ op: 'http.client', name: 'GET /api/users' }, async () => {
 *   return await fetch('/api/users');
 * });
 */
export function startSpan<T>(
  options: { op: string; name: string },
  callback: (span: Sentry.Span) => T | Promise<T>
): T | Promise<T> {
  if (!isSentryInitialized()) {
    // If Sentry is not initialized, just execute the callback
    return callback({} as Sentry.Span);
  }

  return Sentry.startSpan(options, callback);
}

/**
 * Get Sentry logger for structured logging
 * Use this instead of console.log for better log tracking in Sentry
 */
export function getSentryLogger() {
  if (!isSentryInitialized()) {
    // Return a no-op logger if Sentry is not initialized
    return {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      fmt: (strings: TemplateStringsArray, ...values: unknown[]) => 
        strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
    };
  }

  return Sentry.logger;
}

