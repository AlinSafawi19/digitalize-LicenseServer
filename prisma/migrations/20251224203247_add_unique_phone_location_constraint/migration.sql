-- AlterTable
ALTER TABLE "License" ADD CONSTRAINT "License_customerPhone_locationName_key" UNIQUE ("customerPhone", "locationName");

