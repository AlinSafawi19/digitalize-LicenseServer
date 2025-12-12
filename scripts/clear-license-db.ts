#!/usr/bin/env ts-node

/**
 cd digitalize-LicenseServer
 $env:DATABASE_URL="postgresql://postgres:AbURMQEsiWTUXrkYeZUPzECBnAmIXmyI@nozomi.proxy.rlwy.net:53074/railway"; $env:NODE_ENV="production"; npm run clear:license-db
 **/
 
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
// Try multiple possible .env file locations
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
];
for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

/**
 * Prompt user for confirmation
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Get counts of records in each table
 */
async function getRecordCounts() {
  const [licenseCount, activationCount, subscriptionCount, paymentCount, adminCount] = await Promise.all([
    prisma.license.count(),
    prisma.activation.count(),
    prisma.subscription.count(),
    prisma.payment.count(),
    prisma.admin.count(),
  ]);

  return {
    licenseCount,
    activationCount,
    subscriptionCount,
    paymentCount,
    adminCount,
  };
}

/**
 * Clear all license-related data
 */
async function clearLicenseDatabase(clearAdmins: boolean = false) {
  console.log('\n🧹 Starting database cleanup...\n');

  try {
    // Get initial counts
    const initialCounts = await getRecordCounts();
    console.log('📊 Current database state:');
    console.log(`   Licenses: ${initialCounts.licenseCount}`);
    console.log(`   Activations: ${initialCounts.activationCount}`);
    console.log(`   Subscriptions: ${initialCounts.subscriptionCount}`);
    console.log(`   Payments: ${initialCounts.paymentCount}`);
    console.log(`   Admins: ${initialCounts.adminCount}`);
    console.log('');

    // Delete in order (respecting foreign key constraints)
    // Payments are deleted via cascade when License is deleted, but we'll delete explicitly for clarity
    console.log('🗑️  Deleting Payments...');
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPayments.count} payment(s)`);

    console.log('🗑️  Deleting Subscriptions...');
    const deletedSubscriptions = await prisma.subscription.deleteMany({});
    console.log(`   ✓ Deleted ${deletedSubscriptions.count} subscription(s)`);

    console.log('🗑️  Deleting Activations...');
    const deletedActivations = await prisma.activation.deleteMany({});
    console.log(`   ✓ Deleted ${deletedActivations.count} activation(s)`);

    console.log('🗑️  Deleting Licenses...');
    const deletedLicenses = await prisma.license.deleteMany({});
    console.log(`   ✓ Deleted ${deletedLicenses.count} license(s)`);

    // Optionally delete admins
    if (clearAdmins) {
      console.log('🗑️  Deleting Admins...');
      const deletedAdmins = await prisma.admin.deleteMany({});
      console.log(`   ✓ Deleted ${deletedAdmins.count} admin(s)`);
    } else {
      console.log('ℹ️  Admins preserved (not deleted)');
    }

    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const finalCounts = await getRecordCounts();
    
    const allCleared = 
      finalCounts.licenseCount === 0 &&
      finalCounts.activationCount === 0 &&
      finalCounts.subscriptionCount === 0 &&
      finalCounts.paymentCount === 0;

    if (allCleared) {
      console.log('✅ All license data cleared successfully!');
      console.log(`   Licenses: ${finalCounts.licenseCount}`);
      console.log(`   Activations: ${finalCounts.activationCount}`);
      console.log(`   Subscriptions: ${finalCounts.subscriptionCount}`);
      console.log(`   Payments: ${finalCounts.paymentCount}`);
      if (!clearAdmins) {
        console.log(`   Admins: ${finalCounts.adminCount} (preserved)`);
      }
    } else {
      console.log('⚠️  WARNING: Some data may still exist!');
      console.log(`   Licenses: ${finalCounts.licenseCount}`);
      console.log(`   Activations: ${finalCounts.activationCount}`);
      console.log(`   Subscriptions: ${finalCounts.subscriptionCount}`);
      console.log(`   Payments: ${finalCounts.paymentCount}`);
    }

    return true;
  } catch (error) {
    console.error('\n❌ Error clearing database:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     License Database Clear Script                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Environment: ${nodeEnv}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log('');

  // Safety checks
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set!');
    console.error('   Please set DATABASE_URL in your .env file or environment variables.');
    process.exit(1);
  }

  // Parse and show database connection details (masked for security)
  const dbUrl = process.env.DATABASE_URL;
  let dbHost = 'unknown';
  let dbName = 'unknown';
  let dbUser = 'unknown';
  
  try {
    // Parse PostgreSQL URL: postgresql://user:password@host:port/database
    const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):?(\d+)?\/(.+?)(\?|$)/);
    if (urlMatch) {
      dbUser = urlMatch[1];
      dbHost = urlMatch[3];
      const port = urlMatch[4] || '5432';
      dbName = urlMatch[5].split('?')[0]; // Remove query params
      dbHost = `${dbHost}:${port}`;
    }
  } catch (e) {
    // If parsing fails, just show masked URL
  }
  
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@'); // Mask password
  console.log('📊 Database Connection Details:');
  console.log(`   Host: ${dbHost}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   User: ${dbUser}`);
  console.log(`   Full URL: ${maskedUrl}`);
  console.log('');
  
  // Warn if connecting to localhost in production mode
  if (isProduction && dbHost.includes('localhost')) {
    console.log('⚠️  WARNING: You are in PRODUCTION mode but connecting to localhost!');
    console.log('   This might be a development database. Please verify!');
    console.log('');
  }

  // Production warning
  if (isProduction) {
    console.log('⚠️  ⚠️  ⚠️  PRODUCTION ENVIRONMENT DETECTED ⚠️  ⚠️  ⚠️');
    console.log('');
    console.log('This script will PERMANENTLY DELETE all license data!');
    console.log('This action CANNOT be undone!');
    console.log('');
  } else {
    console.log('ℹ️  Development environment detected.');
    console.log('   This script will delete all license data.');
    console.log('');
  }

  // Get confirmation
  const confirmation = await askQuestion(
    `Type "DELETE ALL LICENSE DATA" (exactly) to confirm: `
  );

  if (confirmation !== 'DELETE ALL LICENSE DATA') {
    console.log('\n❌ Confirmation text did not match. Aborting.');
    process.exit(0);
  }

  // Ask about admins
  const clearAdminsAnswer = await askQuestion(
    '\nDo you also want to delete Admin users? (yes/no, default: no): '
  );
  const clearAdmins = clearAdminsAnswer.toLowerCase().trim() === 'yes';

  if (clearAdmins) {
    console.log('⚠️  WARNING: Admin users will also be deleted!');
  }

  // Final confirmation
  const finalConfirmation = await askQuestion(
    '\n⚠️  FINAL CONFIRMATION: Are you absolutely sure? (yes/no): '
  );

  if (finalConfirmation.toLowerCase().trim() !== 'yes') {
    console.log('\n❌ Operation cancelled.');
    process.exit(0);
  }

  try {
    // Connect to database
    console.log('\n🔌 Connecting to database...');
    await prisma.$connect();
    console.log('✅ Connected successfully');
    
    // Verify database name by querying it
    try {
      const dbInfo = await prisma.$queryRaw<Array<{ current_database: string }>>`
        SELECT current_database() as current_database
      `;
      const actualDbName = dbInfo[0]?.current_database || 'unknown';
      console.log(`   Verified database: ${actualDbName}`);
      
      if (dbName !== 'unknown' && actualDbName !== dbName) {
        console.log(`   ⚠️  WARNING: Database name mismatch!`);
        console.log(`      Expected: ${dbName}`);
        console.log(`      Actual: ${actualDbName}`);
      }
    } catch (e) {
      console.log('   ⚠️  Could not verify database name');
    }
    console.log('');

    // Clear the database
    await clearLicenseDatabase(clearAdmins);

    console.log('\n✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await prisma.$disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

