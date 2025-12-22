import { logger } from '../utils/logger';
import { config } from '../config/config';
import twilio from 'twilio';

export interface WhatsAppCredentials {
  username: string;
  password: string;
  licenseKey: string;
  locationName: string;
  locationAddress: string;
  customerName?: string | null;
}

export interface ExpirationWhatsAppData {
  customerName?: string | null;
  customerPhone: string;
  licenseKey: string;
  locationName: string | null;
  expirationDate: Date;
  daysRemaining: number;
  isFreeTrial: boolean;
}

export interface LicenseDetailsWhatsAppData {
  customerName?: string | null;
  customerPhone: string;
  licenseKey: string;
  locationName: string;
  locationAddress: string;
  isFreeTrial: boolean;
  expiresAt?: Date | null;
}

/**
 * WhatsApp Service
 * Handles sending WhatsApp messages via API
 */
export class WhatsAppService {
  /**
   * Send OTP for phone verification
   * Returns an object with success status and error details if failed
   */
  static async sendOTP(to: string, message: string): Promise<{ success: boolean; error?: { message: string; code?: number; status?: number; details?: unknown; moreInfo?: string } }> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping OTP send', { to });
        return { success: false, error: { message: 'WhatsApp service is not enabled' } };
      }

      const result = await this.sendWhatsAppMessage(to, message);
      
      if (result.success) {
        logger.info('OTP WhatsApp message sent successfully', {
          to,
        });
        return { success: true };
      } else {
        logger.warn('Failed to send OTP WhatsApp message', { to, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send OTP WhatsApp message', {
        to,
        error: errorMessage,
      });
      return { success: false, error: { message: errorMessage } };
    }
  }

  /**
   * Send activation credentials via WhatsApp
   */
  static async sendActivationCredentials(
    to: string,
    credentials: WhatsAppCredentials
  ): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping message send', { to });
        return false;
      }

      const message = this.getActivationMessage(credentials);
      
      const result = await this.sendWhatsAppMessage(to, message);
      
      if (result.success) {
        logger.info('Activation credentials WhatsApp message sent successfully', {
          to,
        });
        return true;
      } else {
        logger.warn('Failed to send activation credentials WhatsApp message', { to, error: result.error });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send activation credentials WhatsApp message', {
        to,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Get activation message template
   */
  private static getActivationMessage(credentials: WhatsAppCredentials): string {
    const customerName = credentials.customerName || 'Valued Customer';
    
    return `🎉 Welcome to DigitalizePOS!

Dear ${customerName},

Thank you for activating your DigitalizePOS license. Your login credentials have been generated and are ready to use.

📋 Your Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Username: ${credentials.username}
🔑 Password: ${credentials.password}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Important: Please save these credentials in a secure location. You will need them to log in to your DigitalizePOS system.

📄 License Information:
• License Key: ${credentials.licenseKey}
• Location: ${credentials.locationName}
• Address: ${credentials.locationAddress}

📝 Next Steps:
1. Open the DigitalizePOS application
2. Use the username and password above to log in
3. Change your password after first login (recommended)
4. Start setting up your store and products

If you have any questions or need assistance, please contact our support team.

This is an automated message from DigitalizePOS.`;
  }

  /**
   * Send license details via WhatsApp (sent after phone verification)
   */
  static async sendLicenseDetails(
    data: LicenseDetailsWhatsAppData
  ): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping license details message', { 
          to: data.customerPhone 
        });
        return false;
      }

      const message = this.getLicenseDetailsMessage(data);
      const result = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (result.success) {
        logger.info('License details WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
        });
        return true;
      } else {
        logger.warn('Failed to send license details WhatsApp message', {
          to: data.customerPhone,
          error: result.error,
        });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send license details WhatsApp message', {
        to: data.customerPhone,
        licenseKey: data.licenseKey,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Get license details message template
   */
  private static getLicenseDetailsMessage(data: LicenseDetailsWhatsAppData): string {
    const customerName = data.customerName || 'Valued Customer';
    const licenseType = data.isFreeTrial ? 'Free Trial License' : 'License';
    const expirationText = data.expiresAt 
      ? `\n📅 Expiration Date: ${data.expiresAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`
      : '';
    
    return `🎉 Your DigitalizePOS ${licenseType} Has Been Created!

Dear ${customerName},

Thank you for creating your DigitalizePOS ${licenseType.toLowerCase()}. Your license has been successfully generated and is ready to use.

📄 Your License Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 License Key: ${data.licenseKey}
📍 Location: ${data.locationName}
🏠 Address: ${data.locationAddress}${expirationText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Important: Please save your license key in a secure location. You will need it to activate DigitalizePOS.

📝 Next Steps:
1. Download DigitalizePOS from our website
2. Install the software on your Windows computer
3. Launch DigitalizePOS and enter your license key when prompted
4. An admin user account will be automatically created using your phone number

${data.isFreeTrial ? `\n💡 This is a free trial license. To continue using DigitalizePOS after the trial period, you can upgrade to a paid license.\n` : ''}

If you have any questions or need assistance, please contact our support team.

This is an automated message from DigitalizePOS.`;
  }

  /**
   * Send expiration warning message (sent when license is expiring soon)
   */
  static async sendExpirationWarning(
    data: ExpirationWhatsAppData
  ): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping expiration warning message', { 
          to: data.customerPhone 
        });
        return false;
      }

      const message = this.getExpirationWarningMessage(data);
      const result = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (result.success) {
        logger.info('Expiration warning WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
          daysRemaining: data.daysRemaining,
        });
        return true;
      } else {
        logger.warn('Failed to send expiration warning WhatsApp message', {
          to: data.customerPhone,
          error: result.error,
        });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send expiration warning WhatsApp message', {
        to: data.customerPhone,
        licenseKey: data.licenseKey,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Send expiration notification message (sent when license has expired)
   */
  static async sendExpirationNotification(
    data: ExpirationWhatsAppData
  ): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping expiration notification message', { 
          to: data.customerPhone 
        });
        return false;
      }

      const message = this.getExpirationNotificationMessage(data);
      const result = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (result.success) {
        logger.info('Expiration notification WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
        });
        return true;
      } else {
        logger.warn('Failed to send expiration notification WhatsApp message', {
          to: data.customerPhone,
          error: result.error,
        });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send expiration notification WhatsApp message', {
        to: data.customerPhone,
        licenseKey: data.licenseKey,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Get expiration warning message template
   */
  private static getExpirationWarningMessage(data: ExpirationWhatsAppData): string {
    const customerName = data.customerName || 'Valued Customer';
    const expirationDateStr = data.expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const isUrgent = data.daysRemaining <= 1;
    const licenseType = data.isFreeTrial ? 'free trial' : 'license';
    const actionText = data.isFreeTrial
      ? 'purchase a full license to continue using DigitalizePOS'
      : 'renew your license to continue using DigitalizePOS';
    
    const emoji = isUrgent ? '🚨' : '⚠️';
    
    return `${emoji} Your DigitalizePOS ${licenseType.charAt(0).toUpperCase() + licenseType.slice(1)} Expires Soon

Dear ${customerName},

This is a reminder that your DigitalizePOS ${licenseType} will expire in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'}.

📅 Expiration Date: ${expirationDateStr}

📄 License Information:
• License Key: ${data.licenseKey}
• Location: ${data.locationName || 'N/A'}

🔔 Action Required:
To avoid service interruption, please ${actionText} before the expiration date.

${data.isFreeTrial ? `💰 Pricing:
• Initial License: $350
• Annual Subscription: $50/year
• Additional Users: $25/user
` : ''}

If you have any questions or need assistance, please contact our support team.

This is an automated message from DigitalizePOS.`;
  }

  /**
   * Get expiration notification message template
   */
  private static getExpirationNotificationMessage(data: ExpirationWhatsAppData): string {
    const customerName = data.customerName || 'Valued Customer';
    const expirationDateStr = data.expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const licenseType = data.isFreeTrial ? 'free trial' : 'license';
    const actionText = data.isFreeTrial
      ? 'purchase a full license to continue using DigitalizePOS'
      : 'renew your license to continue using DigitalizePOS';

    return `🚨 Your DigitalizePOS ${licenseType.charAt(0).toUpperCase() + licenseType.slice(1)} Has Expired

Dear ${customerName},

Your DigitalizePOS ${licenseType} expired on ${expirationDateStr}.

Your access to DigitalizePOS has been suspended. To restore access, please ${actionText} immediately.

📅 Expiration Date: ${expirationDateStr}

📄 License Information:
• License Key: ${data.licenseKey}
• Location: ${data.locationName || 'N/A'}

🔔 Restore Access:
To restore access to DigitalizePOS, please ${actionText} as soon as possible.

${data.isFreeTrial ? `💰 Pricing:
• Initial License: $350
• Annual Subscription: $50/year
• Additional Users: $25/user
` : ''}

If you have any questions or need assistance, please contact our support team.

This is an automated message from DigitalizePOS.`;
  }

  /**
   * Send WhatsApp message via API
   * Supports Twilio and generic HTTP API providers
   * Returns an object with success status and error details if failed
   */
  private static async sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: { message: string; code?: number; status?: number; details?: unknown; moreInfo?: string } }> {
    try {
      // Format phone number (remove any non-digit characters except +)
      const phoneNumber = this.formatPhoneNumber(to);
      
      // Validate phone number (E.164 format: + followed by at least 8 digits)
      if (!phoneNumber || !phoneNumber.startsWith('+') || phoneNumber.length < 9) {
        const errorMsg = 'Invalid phone number format (must be E.164: +[country code][number])';
        logger.error(errorMsg, { 
          to, 
          phoneNumber,
          expectedFormat: 'E.164 (e.g., +9611234567 or +1234567890)'
        });
        return { 
          success: false, 
          error: { 
            message: errorMsg,
            details: { original: to, formatted: phoneNumber, expectedFormat: 'E.164 (e.g., +9611234567 or +1234567890)' }
          } 
        };
      }

      // Check if Twilio credentials are configured
      if (config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber) {
        return await this.sendViaTwilio(phoneNumber, message);
      }

      // No provider configured
      const errorMsg = 'No WhatsApp provider configured. Please configure either Twilio or custom API settings.';
      logger.error(errorMsg, {
        hasTwilio: !!(config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber)
      });
      return { 
        success: false, 
        error: { 
          message: errorMsg,
          details: {
            hasTwilio: !!(config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber)
          }
        } 
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending WhatsApp message', {
        to,
        error: errorMessage,
      });
      return { success: false, error: { message: errorMessage } };
    }
  }

  /**
   * Send WhatsApp message via Twilio
   * Returns an object with success status and error details if failed
   */
  private static async sendViaTwilio(to: string, message: string): Promise<{ success: boolean; error?: { message: string; code?: number; status?: number; details?: unknown; moreInfo?: string } }> {
    try {
      if (!config.whatsappAccountSid || !config.whatsappAuthToken || !config.whatsappFromNumber) {
        const errorMsg = 'Twilio credentials incomplete';
        logger.error(errorMsg, {
          hasAccountSid: !!config.whatsappAccountSid,
          hasAuthToken: !!config.whatsappAuthToken,
          hasFromNumber: !!config.whatsappFromNumber,
        });
        return { 
          success: false, 
          error: { 
            message: errorMsg,
            details: {
              hasAccountSid: !!config.whatsappAccountSid,
              hasAuthToken: !!config.whatsappAuthToken,
              hasFromNumber: !!config.whatsappFromNumber,
            }
          } 
        };
      }

      const client = twilio(config.whatsappAccountSid, config.whatsappAuthToken);
      
      // Format phone numbers for Twilio WhatsApp
      // Ensure FROM number is in E.164 format before adding whatsapp: prefix
      const fromNumberFormatted = config.whatsappFromNumber.startsWith('whatsapp:')
        ? config.whatsappFromNumber.replace('whatsapp:', '')
        : config.whatsappFromNumber;
      const fromNumberE164 = this.formatPhoneNumber(fromNumberFormatted);
      const fromNumber = `whatsapp:${fromNumberE164}`;
      
      // Ensure TO number is in E.164 format before adding whatsapp: prefix
      const toNumberFormatted = to.startsWith('whatsapp:')
        ? to.replace('whatsapp:', '')
        : to;
      const toNumberE164 = this.formatPhoneNumber(toNumberFormatted);
      
      // Validate E.164 format (must start with + and have at least 8 digits after +)
      if (!toNumberE164.startsWith('+') || toNumberE164.length < 9) {
        const errorMsg = 'Invalid phone number format for Twilio WhatsApp (must be E.164)';
        logger.error(errorMsg, {
          original: to,
          formatted: toNumberE164,
        });
        return { 
          success: false, 
          error: { 
            message: errorMsg,
            details: { original: to, formatted: toNumberE164 }
          } 
        };
      }
      
      const toNumber = `whatsapp:${toNumberE164}`;

      logger.debug('Sending WhatsApp message via Twilio', {
        to: toNumber,
        from: fromNumber,
        messageLength: message.length,
      });

      const result = await client.messages.create({
        from: fromNumber,
        to: toNumber,
        body: message,
      });

      if (result.sid) {
        logger.info('WhatsApp message sent successfully via Twilio', {
          to: toNumber,
          messageSid: result.sid,
          status: result.status,
        });
        return { success: true };
      } else {
        const errorMsg = 'Twilio message created but no SID returned';
        logger.warn(errorMsg, {
          to: toNumber,
          status: result.status,
        });
        return { 
          success: false, 
          error: { 
            message: errorMsg,
            details: { status: result.status }
          } 
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const twilioError = error as { 
        code?: number; 
        status?: number; 
        message?: string;
        moreInfo?: string;
      };
      
      // Build error details
      const errorDetails: {
        message: string;
        code?: number;
        status?: number;
        moreInfo?: string;
        details?: unknown;
      } = {
        message: twilioError.message || errorMessage,
        code: twilioError.code,
        status: twilioError.status,
      };
      
      // Add more info if available
      if (twilioError.moreInfo) {
        errorDetails.moreInfo = twilioError.moreInfo;
      }
      
      // Provide helpful error messages for common issues
      if (twilioError.code === 21211) {
        errorDetails.message = 'Invalid phone number format for Twilio WhatsApp';
        logger.error(errorDetails.message, { to, code: twilioError.code, status: twilioError.status });
      } else if (twilioError.code === 21608) {
        errorDetails.message = 'Unsubscribed recipient - user has opted out of WhatsApp messages';
        logger.error(errorDetails.message, { to, code: twilioError.code });
      } else if (twilioError.code === 21610) {
        errorDetails.message = 'WhatsApp message template required - user not in 24-hour window';
        logger.error(errorDetails.message, { to, code: twilioError.code });
      } else if (twilioError.code === 63007) {
        errorDetails.message = 'WhatsApp message cannot be sent - recipient may not be in allowed list or WhatsApp Business account not properly configured';
        logger.error(errorDetails.message, { to, code: twilioError.code, status: twilioError.status });
      } else if (twilioError.code === 63016) {
        errorDetails.message = 'WhatsApp sender not registered or not approved for WhatsApp messaging';
        logger.error(errorDetails.message, { to, code: twilioError.code });
      } else if (twilioError.code === 63040) {
        errorDetails.message = 'WhatsApp message template was rejected by WhatsApp';
        logger.error(errorDetails.message, { to, code: twilioError.code });
      } else if (twilioError.code === 63041) {
        errorDetails.message = 'WhatsApp message template is paused due to quality concerns';
        logger.error(errorDetails.message, { to, code: twilioError.code });
      } else if (twilioError.status === 400) {
        errorDetails.message = 'Bad request to Twilio WhatsApp API - check phone number format and message content';
        logger.error(errorDetails.message, { to, status: twilioError.status, code: twilioError.code });
      } else if (twilioError.status === 401) {
        errorDetails.message = 'Twilio authentication failed - check Account SID and Auth Token';
        logger.error(errorDetails.message, { to, status: twilioError.status });
      } else if (twilioError.status === 403) {
        errorDetails.message = 'Twilio access forbidden - check account permissions and WhatsApp sender approval';
        logger.error(errorDetails.message, { to, status: twilioError.status });
      } else {
        logger.error('Failed to send WhatsApp message via Twilio', { to, error: errorMessage, code: twilioError.code, status: twilioError.status });
      }
      
      return { success: false, error: errorDetails };
    }
  }

  /**
   * Format phone number for WhatsApp (E.164 format required by Twilio)
   * Ensures phone number is in E.164 format: +[country code][number]
   * Example: +9611234567 or +1234567890
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all whitespace
    const cleaned = phone.trim();
    
    // If already starts with +, keep it and remove all non-digits after
    if (cleaned.startsWith('+')) {
      const digits = cleaned.slice(1).replace(/\D/g, '');
      // Ensure we have at least country code + number (minimum 8 digits total)
      if (digits.length >= 8) {
        return '+' + digits;
      }
    }
    
    // If no + prefix, remove all non-digits
    const digits = cleaned.replace(/\D/g, '');
    
    // If we have digits but no +, check if it looks like a valid number
    if (digits.length >= 8) {
      // Assume it needs a + prefix for E.164 format
      return '+' + digits;
    }
    
    // Return as-is if we can't format it properly (will be caught by validation)
    return cleaned;
  }

  /**
   * Verify WhatsApp configuration
   * Checks if the configured provider is accessible and credentials are valid
   */
  static async verifyConfiguration(): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp is not enabled in configuration');
        return false;
      }

      // Check if at least one provider is configured
      const hasTwilio = !!(config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber);

      if (!hasTwilio) {
        logger.error('No WhatsApp provider configured. Please configure either Twilio or custom API settings.');
        return false;
      }

      // Verify Twilio credentials if configured
      if (hasTwilio) {
        try {
          const client = twilio(config.whatsappAccountSid, config.whatsappAuthToken);
          // Try to fetch account info to verify credentials
          await client.api.accounts(config.whatsappAccountSid).fetch();
          logger.info('Twilio configuration verified successfully');
          return true;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Twilio configuration verification failed', { error: errorMessage });
          return false;
        }
      }

      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('WhatsApp configuration verification failed', { error: errorMessage });
      return false;
    }
  }
}

