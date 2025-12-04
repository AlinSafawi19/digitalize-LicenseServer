import crypto from 'crypto';
import prisma from '../config/database';

/**
 * License Key Generator Service
 * 
 * Generates license keys in the format: XXXX-XXXX-XXXX-XXXX
 * Each group contains 4 alphanumeric characters (A-Z, 0-9)
 * Total length: 19 characters (16 alphanumeric + 3 dashes)
 */
export class LicenseKeyGeneratorService {
  /**
   * Generates a unique license key
   * Format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters in 4 groups)
   * 
   * @returns Promise<string> A unique license key
   */
  static async generateLicenseKey(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const key = this.generateKey();
      
      // Check uniqueness in database
      const exists = await this.checkKeyExists(key);
      if (!exists) {
        return key;
      }
      
      attempts++;
    }

    throw new Error('Failed to generate unique license key after multiple attempts');
  }

  /**
   * Generates a single license key (without uniqueness check)
   * Format: XXXX-XXXX-XXXX-XXXX-XXXX (16 data chars + 4 checksum chars)
   * @returns string A license key with checksum
   */
  static generateKey(): string {
    // Generate 16 random bytes
    const randomBytes = crypto.randomBytes(16);
    
    // Convert to base36 (0-9, a-z) manually
    // Read bytes as BigInt and convert to base36
    let num = BigInt('0x' + randomBytes.toString('hex'));
    const base36Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let encoded = '';
    
    while (num > 0 && encoded.length < 16) {
      encoded = base36Chars[Number(num % 36n)] + encoded;
      num = num / 36n;
    }
    
    // Pad to 16 characters if needed
    while (encoded.length < 16) {
      encoded = '0' + encoded;
    }
    
    // Take first 16 characters
    const key = encoded.substring(0, 16);
    
    // Format: XXXX-XXXX-XXXX-XXXX
    const formatted = key.match(/.{1,4}/g)?.join('-') || key;
    
    // Calculate and add checksum
    const checksum = this.calculateChecksum(key);
    
    return `${formatted}-${checksum}`;
  }

  /**
   * Calculates checksum for a license key
   * @param key The 16-character key to calculate checksum for
   * @returns string 4-character checksum
   */
  static calculateChecksum(key: string): string {
    let sum = 0;
    for (const char of key) {
      sum += char.charCodeAt(0);
    }
    return (sum % 10000).toString(36).toUpperCase().padStart(4, '0');
  }

  /**
   * Validates the checksum of a license key
   * @param key The full license key with checksum
   * @returns boolean True if checksum is valid
   */
  static validateChecksum(key: string): boolean {
    // Remove dashes to get the raw key
    const parts = key.split('-');
    if (parts.length !== 5) {
      return false;
    }

    // Extract data (first 4 groups = 16 chars) and checksum (last group = 4 chars)
    const dataKey = parts.slice(0, 4).join('');
    const providedChecksum = parts[4];

    // Calculate expected checksum
    const expectedChecksum = this.calculateChecksum(dataKey);

    return providedChecksum === expectedChecksum;
  }

  /**
   * Validates the format of a license key
   * Format: XXXX-XXXX-XXXX-XXXX-XXXX (5 groups: 16 data + 4 checksum)
   * @param key The license key to validate
   * @returns boolean True if format is valid
   */
  static validateLicenseKeyFormat(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Format: XXXX-XXXX-XXXX-XXXX-XXXX (5 groups of 4 alphanumeric characters)
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return pattern.test(key);
  }

  /**
   * Validates both format and checksum of a license key
   * @param key The license key to validate
   * @returns boolean True if format and checksum are valid
   */
  static validateLicenseKeyFormatAndChecksum(key: string): boolean {
    if (!this.validateLicenseKeyFormat(key)) {
      return false;
    }
    return this.validateChecksum(key);
  }

  /**
   * Validates a license key (format, checksum, and database existence)
   * @param key The license key to validate
   * @param checkDatabase Whether to check if key exists in database (default: true)
   * @returns Promise<boolean> True if key is valid
   */
  static async validateLicenseKey(key: string, checkDatabase: boolean = true): Promise<boolean> {
    // Normalize the key first
    const normalizedKey = this.normalizeLicenseKey(key);

    // Check format
    if (!this.validateLicenseKeyFormat(normalizedKey)) {
      return false;
    }

    // Check checksum
    if (!this.validateChecksum(normalizedKey)) {
      return false;
    }

    // Check database existence if requested
    if (checkDatabase) {
      return await this.checkKeyExists(normalizedKey);
    }

    return true;
  }

  /**
   * Checks if a license key already exists in the database
   * @param key The license key to check
   * @returns Promise<boolean> True if key exists
   */
  private static async checkKeyExists(key: string): Promise<boolean> {
    try {
      const license = await prisma.license.findUnique({
        where: { licenseKey: key },
        select: { id: true },
      });
      return license !== null;
    } catch (error) {
      // If database error, assume key doesn't exist to allow generation
      console.error('Error checking license key existence:', error);
      return false;
    }
  }

  /**
   * Normalizes a license key by removing spaces and converting to uppercase
   * @param key The license key to normalize
   * @returns string Normalized license key
   */
  static normalizeLicenseKey(key: string): string {
    if (!key || typeof key !== 'string') {
      return '';
    }
    return key.replace(/\s+/g, '').toUpperCase();
  }
}

