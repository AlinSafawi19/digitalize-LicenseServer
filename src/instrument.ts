/**
 * Sentry Instrumentation
 * This file must be imported at the very top of your application entry point
 * to ensure Sentry is initialized before any other code runs.
 */

import * as Sentry from '@sentry/node';
import { expressIntegration } from '@sentry/node';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const sentryDsn = process.env.SENTRY_DSN || 'https://94eebf58e8554ee4197d717feaa37bd3@o4510371217145856.ingest.us.sentry.io/4510371229466624';
const nodeEnv = process.env.NODE_ENV || 'development';

// Initialize Sentry
Sentry.init({
  dsn: sentryDsn,
  environment: nodeEnv,
  
  // Performance monitoring
  tracesSampleRate: nodeEnv === 'production' ? 0.1 : 1.0, // 10% in production, 100% in dev
  
  // Send default PII data (IP address, etc.)
  sendDefaultPii: true,
  
  // Enable structured logging
  enableLogs: true,
  
  // Integrations
  integrations: [
    // Express integration for automatic request/error tracking
    expressIntegration(),
    // Send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
  ],
  
  // Filter out sensitive information
  beforeSend(event, _hint) {
    // Remove sensitive headers
    if (event.request && event.request.headers) {
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key'];
      sensitiveHeaders.forEach(header => {
        if (event.request && event.request.headers) {
          delete event.request.headers[header];
        }
      });
    }
    
    // Remove sensitive query parameters
    if (event.request && event.request.query_string) {
      const query = new URLSearchParams(event.request.query_string);
      const sensitiveParams = ['token', 'api_key', 'password', 'secret'];
      sensitiveParams.forEach(param => {
        query.delete(param);
      });
      if (event.request) {
        event.request.query_string = query.toString();
      }
    }
    
    // Remove sensitive data from extra context
    if (event.extra) {
      const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'jwtSecret'];
      sensitiveKeys.forEach(key => {
        delete event.extra![key];
      });
    }
    
    return event;
  },
});

