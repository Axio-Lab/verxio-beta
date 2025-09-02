-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" TEXT NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "submissionInstructions" TEXT NOT NULL,
    "image" TEXT,
    "prizePool" DOUBLE PRECISION NOT NULL,
    "numberOfWinners" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "pointsPerAction" INTEGER NOT NULL,
    "prizeSplits" TEXT[],
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_creatorAddress_idx" ON "public"."tasks"("creatorAddress");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "public"."tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_expiryDate_idx" ON "public"."tasks"("expiryDate");

-- CreateIndex
CREATE INDEX "tasks_createdAt_idx" ON "public"."tasks"("createdAt");
