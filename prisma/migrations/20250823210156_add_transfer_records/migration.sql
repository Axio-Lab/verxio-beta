-- CreateEnum
CREATE TYPE "public"."SendType" AS ENUM ('VERXIO', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "public"."TransferStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "public"."transfer_records" (
    "id" TEXT NOT NULL,
    "senderWalletAddress" TEXT NOT NULL,
    "recipientWalletAddress" TEXT NOT NULL,
    "recipientDisplay" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sendType" "public"."SendType" NOT NULL,
    "status" "public"."TransferStatus" NOT NULL DEFAULT 'PENDING',
    "transactionHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_records_pkey" PRIMARY KEY ("id")
);
