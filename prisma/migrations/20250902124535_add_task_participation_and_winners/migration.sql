-- CreateEnum
CREATE TYPE "public"."ParticipationStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'REJECTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "public"."WinnerStatus" AS ENUM ('SELECTED', 'CLAIMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."task_participations" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "participantAddress" TEXT NOT NULL,
    "submissionData" TEXT,
    "submissionUrl" TEXT,
    "status" "public"."ParticipationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."task_winners" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "winnerAddress" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prizeAmount" DOUBLE PRECISION NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "status" "public"."WinnerStatus" NOT NULL DEFAULT 'SELECTED',

    CONSTRAINT "task_winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_participations_taskId_idx" ON "public"."task_participations"("taskId");

-- CreateIndex
CREATE INDEX "task_participations_participantAddress_idx" ON "public"."task_participations"("participantAddress");

-- CreateIndex
CREATE INDEX "task_participations_status_idx" ON "public"."task_participations"("status");

-- CreateIndex
CREATE INDEX "task_participations_submittedAt_idx" ON "public"."task_participations"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_participations_taskId_participantAddress_key" ON "public"."task_participations"("taskId", "participantAddress");

-- CreateIndex
CREATE INDEX "task_winners_taskId_idx" ON "public"."task_winners"("taskId");

-- CreateIndex
CREATE INDEX "task_winners_winnerAddress_idx" ON "public"."task_winners"("winnerAddress");

-- CreateIndex
CREATE INDEX "task_winners_position_idx" ON "public"."task_winners"("position");

-- CreateIndex
CREATE INDEX "task_winners_status_idx" ON "public"."task_winners"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_winners_taskId_position_key" ON "public"."task_winners"("taskId", "position");

-- AddForeignKey
ALTER TABLE "public"."task_participations" ADD CONSTRAINT "task_participations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_winners" ADD CONSTRAINT "task_winners_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
