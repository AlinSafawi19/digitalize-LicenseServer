/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data (for development/testing)
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
  console.log(`   - Admin password: ${adminPassword} (change this in production!)`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

