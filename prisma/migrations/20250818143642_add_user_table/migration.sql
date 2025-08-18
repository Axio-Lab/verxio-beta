/*
  Warnings:

  - You are about to drop the column `authorityPrivateKey` on the `LoyaltyProgram` table. All the data in the column will be lost.
  - Added the required column `authorityPublicKey` to the `LoyaltyProgram` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "LoyaltyPass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programAddress" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "passPublicKey" TEXT NOT NULL,
    "passPrivateKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoyaltyProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creator" TEXT NOT NULL,
    "programPublicKey" TEXT NOT NULL,
    "programSecretKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorityPublicKey" TEXT NOT NULL,
    "authoritySecretKey" TEXT NOT NULL
);
INSERT INTO "new_LoyaltyProgram" ("authoritySecretKey", "createdAt", "creator", "id", "programPublicKey", "programSecretKey", "signature", "updatedAt") SELECT "authoritySecretKey", "createdAt", "creator", "id", "programPublicKey", "programSecretKey", "signature", "updatedAt" FROM "LoyaltyProgram";
DROP TABLE "LoyaltyProgram";
ALTER TABLE "new_LoyaltyProgram" RENAME TO "LoyaltyProgram";
CREATE TABLE "new_payment_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "splToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "signature" TEXT,
    "loyaltyProgramAddress" TEXT,
    "loyaltyProgramName" TEXT,
    "loyaltyDiscount" TEXT NOT NULL DEFAULT '0',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_payment_records" ("amount", "createdAt", "id", "recipient", "reference", "signature", "splToken", "status", "updatedAt") SELECT "amount", "createdAt", "id", "recipient", "reference", "signature", "splToken", "status", "updatedAt" FROM "payment_records";
DROP TABLE "payment_records";
ALTER TABLE "new_payment_records" RENAME TO "payment_records";
CREATE UNIQUE INDEX "payment_records_reference_key" ON "payment_records"("reference");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");
