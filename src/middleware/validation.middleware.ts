import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body } from 'express-validator';
import { ResponseUtil } from '../utils/response.util';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    ResponseUtil.validationError(res, errors.array());
    return;
  }
  next();
};

/**
 * Generic validation middleware that can be used with express-validator
 */
export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    ResponseUtil.validationError(res, errors.array());
    return;
  }
  next();
};

/**
 * Validates license key format
 */
export const validateLicenseKey = (): ValidationChain => {
  return body('licenseKey')
    .optional()
    .isString()
    .withMessage('License key must be a string')
    .matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    .withMessage('License key must be in format XXXX-XXXX-XXXX-XXXX-XXXX');
};

/**
 * Validates customer name
 */
export const validateCustomerName = (): ValidationChain => {
  return body('customerName')
    .optional()
    .isString()
    .withMessage('Customer name must be a string')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Customer name must be between 1 and 255 characters');
};

/**
 * Validates customer phone number
 */
export const validateCustomerPhone = (): ValidationChain => {
  return body('customerPhone')
    .optional()
    .isString()
    .withMessage('Customer phone must be a string')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Customer phone must be a valid phone number');
};

/**
 * Validates initial price
 */
export const validateInitialPrice = (): ValidationChain => {
  return body('initialPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Initial price must be a positive number');
};

/**
 * Validates location name
 */
export const validateLocationName = (): ValidationChain => {
  return body('locationName')
    .optional()
    .isString()
    .withMessage('Location name must be a string')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Location name must be between 1 and 255 characters');
};

/**
 * Validates location address
 */
export const validateLocationAddress = (): ValidationChain => {
  return body('locationAddress')
    .optional()
    .isString()
    .withMessage('Location address must be a string')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Location address must be between 1 and 500 characters');
};

/**
 * Validates hardware ID (required)
 */
export const validateHardwareId = (): ValidationChain => {
  return body('hardwareId')
    .notEmpty()
    .withMessage('Hardware ID is required')
    .isString()
    .withMessage('Hardware ID must be a string')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Hardware ID must be between 1 and 255 characters');
};

/**
 * Validates hardware ID (optional - for tracking purposes)
 */
export const validateHardwareIdOptional = (): ValidationChain => {
  return body('hardwareId')
    .optional()
    .isString()
    .withMessage('Hardware ID must be a string')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Hardware ID must be between 1 and 255 characters');
};

/**
 * Validates machine name
 */
export const validateMachineName = (): ValidationChain => {
  return body('machineName')
    .optional()
    .isString()
    .withMessage('Machine name must be a string')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Machine name must be between 1 and 255 characters');
};

/**
 * Validates location object for activation
 */
export const validateLocation = (): ValidationChain => {
  return body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object')
    .custom((value) => {
      // If location is provided, both name and address should be provided
      if (value) {
        if (value.name && typeof value.name !== 'string') {
          throw new Error('Location name must be a string');
        }
        if (value.address && typeof value.address !== 'string') {
          throw new Error('Location address must be a string');
        }
      }
      return true;
    });
};

/**
 * Validates license key (required)
 */
export const validateLicenseKeyRequired = (): ValidationChain => {
  return body('licenseKey')
    .notEmpty()
    .withMessage('License key is required')
    .isString()
    .withMessage('License key must be a string')
    .trim()
    .matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i)
    .withMessage('License key must be in format XXXX-XXXX-XXXX-XXXX-XXXX');
};

/**
 * Validates current time (optional timestamp)
 */
export const validateCurrentTime = (): ValidationChain => {
  return body('currentTime')
    .optional()
    .isNumeric()
    .withMessage('Current time must be a number (timestamp)');
};
