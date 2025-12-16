/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use production DATABASE_URL if provided, otherwise use the one from env
const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: ['error', 'warn'],
});

async function main() {
  console.log('🌱 Starting production database seeding...');
  console.log(`📊 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`); // Hide password in logs

  // Safety check: Ensure we're not accidentally running in production without explicit confirmation
  if (!process.env.FORCE_PRODUCTION_SEED) {
    console.error('❌ Production seed requires FORCE_PRODUCTION_SEED=true environment variable');
    console.error('   This is a safety measure to prevent accidental data deletion.');
    process.exit(1);
  }

  // Clear existing data (same as dev seed)
  console.log('🧹 Clearing existing data...');
  await prisma.payment.deleteMany();
  await prisma.activation.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.license.deleteMany();
  // Note: Admin users are not deleted to preserve admin accounts

  // Create admin user
  console.log('👤 Creating admin user...');
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash(adminPassword, saltRounds);

  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash: adminPasswordHash,
      isActive: true,
      phone: '+1234567890',
    },
    create: {
      username: 'admin',
      phone: '+1234567890',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });

  console.log('✅ Seed data created successfully!');
  console.log(`   - Admin user: ${admin.username} (phone: ${admin.phone})`);
  console.log(`   - Admin password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

