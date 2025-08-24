-- CreateIndex
CREATE INDEX "LoyaltyPass_programAddress_idx" ON "public"."LoyaltyPass"("programAddress");

-- CreateIndex
CREATE INDEX "LoyaltyPass_recipient_idx" ON "public"."LoyaltyPass"("recipient");

-- CreateIndex
CREATE INDEX "LoyaltyPass_recipient_programAddress_idx" ON "public"."LoyaltyPass"("recipient", "programAddress");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_creator_idx" ON "public"."LoyaltyProgram"("creator");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_programPublicKey_idx" ON "public"."LoyaltyProgram"("programPublicKey");

-- CreateIndex
CREATE INDEX "loyalty_program_claim_status_programAddress_idx" ON "public"."loyalty_program_claim_status"("programAddress");

-- CreateIndex
CREATE INDEX "payment_records_recipient_idx" ON "public"."payment_records"("recipient");

-- CreateIndex
CREATE INDEX "payment_records_status_idx" ON "public"."payment_records"("status");

-- CreateIndex
CREATE INDEX "payment_records_createdAt_idx" ON "public"."payment_records"("createdAt");

-- CreateIndex
CREATE INDEX "payment_records_loyaltyProgramAddress_idx" ON "public"."payment_records"("loyaltyProgramAddress");

-- CreateIndex
CREATE INDEX "referrals_referrerId_idx" ON "public"."referrals"("referrerId");

-- CreateIndex
CREATE INDEX "referrals_referredUserId_idx" ON "public"."referrals"("referredUserId");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "public"."referrals"("status");

-- CreateIndex
CREATE INDEX "referrals_createdAt_idx" ON "public"."referrals"("createdAt");

-- CreateIndex
CREATE INDEX "transfer_records_senderWalletAddress_idx" ON "public"."transfer_records"("senderWalletAddress");

-- CreateIndex
CREATE INDEX "transfer_records_recipientWalletAddress_idx" ON "public"."transfer_records"("recipientWalletAddress");

-- CreateIndex
CREATE INDEX "transfer_records_status_idx" ON "public"."transfer_records"("status");

-- CreateIndex
CREATE INDEX "transfer_records_createdAt_idx" ON "public"."transfer_records"("createdAt");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_walletAddress_idx" ON "public"."users"("walletAddress");

-- CreateIndex
CREATE INDEX "users_referralCode_idx" ON "public"."users"("referralCode");

-- CreateIndex
CREATE INDEX "verxio_credit_history_creator_idx" ON "public"."verxio_credit_history"("creator");

-- CreateIndex
CREATE INDEX "verxio_credit_history_createdAt_idx" ON "public"."verxio_credit_history"("createdAt");

-- CreateIndex
CREATE INDEX "verxio_credits_userAddress_idx" ON "public"."verxio_credits"("userAddress");
