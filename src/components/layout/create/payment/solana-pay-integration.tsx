"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppButton } from "@/components/ui/app-button";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

interface LoyaltyProgram {
  id: string;
  name: string;
  discount: number;
  tier: string;
  description: string;
}

interface PaymentData {
  amount: string;
  loyaltyProgram?: LoyaltyProgram;
  message: string;
  paymentId: string;
}

interface SolanaPayIntegrationProps {
  paymentData: PaymentData;
  onBack: () => void;
}

export default function SolanaPayIntegration({ paymentData, onBack }: SolanaPayIntegrationProps) {
  const { user } = usePrivy();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 SolanaPayIntegration mounted with payment data:', paymentData);
  }, [paymentData]);

  const handleGeneratePayment = async () => {
    if (!user?.wallet?.address) {
      setError('Please connect your wallet first');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientAddress: user.wallet.address,
          amount: paymentData.amount,
          label: 'Verxio Checkout',
          message: paymentData.message,
          memo: `Payment for ${paymentData.paymentId}`,
          paymentId: paymentData.paymentId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🎉 Payment generated successfully:', result);

      // Redirect to the payment page with the reference
      router.push(`/payment/${result.reference}`);

    } catch (err) {
      console.error('❌ Error generating payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate payment');
    } finally {
      setIsGenerating(false);
    }
  };

  const finalAmount = paymentData.loyaltyProgram
    ? (parseFloat(paymentData.amount) * (1 - paymentData.loyaltyProgram.discount / 100)).toFixed(2)
    : paymentData.amount;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="relative">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Solana Pay Integration</h2>
          <p className="text-zinc-400 text-sm">Generate a payment link for your customer</p>
        </div>

        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="p-4 bg-black/20 rounded-lg border border-white/10">
            <h3 className="text-white font-medium mb-3">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white">Amount:</span>
                <span className="text-white font-medium">${paymentData.amount}</span>
              </div>
              {paymentData.loyaltyProgram && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-sm">{paymentData.loyaltyProgram.name}:</span>
                    <span className="text-green-400 text-sm">-{paymentData.loyaltyProgram.discount}%</span>
                  </div>
                  <hr className="border-white/10 my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Final Amount:</span>
                    <span className="text-white font-bold">${finalAmount}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Loyalty Program Info */}
          {paymentData.loyaltyProgram && (
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 bg-yellow-400 rounded-full"></div>
                <span className="text-white font-medium">{paymentData.loyaltyProgram.name}</span>
              </div>
              <p className="text-zinc-400 text-sm">{paymentData.loyaltyProgram.description}</p>
              <div className="mt-2 text-sm">
                <span className="text-zinc-400">Tier: </span>
                <span className="text-white">{paymentData.loyaltyProgram.tier}</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <AppButton
              onClick={handleGeneratePayment}
              disabled={isGenerating || !user?.wallet?.address}
              className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
            >
              {isGenerating ? (
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Generating Payment...
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <span>Generate Payment Link</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </AppButton>

            <AppButton
              variant="secondary"
              onClick={onBack}
              className="w-full"
            >
              <div className="flex items-center gap-2 justify-center">
                <ArrowLeft className="w-4 h-4" />
                Back
              </div>
            </AppButton>
          </div>

          {/* Wallet Status */}
          {!user?.wallet?.address && (
            <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-sm text-center">
                Please connect your wallet to generate payments
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
} 