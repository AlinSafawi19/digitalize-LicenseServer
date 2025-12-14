import { logger } from '../utils/logger';
import { config } from '../config/config';
import twilio from 'twilio';
import axios, { AxiosError } from 'axios';

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
   */
  static async sendOTP(to: string, message: string): Promise<boolean> {
    try {
      if (!config.whatsappEnabled) {
        logger.warn('WhatsApp service not available, skipping OTP send', { to });
        return false;
      }

      const success = await this.sendWhatsAppMessage(to, message);
      
      if (success) {
        logger.info('OTP WhatsApp message sent successfully', {
          to,
        });
        return true;
      } else {
        logger.warn('Failed to send OTP WhatsApp message', { to });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send OTP WhatsApp message', {
        to,
        error: errorMessage,
      });
      return false;
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
      
      const success = await this.sendWhatsAppMessage(to, message);
      
      if (success) {
        logger.info('Activation credentials WhatsApp message sent successfully', {
          to,
        });
        return true;
      } else {
        logger.warn('Failed to send activation credentials WhatsApp message', { to });
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
      const success = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (success) {
        logger.info('License details WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
        });
        return true;
      } else {
        logger.warn('Failed to send license details WhatsApp message', {
          to: data.customerPhone,
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
      const success = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (success) {
        logger.info('Expiration warning WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
          daysRemaining: data.daysRemaining,
        });
        return true;
      } else {
        logger.warn('Failed to send expiration warning WhatsApp message', {
          to: data.customerPhone,
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
      const success = await this.sendWhatsAppMessage(data.customerPhone, message);
      
      if (success) {
        logger.info('Expiration notification WhatsApp message sent successfully', {
          to: data.customerPhone,
          licenseKey: data.licenseKey,
        });
        return true;
      } else {
        logger.warn('Failed to send expiration notification WhatsApp message', {
          to: data.customerPhone,
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
   */
  private static async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    try {
      // Format phone number (remove any non-digit characters except +)
      const phoneNumber = this.formatPhoneNumber(to);
      
      // Validate phone number
      if (!phoneNumber || phoneNumber.length < 10) {
        logger.error('Invalid phone number format', { to, phoneNumber });
        return false;
      }

      // Check if Twilio credentials are configured
      if (config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber) {
        return await this.sendViaTwilio(phoneNumber, message);
      }

      // Check if custom API URL is configured
      if (config.whatsappApiUrl) {
        return await this.sendViaCustomAPI(phoneNumber, message);
      }

      // No provider configured
      logger.error('No WhatsApp provider configured. Please configure either Twilio or custom API settings.', {
        hasTwilio: !!(config.whatsappAccountSid && config.whatsappAuthToken && config.whatsappFromNumber),
        hasCustomAPI: !!config.whatsappApiUrl,
      });
      return false;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending WhatsApp message', {
        to,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Send WhatsApp message via Twilio
   */
  private static async sendViaTwilio(to: string, message: string): Promise<boolean> {
    try {
      if (!config.whatsappAccountSid || !config.whatsappAuthToken || !config.whatsappFromNumber) {
        logger.error('Twilio credentials incomplete', {
          hasAccountSid: !!config.whatsappAccountSid,
          hasAuthToken: !!config.whatsappAuthToken,
          hasFromNumber: !!config.whatsappFromNumber,
        });
        return false;
      }

      const client = twilio(config.whatsappAccountSid, config.whatsappAuthToken);
      
      // Format phone numbers for Twilio WhatsApp
      const fromNumber = config.whatsappFromNumber.startsWith('whatsapp:')
        ? config.whatsappFromNumber
        : `whatsapp:${config.whatsappFromNumber}`;
      
      const toNumber = to.startsWith('whatsapp:')
        ? to
        : `whatsapp:${to}`;

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
        return true;
      } else {
        logger.warn('Twilio message created but no SID returned', {
          to: toNumber,
          status: result.status,
        });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const twilioError = error as { code?: number; status?: number; message?: string };
      
      logger.error('Failed to send WhatsApp message via Twilio', {
        to,
        error: errorMessage,
        code: twilioError.code,
        status: twilioError.status,
      });
      return false;
    }
  }

  /**
   * Send WhatsApp message via custom HTTP API
   */
  private static async sendViaCustomAPI(to: string, message: string): Promise<boolean> {
    try {
      if (!config.whatsappApiUrl) {
        logger.error('Custom WhatsApp API URL not configured');
        return false;
      }

      logger.debug('Sending WhatsApp message via custom API', {
        to,
        apiUrl: config.whatsappApiUrl,
        messageLength: message.length,
      });

      // Prepare request payload
      // Adjust this structure based on your API provider's requirements
      const payload = {
        to,
        message,
        from: config.whatsappFromNumber || undefined,
      };

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key if provided
      if (config.whatsappApiKey) {
        headers['Authorization'] = `Bearer ${config.whatsappApiKey}`;
        // Alternative: Some APIs use X-API-Key header
        // headers['X-API-Key'] = config.whatsappApiKey;
      }

      const response = await axios.post(config.whatsappApiUrl, payload, {
        headers,
        timeout: 30000, // 30 second timeout
      });

      // Check if request was successful
      // Adjust this based on your API provider's response format
      const success = response.status >= 200 && response.status < 300;
      
      if (success) {
        logger.info('WhatsApp message sent successfully via custom API', {
          to,
          status: response.status,
          responseData: response.data,
        });
        return true;
      } else {
        logger.warn('Custom API returned non-success status', {
          to,
          status: response.status,
          responseData: response.data,
        });
        return false;
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        logger.error('Failed to send WhatsApp message via custom API', {
          to,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          error: axiosError.message,
          responseData: axiosError.response?.data,
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send WhatsApp message via custom API', {
          to,
          error: errorMessage,
        });
      }
      return false;
    }
  }

  /**
   * Format phone number for WhatsApp
   * Removes non-digit characters except + at the start
   */
  private static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters except + at the start
    const cleaned = phone.trim();
    if (cleaned.startsWith('+')) {
      return '+' + cleaned.slice(1).replace(/\D/g, '');
    }
    return cleaned.replace(/\D/g, '');
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
      const hasCustomAPI = !!config.whatsappApiUrl;

      if (!hasTwilio && !hasCustomAPI) {
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

      // Verify custom API if configured
      if (hasCustomAPI) {
        try {
          // Try to make a simple request to verify the API is accessible
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          if (config.whatsappApiKey) {
            headers['Authorization'] = `Bearer ${config.whatsappApiKey}`;
          }

          // Some APIs have a health/status endpoint, adjust URL as needed
          const healthUrl = config.whatsappApiUrl.replace(/\/send$/, '/health').replace(/\/message$/, '/health');
          
          try {
            await axios.get(healthUrl, { headers, timeout: 10000 });
            logger.info('Custom WhatsApp API configuration verified successfully');
            return true;
          } catch (healthError) {
            // If health endpoint doesn't exist, that's okay - just log it
            logger.debug('Health endpoint not available, but API URL is configured', {
              healthUrl,
            });
            logger.info('Custom WhatsApp API URL configured (health check skipped)');
            return true;
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Custom WhatsApp API configuration verification failed', { error: errorMessage });
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

