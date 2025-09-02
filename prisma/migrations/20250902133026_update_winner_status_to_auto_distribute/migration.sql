/*
  Warnings:

  - The values [SELECTED,CLAIMED,EXPIRED] on the enum `WinnerStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."WinnerStatus_new" AS ENUM ('DISTRIBUTED');
ALTER TABLE "public"."task_winners" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."task_winners" ALTER COLUMN "status" TYPE "public"."WinnerStatus_new" USING ("status"::text::"public"."WinnerStatus_new");
ALTER TYPE "public"."WinnerStatus" RENAME TO "WinnerStatus_old";
ALTER TYPE "public"."WinnerStatus_new" RENAME TO "WinnerStatus";
DROP TYPE "public"."WinnerStatus_old";
ALTER TABLE "public"."task_winners" ALTER COLUMN "status" SET DEFAULT 'DISTRIBUTED';
COMMIT;

-- AlterTable
ALTER TABLE "public"."task_winners" ALTER COLUMN "status" SET DEFAULT 'DISTRIBUTED';
