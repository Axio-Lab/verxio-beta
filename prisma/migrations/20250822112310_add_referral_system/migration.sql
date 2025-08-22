/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'SUCCESS');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "pendingReferralCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referrerCreditsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "referredUserCreditsAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "public"."users"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
