# WhatsApp Integration Setup Guide

This guide will help you configure the WhatsApp service to send real messages to customers.

## Overview

The WhatsApp service is already integrated into your license server and supports two providers:
1. **Twilio** (Recommended for production)
2. **Custom HTTP API** (For other WhatsApp API providers)

## Step 1: Choose a WhatsApp Provider

### Option A: Twilio (Recommended)

Twilio provides a reliable WhatsApp Business API. To use Twilio:

1. **Sign up for Twilio**
   - Go to https://www.twilio.com/
   - Create an account or sign in
   - Navigate to the Console

2. **Get a WhatsApp-enabled phone number**
   - In Twilio Console, go to **Messaging** → **Try it out** → **Send a WhatsApp message**
   - Follow the setup wizard to get a WhatsApp Sandbox number (for testing)
   - For production, you'll need to apply for a WhatsApp Business Account

3. **Get your credentials**
   - **Account SID**: Found in your Twilio Console dashboard
   - **Auth Token**: Found in your Twilio Console dashboard (click to reveal)
   - **From Number**: Your Twilio WhatsApp number (format: `whatsapp:+1234567890`)

### Option B: Custom HTTP API

If you're using a different WhatsApp API provider (e.g., WhatsApp Business API, MessageBird, etc.):

1. **Get your API credentials**
   - API URL: Your provider's endpoint URL
   - API Key: Your provider's authentication key/token
   - From Number: Your WhatsApp Business number

## Step 2: Configure Environment Variables

Create or update your `.env` file in the `digitalize-LicenseServer` directory:

### For Twilio:

```env
# Enable WhatsApp service
WHATSAPP_ENABLED=true

# Twilio Configuration
WHATSAPP_ACCOUNT_SID=your_twilio_account_sid_here
WHATSAPP_AUTH_TOKEN=your_twilio_auth_token_here
WHATSAPP_FROM_NUMBER=whatsapp:+1234567890
```

### For Custom API:

```env
# Enable WhatsApp service
WHATSAPP_ENABLED=true

# Custom API Configuration
WHATSAPP_API_URL=https://your-api-provider.com/api/send
WHATSAPP_API_KEY=your_api_key_here
WHATSAPP_FROM_NUMBER=+1234567890
```

**Note**: You can use either Twilio OR Custom API, not both. The service will automatically detect which one is configured.

## Step 3: Verify Configuration

After setting up your environment variables, you can verify the configuration:

1. **Restart your server** to load the new environment variables

2. **Check the logs** when the server starts - it should show WhatsApp configuration status

3. **Test the configuration** (optional):
   - You can add a test endpoint or use the existing license activation flow
   - The service will log whether WhatsApp messages are being sent successfully

## Step 4: Test WhatsApp Messages

### Testing with License Activation

1. Create a test license with a valid phone number
2. Activate the license
3. Check the server logs for WhatsApp message sending status
4. Verify the message was received on the phone number

### What Messages Are Sent Automatically

The system automatically sends WhatsApp messages for:

1. **OTP Verification** - When verifying phone numbers
2. **License Details** - After phone verification (includes license key)
3. **Activation Credentials** - After license activation (includes username/password)
4. **Expiration Warnings** - When licenses are about to expire
5. **Expiration Notifications** - When licenses have expired

## Step 5: Monitor and Troubleshoot

### Check Logs

The WhatsApp service logs all activities. Look for:
- `WhatsApp message sent successfully` - Success
- `Failed to send WhatsApp message` - Failure (check error details)
- `WhatsApp service not available` - Service is disabled

### Common Issues

1. **"WhatsApp service not available"**
   - Check that `WHATSAPP_ENABLED=true` in your `.env` file
   - Restart the server after changing environment variables

2. **"No WhatsApp provider configured"**
   - Ensure you've configured either Twilio credentials OR custom API URL
   - Check that all required variables are set

3. **"Invalid phone number format"**
   - Phone numbers should be in international format (e.g., `+1234567890`)
   - The service automatically formats numbers, but ensure input is valid

4. **Twilio errors**
   - Verify your Account SID and Auth Token are correct
   - Check that your Twilio account has sufficient credits
   - Ensure your WhatsApp number is properly configured in Twilio

5. **Custom API errors**
   - Verify the API URL is correct and accessible
   - Check that your API key is valid
   - Ensure the API endpoint accepts the expected payload format

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WHATSAPP_ENABLED` | Yes | Enable/disable WhatsApp service | `true` |
| `WHATSAPP_ACCOUNT_SID` | For Twilio | Twilio Account SID | `ACxxxxxxxxxxxxx` |
| `WHATSAPP_AUTH_TOKEN` | For Twilio | Twilio Auth Token | `your_auth_token` |
| `WHATSAPP_FROM_NUMBER` | For Twilio | Twilio WhatsApp number | `whatsapp:+1234567890` |
| `WHATSAPP_API_URL` | For Custom API | Custom API endpoint URL | `https://api.example.com/send` |
| `WHATSAPP_API_KEY` | For Custom API | Custom API authentication key | `your_api_key` |

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use environment-specific configurations** (development, staging, production)
3. **Rotate API keys regularly**
4. **Monitor API usage** to detect unusual activity
5. **Set up rate limiting** (already implemented in the service)

## Production Checklist

Before going to production:

- [ ] WhatsApp service enabled (`WHATSAPP_ENABLED=true`)
- [ ] Production WhatsApp provider configured (Twilio or Custom API)
- [ ] Valid WhatsApp Business number obtained
- [ ] All credentials are secure and not exposed
- [ ] Test messages sent and received successfully
- [ ] Error handling and logging verified
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and alerts set up

## Support

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with a simple message first
4. Contact your WhatsApp API provider's support if needed

## Next Steps

Once configured, the WhatsApp service will automatically:
- Send OTP codes for phone verification
- Send license details after verification
- Send activation credentials after license activation
- Send expiration warnings and notifications

No additional code changes are needed - the service is already integrated!

