import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'DigitalizePOS License Server',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // License Settings
  initialLicensePrice: parseFloat(process.env.INITIAL_LICENSE_PRICE || '350'),
  annualSubscriptionPrice: parseFloat(process.env.ANNUAL_SUBSCRIPTION_PRICE || '50'),
  gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS || '0', 10),
  freeTrialDays: parseInt(process.env.FREE_TRIAL_DAYS || '10', 10),
  cacheValidityDays: parseInt(process.env.CACHE_VALIDITY_DAYS || '14', 10),

  // WhatsApp Settings
  whatsappEnabled: process.env.WHATSAPP_ENABLED === 'true',
  whatsappApiUrl: process.env.WHATSAPP_API_URL || '',
  whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
  whatsappFromNumber: process.env.WHATSAPP_FROM_NUMBER || '',
  // For Twilio integration (example)
  whatsappAccountSid: process.env.WHATSAPP_ACCOUNT_SID || '',
  whatsappAuthToken: process.env.WHATSAPP_AUTH_TOKEN || '',
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];

if (config.nodeEnv === 'production') {
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

