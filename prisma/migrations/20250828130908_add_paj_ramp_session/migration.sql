-- DropIndex
DROP INDEX "public"."LoyaltyPass_recipient_idx";

-- DropIndex
DROP INDEX "public"."loyalty_program_claim_status_programAddress_idx";

-- DropIndex
DROP INDEX "public"."users_referralCode_idx";

-- DropIndex
DROP INDEX "public"."users_walletAddress_idx";

-- DropIndex
DROP INDEX "public"."verxio_credits_userAddress_idx";

-- CreateTable
CREATE TABLE "public"."paj_ramp_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" TEXT,
    "expiresAt" TEXT,
    "token" TEXT,
    "uuid" TEXT,
    "device" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paj_ramp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paj_ramp_sessions_email_key" ON "public"."paj_ramp_sessions"("email");

-- CreateIndex
CREATE INDEX "paj_ramp_sessions_email_idx" ON "public"."paj_ramp_sessions"("email");

-- CreateIndex
CREATE INDEX "paj_ramp_sessions_isActive_idx" ON "public"."paj_ramp_sessions"("isActive");
