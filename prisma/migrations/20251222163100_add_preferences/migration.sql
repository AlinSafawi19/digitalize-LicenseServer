-- CreateTable
CREATE TABLE "Preferences" (
    "id" SERIAL NOT NULL,
    "general" JSONB NOT NULL DEFAULT '{"phoneNumberVerification":true}',
    "customer" JSONB NOT NULL DEFAULT '{}',
    "licenseTypeVersion" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Preferences_id_key" ON "Preferences"("id");
