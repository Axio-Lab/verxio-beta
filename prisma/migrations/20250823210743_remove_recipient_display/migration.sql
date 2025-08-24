/*
  Warnings:

  - You are about to drop the column `recipientDisplay` on the `transfer_records` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."transfer_records" DROP COLUMN "recipientDisplay";
