import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../config/config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Log directory
const logDir = path.join(process.cwd(), 'logs');

// Create transports array
const transports: winston.transport[] = [];

// Error log with rotation (errors only)
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep error logs for 14 days
    level: 'error',
    format: logFormat,
  })
);

// Combined log with rotation (all levels)
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d', // Keep combined logs for 30 days
    format: logFormat,
  })
);

// License operations log with rotation (activations, validations, payments)
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'license-operations-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '90d', // Keep license operation logs for 90 days (important for audit)
    format: logFormat,
    level: 'info', // Only log info level and above
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (config.nodeEnv === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: {
    service: 'license-server',
    environment: config.nodeEnv,
  },
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// Add console transport in development
if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Helper function to log license operations
export const logLicenseOperation = (
  operation: 'activation' | 'validation' | 'payment' | 'generation' | 'revocation' | 'expiration',
  data: Record<string, unknown>
): void => {
  logger.info(`License ${operation}`, {
    operation,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Helper function to log API requests with response time
export const logApiRequest = (
  method: string,
  path: string,
  statusCode: number,
  responseTime: number,
  ip?: string,
  userAgent?: string,
  userId?: number
): void => {
  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger.log(logLevel, `${method} ${path}`, {
    method,
    path,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip,
    userAgent,
    userId,
    timestamp: new Date().toISOString(),
  });
};

