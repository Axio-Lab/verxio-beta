"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaymentGenerator } from "./payment-generator";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

type PaymentStep = "generator" | "generating";

interface PaymentFlowProps {
  onClose: () => void;
}

export function PaymentFlow({ onClose }: PaymentFlowProps) {
  const router = useRouter();
  const { user } = usePrivy();
  const [currentStep, setCurrentStep] = useState<PaymentStep>("generator");
  const [paymentData, setPaymentData] = useState<any | null>(null); 
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleGenerate = (data: any) => { 
    setIsTransitioning(true);
    setPaymentData(data);
    
    // Show generating payment step
    setTimeout(() => {
      setCurrentStep("generating");
      setIsTransitioning(false);
      
      // Generate payment immediately
      generatePayment(data);
    }, 300);
  };

  const generatePayment = async (data: any) => { // Changed to any as PaymentData is now imported
    try {
      // Check if user has a wallet
      if (!user?.wallet?.address) {
        throw new Error('No wallet connected');
      }

      // Call the actual API to create a real payment
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientAddress: user.wallet.address,
          amount: data.amount,
          paymentId: data.paymentId,
          message: data.message,
          label: 'Verxio Checkout',
          loyaltyDetails: data.loyaltyDetails
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment');
      }

      const paymentResult = await response.json();
      
      if (!paymentResult.reference) {
        console.error('No reference in payment result:', paymentResult);
        throw new Error('Payment reference not found in response');
      }
      
      // Redirect to the actual payment reference page
      router.push(`/payment/${paymentResult.reference}`);
      
    } catch (error) {
      console.error('Failed to generate payment:', error);
      // Handle error - could show error message and go back to generator
      setCurrentStep("generator");
      
      // Show error to user (you can implement this as needed)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Payment generation failed: ${errorMessage}`);
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (isTransitioning) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1, y: 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ 
          duration: 0.2,
          ease: "easeOut"
        }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <VerxioLoaderWhite size="md" />
              <p className="text-white mt-4 text-lg">Loading...</p>
              <p className="text-zinc-400 text-sm mt-2">Please wait while we prepare the next step</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (currentStep === "generating") {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1, y: 0 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ 
          duration: 0.2,
          ease: "easeOut"
        }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <VerxioLoaderWhite size="lg" />
              <p className="text-white mt-4 text-lg">Generating Payment...</p>
              <p className="text-zinc-400 text-sm mt-2">Please wait while we create your payment link</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ 
        duration: 0.2,
        ease: "easeOut"
      }}
      className="w-full max-w-md relative z-10"
    >
      <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-visible">
        <div className="relative">
          <AnimatePresence mode="wait">
            {currentStep === "generator" && (
              <div key="generator">
                <PaymentGenerator onGenerate={handleGenerate} onClose={handleClose} />
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
} 