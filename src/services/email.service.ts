import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export interface EmailCredentials {
  username: string;
  password: string;
  licenseKey: string;
  locationName: string;
  locationAddress: string;
  customerName?: string | null;
}

export interface ExpirationEmailData {
  customerName?: string | null;
  customerEmail: string;
  licenseKey: string;
  locationName: string | null;
  expirationDate: Date;
  daysRemaining: number;
  isFreeTrial: boolean;
}

/**
 * Email Service
 * Handles sending emails via SMTP
 */
export class EmailService {
  private static transporter: Transporter | null = null;

  /**
   * Initialize email transporter
   */
  private static initializeTransporter(): Transporter | null {
    // If email is not configured, return null
    if (!config.emailEnabled) {
      logger.debug('Email service is disabled (SMTP not configured)');
      return null;
    }

    if (this.transporter) {
      return this.transporter;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure, // true for 465, false for other ports
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
      });

      logger.info('Email transporter initialized', {
        host: config.smtpHost,
        port: config.smtpPort,
      });

      return this.transporter;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize email transporter', { error: errorMessage });
      return null;
    }
  }

  /**
   * Send activation credentials email
   */
  static async sendActivationCredentials(
    to: string,
    credentials: EmailCredentials
  ): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        logger.warn('Email service not available, skipping email send', { to });
        return false;
      }

      const subject = 'Your DigitalizePOS Login Credentials';
      const html = this.getActivationEmailTemplate(credentials);

      const mailOptions = {
        from: config.smtpFrom || config.smtpUser,
        to,
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('Activation credentials email sent successfully', {
        to,
        messageId: info.messageId,
      });

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send activation credentials email', {
        to,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Get HTML email template for activation credentials
   */
  private static getActivationEmailTemplate(credentials: EmailCredentials): string {
    const customerName = credentials.customerName || 'Valued Customer';
    const logoHtml = this.getLogoHtml();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigitalizePOS Login Credentials</title>
</head>
<body style="font-family: -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #212121; background-color: #fafafa; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- Logo Header -->
  <div style="text-align: center; margin-bottom: 30px; padding: 20px 0;">
    ${logoHtml}
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: #1a237e; margin-top: 0; font-size: 24px; font-weight: 600;">Welcome to DigitalizePOS!</h1>
    <p style="color: #212121; margin: 12px 0;">Dear ${customerName},</p>
    <p style="color: #616161; margin: 12px 0;">Thank you for activating your DigitalizePOS license. Your login credentials have been generated and are ready to use.</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #1a237e; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #1a237e; margin-top: 0; font-size: 20px; font-weight: 600;">Your Login Credentials</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px; background-color: #fafafa; border: 1px solid #e0e0e0; font-weight: 600; color: #37474f; width: 120px;">Username:</td>
        <td style="padding: 12px; background-color: #ffffff; border: 1px solid #e0e0e0; font-family: 'Courier New', monospace; font-size: 14px; color: #212121;">${credentials.username}</td>
      </tr>
      <tr>
        <td style="padding: 12px; background-color: #fafafa; border: 1px solid #e0e0e0; font-weight: 600; color: #37474f;">Password:</td>
        <td style="padding: 12px; background-color: #ffffff; border: 1px solid #e0e0e0; font-family: 'Courier New', monospace; font-size: 14px; color: #212121;">${credentials.password}</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #fff3e0; border-left: 4px solid #f57c00; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; color: #212121;"><strong style="color: #f57c00;">Important:</strong> Please save these credentials in a secure location. You will need them to log in to your DigitalizePOS system.</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1a237e; margin-top: 0; font-size: 18px; font-weight: 600;">License Information</h3>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">License Key:</strong> <code style="background-color: #fafafa; border: 1px solid #e0e0e0; padding: 4px 8px; font-family: 'Courier New', monospace; color: #1a237e; border-radius: 0;">${credentials.licenseKey}</code></p>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">Location:</strong> <span style="color: #616161;">${credentials.locationName}</span></p>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">Address:</strong> <span style="color: #616161;">${credentials.locationAddress}</span></p>
  </div>

  <div style="background-color: #e3f2fd; border-left: 4px solid #1565c0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1565c0; margin-top: 0; font-size: 18px; font-weight: 600;">Next Steps</h3>
    <ol style="margin: 0; padding-left: 20px; color: #212121;">
      <li style="margin: 6px 0;">Open the DigitalizePOS application</li>
      <li style="margin: 6px 0;">Use the username and password above to log in</li>
      <li style="margin: 6px 0;">Change your password after first login (recommended)</li>
      <li style="margin: 6px 0;">Start setting up your store and products</li>
    </ol>
  </div>

  <div style="text-align: center; color: #616161; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
    <p style="margin: 8px 0;">This is an automated email from DigitalizePOS. Please do not reply to this email.</p>
    <p style="margin: 8px 0;">If you have any questions or need assistance, please contact our support team.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get logo HTML for email template
   * Uses hosted logo URL if configured, otherwise creates a styled text logo
   */
  private static getLogoHtml(): string {
    const logoUrl = config.logoUrl;

    if (logoUrl) {
      // Use hosted logo image
      return `
        <img src="${logoUrl}" alt="DigitalizePOS" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
      `.trim();
    }

    // Fallback: Create a styled text logo that matches the brand (using desktop app colors)
    return `
      <div style="display: inline-block; text-align: center;">
        <div style="background: linear-gradient(135deg, #1a237e 0%, #000051 100%); padding: 12px 24px; display: inline-block; margin-bottom: 8px; border: 1px solid #000051;">
          <span style="color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px; font-family: -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;">
            DigitalizePOS
          </span>
        </div>
        <div style="margin-top: 4px;">
          <span style="color: #616161; font-size: 10px; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;">
            GROCERY STORE
          </span>
        </div>
      </div>
    `.trim();
  }

  /**
   * Send expiration warning email (sent when license is expiring soon)
   */
  static async sendExpirationWarning(
    data: ExpirationEmailData
  ): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        logger.warn('Email service not available, skipping expiration warning email', { 
          to: data.customerEmail 
        });
        return false;
      }

      const subject = data.isFreeTrial
        ? `Your DigitalizePOS Free Trial Expires in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'Day' : 'Days'}`
        : `Your DigitalizePOS License Expires in ${data.daysRemaining} ${data.daysRemaining === 1 ? 'Day' : 'Days'}`;
      const html = this.getExpirationWarningEmailTemplate(data);

      const mailOptions = {
        from: config.smtpFrom || config.smtpUser,
        to: data.customerEmail,
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('Expiration warning email sent successfully', {
        to: data.customerEmail,
        licenseKey: data.licenseKey,
        daysRemaining: data.daysRemaining,
        messageId: info.messageId,
      });

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send expiration warning email', {
        to: data.customerEmail,
        licenseKey: data.licenseKey,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Send expiration notification email (sent when license has expired)
   */
  static async sendExpirationNotification(
    data: ExpirationEmailData
  ): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        logger.warn('Email service not available, skipping expiration notification email', { 
          to: data.customerEmail 
        });
        return false;
      }

      const subject = data.isFreeTrial
        ? 'Your DigitalizePOS Free Trial Has Expired'
        : 'Your DigitalizePOS License Has Expired';
      const html = this.getExpirationNotificationEmailTemplate(data);

      const mailOptions = {
        from: config.smtpFrom || config.smtpUser,
        to: data.customerEmail,
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info('Expiration notification email sent successfully', {
        to: data.customerEmail,
        licenseKey: data.licenseKey,
        messageId: info.messageId,
      });

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send expiration notification email', {
        to: data.customerEmail,
        licenseKey: data.licenseKey,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * Get HTML email template for expiration warning
   */
  private static getExpirationWarningEmailTemplate(data: ExpirationEmailData): string {
    const customerName = data.customerName || 'Valued Customer';
    const logoHtml = this.getLogoHtml();
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigitalizePOS License Expiration Warning</title>
</head>
<body style="font-family: -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #212121; background-color: #fafafa; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- Logo Header -->
  <div style="text-align: center; margin-bottom: 30px; padding: 20px 0;">
    ${logoHtml}
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: ${isUrgent ? '#d32f2f' : '#f57c00'}; margin-top: 0; font-size: 24px; font-weight: 600;">
      ${isUrgent ? '⚠️ Urgent: ' : ''}Your ${licenseType.charAt(0).toUpperCase() + licenseType.slice(1)} Expires Soon
    </h1>
    <p style="color: #212121; margin: 12px 0;">Dear ${customerName},</p>
    <p style="color: #616161; margin: 12px 0;">
      This is a reminder that your DigitalizePOS ${licenseType} will expire in <strong style="color: ${isUrgent ? '#d32f2f' : '#f57c00'};">${data.daysRemaining} ${data.daysRemaining === 1 ? 'day' : 'days'}</strong>.
    </p>
  </div>

  <div style="background-color: ${isUrgent ? '#ffebee' : '#fff3e0'}; border-left: 4px solid ${isUrgent ? '#d32f2f' : '#f57c00'}; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; color: #212121;">
      <strong style="color: ${isUrgent ? '#d32f2f' : '#f57c00'};">Expiration Date:</strong> ${expirationDateStr}
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1a237e; margin-top: 0; font-size: 18px; font-weight: 600;">License Information</h3>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">License Key:</strong> <code style="background-color: #fafafa; border: 1px solid #e0e0e0; padding: 4px 8px; font-family: 'Courier New', monospace; color: #1a237e; border-radius: 0;">${data.licenseKey}</code></p>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">Location:</strong> <span style="color: #616161;">${data.locationName || 'N/A'}</span></p>
  </div>

  <div style="background-color: #e3f2fd; border-left: 4px solid #1565c0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1565c0; margin-top: 0; font-size: 18px; font-weight: 600;">Action Required</h3>
    <p style="margin: 8px 0; color: #212121;">
      To avoid service interruption, please ${actionText} before the expiration date.
    </p>
    ${data.isFreeTrial ? `
    <p style="margin: 8px 0; color: #212121;">
      <strong>Pricing:</strong>
    </p>
    <ul style="margin: 8px 0; padding-left: 20px; color: #212121;">
      <li>Initial License: $350</li>
      <li>Annual Subscription: $50/year</li>
      <li>Additional Users: $25/user</li>
    </ul>
    ` : ''}
  </div>

  <div style="text-align: center; color: #616161; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
    <p style="margin: 8px 0;">This is an automated email from DigitalizePOS. Please do not reply to this email.</p>
    <p style="margin: 8px 0;">If you have any questions or need assistance, please contact our support team.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Get HTML email template for expiration notification
   */
  private static getExpirationNotificationEmailTemplate(data: ExpirationEmailData): string {
    const customerName = data.customerName || 'Valued Customer';
    const logoHtml = this.getLogoHtml();
    const expirationDateStr = data.expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const licenseType = data.isFreeTrial ? 'free trial' : 'license';
    const actionText = data.isFreeTrial
      ? 'purchase a full license to continue using DigitalizePOS'
      : 'renew your license to continue using DigitalizePOS';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DigitalizePOS License Expired</title>
</head>
<body style="font-family: -apple-system, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #212121; background-color: #fafafa; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- Logo Header -->
  <div style="text-align: center; margin-bottom: 30px; padding: 20px 0;">
    ${logoHtml}
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: #d32f2f; margin-top: 0; font-size: 24px; font-weight: 600;">
      ⚠️ Your ${licenseType.charAt(0).toUpperCase() + licenseType.slice(1)} Has Expired
    </h1>
    <p style="color: #212121; margin: 12px 0;">Dear ${customerName},</p>
    <p style="color: #616161; margin: 12px 0;">
      Your DigitalizePOS ${licenseType} expired on <strong style="color: #d32f2f;">${expirationDateStr}</strong>.
    </p>
    <p style="color: #616161; margin: 12px 0;">
      Your access to DigitalizePOS has been suspended. To restore access, please ${actionText} immediately.
    </p>
  </div>

  <div style="background-color: #ffebee; border-left: 4px solid #d32f2f; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; color: #212121;">
      <strong style="color: #d32f2f;">Expiration Date:</strong> ${expirationDateStr}
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1a237e; margin-top: 0; font-size: 18px; font-weight: 600;">License Information</h3>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">License Key:</strong> <code style="background-color: #fafafa; border: 1px solid #e0e0e0; padding: 4px 8px; font-family: 'Courier New', monospace; color: #1a237e; border-radius: 0;">${data.licenseKey}</code></p>
    <p style="margin: 8px 0; color: #212121;"><strong style="color: #37474f;">Location:</strong> <span style="color: #616161;">${data.locationName || 'N/A'}</span></p>
  </div>

  <div style="background-color: #e3f2fd; border-left: 4px solid #1565c0; padding: 15px; margin-bottom: 20px;">
    <h3 style="color: #1565c0; margin-top: 0; font-size: 18px; font-weight: 600;">Restore Access</h3>
    <p style="margin: 8px 0; color: #212121;">
      To restore access to DigitalizePOS, please ${actionText} as soon as possible.
    </p>
    ${data.isFreeTrial ? `
    <p style="margin: 8px 0; color: #212121;">
      <strong>Pricing:</strong>
    </p>
    <ul style="margin: 8px 0; padding-left: 20px; color: #212121;">
      <li>Initial License: $350</li>
      <li>Annual Subscription: $50/year</li>
      <li>Additional Users: $25/user</li>
    </ul>
    ` : ''}
  </div>

  <div style="text-align: center; color: #616161; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
    <p style="margin: 8px 0;">This is an automated email from DigitalizePOS. Please do not reply to this email.</p>
    <p style="margin: 8px 0;">If you have any questions or need assistance, please contact our support team.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Verify email configuration
   */
  static async verifyConfiguration(): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      if (!transporter) {
        return false;
      }

      await transporter.verify();
      logger.info('Email configuration verified successfully');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Email configuration verification failed', { error: errorMessage });
      return false;
    }
  }
}

