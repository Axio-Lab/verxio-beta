-- CreateTable
CREATE TABLE "public"."verxio_credits" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verxio_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verxio_credit_history" (
    "id" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "assetAddress" TEXT NOT NULL,
    "assetOwner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verxio_credit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loyalty_program_claim_status" (
    "id" TEXT NOT NULL,
    "programAddress" TEXT NOT NULL,
    "claimEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_program_claim_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verxio_credits_userAddress_key" ON "public"."verxio_credits"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_program_claim_status_programAddress_key" ON "public"."loyalty_program_claim_status"("programAddress");
