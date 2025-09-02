'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Check } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { UserVerification } from '@/components/auth/user-verification';

interface PaymentData {
  amount: string;
  loyaltyProgram?: {
    name: string;
    discount: number;
    tier: string;
    description: string;
  };
  message: string;
  paymentId: string;
}

function PaymentContent() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  
  // Get payment data from URL params
  const amount = searchParams.get('amount') || '25.00';
  const loyaltyName = searchParams.get('loyaltyName');
  const loyaltyDiscount = searchParams.get('loyaltyDiscount');
  const loyaltyTier = searchParams.get('loyaltyTier');
  const message = searchParams.get('message') || 'Thank you for your purchase!';
  const paymentId = searchParams.get('paymentId') || `PAY_${Date.now()}`;

  const paymentData: PaymentData = {
    amount,
    loyaltyProgram: loyaltyName ? {
      name: loyaltyName,
      discount: parseInt(loyaltyDiscount || '0'),
      tier: loyaltyTier || 'Standard',
      description: 'Loyalty program discount'
    } : undefined,
    message,
    paymentId
  };

  const finalAmount = paymentData.loyaltyProgram
    ? (parseFloat(paymentData.amount) * (1 - paymentData.loyaltyProgram.discount / 100)).toFixed(2)
    : paymentData.amount;

  const handlePayment = () => {
    setIsProcessing(true);
    // Simulate payment processing for testing
    setTimeout(() => {
      setIsProcessing(false);
      setShowSuccess(true);
    }, 3000);
  };

  // Show loading for a brief moment to prevent blank screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading Payment...</p>
            <p className="text-zinc-400 text-sm mt-2">Please wait while we prepare your payment</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-start p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
          <div className="relative w-10 h-10">
            <Image
              src="/logo/verxioIconWhite.svg"
              alt="Verxio"
              width={40}
              height={40}
              className="w-full h-full"
            />
          </div>
        </header>

        {/* Success Content */}
        <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Payment Complete</h3>
                <p className="text-white/80">{paymentData.message}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Tiles rows={50} cols={50} tileSize="md" />
      
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-start p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
          <div className="relative w-10 h-10">
            <Image
              src="/logo/verxioIconWhite.svg"
              alt="Verxio"
              width={40}
              height={40}
              className="w-full h-full"
            />
          </div>
        </header>

        {/* Payment Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
                <p className="text-zinc-400 text-sm">Review your order details</p>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white">Amount:</span>
                    <span className="text-white font-medium">${paymentData.amount}</span>
                  </div>
                  {paymentData.loyaltyProgram && (
                    <>
                      <div className="flex justify-between items-center mb-2">
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
                <button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105"
                >

                  {isProcessing ? (
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      <CreditCard className="w-4 h-4" />
                      Pay
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <UserVerification>
      <Suspense fallback={
        <div className="min-h-screen bg-black relative overflow-hidden">
          <Tiles rows={50} cols={50} tileSize="md" />
          <div className="relative z-10 flex items-center justify-center min-h-screen">
            <div className="text-center">
              <VerxioLoaderWhite size="lg" />
              <p className="text-white mt-4 text-lg">Loading Payment...</p>
              <p className="text-zinc-400 text-sm mt-2">Please wait while we prepare your payment</p>
            </div>
          </div>
        </div>
      }>
        <PaymentContent />
      </Suspense>
    </UserVerification>
  );
} 