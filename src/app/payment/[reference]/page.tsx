"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Copy, Check, Clock } from "lucide-react";
import { QRCodeSVG } from 'qrcode.react';
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { CloseButton } from "@/components/ui/close-button";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { updatePaymentStatus } from '@/app/actions/payment';
import { UserVerification } from '@/components/auth/user-verification';
import "react-toastify/dist/ReactToastify.css";

interface PaymentData {
  reference: string;
  recipient: string;
  amount: string;
  message: string;
  memo: string;
  createdAt: string;
}

interface VerificationResult {
  success: boolean;
  verified: boolean;
  reference: string;
  amount?: string;
  status?: string;
  signature?: string;
  recipient?: string;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
}

export default function PaymentPage({ params }: { params: Promise<{ reference: string }> }) {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<'waiting' | 'verifying' | 'completed' | 'failed'>('waiting');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [copied, setCopied] = useState(false);
  const [expirationCountdown, setExpirationCountdown] = useState(300); // 5 minutes in seconds
  const [isExpired, setIsExpired] = useState(false);
  const [expirationTime, setExpirationTime] = useState<number>(0);
  const router = useRouter();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expirationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef(true);
  const routerRef = useRef(router);
  const paymentReferenceRef = useRef<string>('');

  // Update router ref when router changes
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const handleCopyLink = async () => {
    if (paymentData?.reference) {
      const paymentLink = `${window.location.origin}/pay/${paymentData.reference}`;
      try {
        await navigator.clipboard.writeText(paymentLink);
        setCopied(true);
        toast.success("Payment link copied!", {
          position: "top-right",
          autoClose: 3000,
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error("Failed to copy link", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    }
  };

  const startExpirationTimer = useCallback(() => {
    if (expirationIntervalRef.current) {
      clearInterval(expirationIntervalRef.current);
    }

    // Set expiration time to 5 minutes from now
    const now = Date.now();
    const expiresAt = now + (5 * 60 * 1000); // 5 minutes in milliseconds
    setExpirationTime(expiresAt);
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeLeft = Math.max(0, Math.ceil((expiresAt - currentTime) / 1000));
      setExpirationCountdown(timeLeft);
              if (timeLeft <= 0) {
          // Payment expired, update status to CANCELLED
          handlePaymentExpiration();
          clearInterval(interval);
          expirationIntervalRef.current = null;
        }
    }, 1000);

    expirationIntervalRef.current = interval;
  }, []);

  const handlePaymentExpiration = async () => {

    // Get reference from ref first, fallback to paymentData
    const reference = paymentReferenceRef.current || paymentData?.reference;
    
    if (!reference) {
      console.error('No payment reference available for expiration!');
      toast.error('Payment reference not found', {
        position: "top-right",
        autoClose: 3000,
      });
      // Still redirect even if we can't update status
      setTimeout(() => {
        routerRef.current.push('/dashboard');
      }, 3000);
      return;
    }
    
    try {
      // Update payment status to CANCELLED BEFORE changing any state
      const updateResult = await updatePaymentStatus(reference, {
        status: 'CANCELLED'
      });

      if (updateResult.success) {
        toast.success('Payment link expired and cancelled', {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        console.error('Failed to update expired payment status:', updateResult.error);
        toast.error('Failed to update payment status', {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error('Error updating expired payment status:', error);
      toast.error('Error updating payment status', {
        position: "top-right",
        autoClose: 3000,
      });
    }

    // Only after API call is complete, update the UI state
    setIsExpired(true);
    stopPolling();

    // Redirect to dashboard after 3 seconds
    setTimeout(() => {
      routerRef.current.push('/dashboard');
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const startPaymentMonitoring = useCallback(async (payment: PaymentData) => {    
    // Reset the polling flag to true
    isPollingActive.current = true;
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    const interval = setInterval(async () => {
      
      // Check if polling should be stopped
      if (!isPollingActive.current) {
        clearInterval(interval);
        return;
      }

      try {
        setVerificationStatus('verifying');
        
        const { verifyPayment } = await import('@/app/actions/payment');
        const result = await verifyPayment(payment.reference);
        
        if (result.success && result.verified && result.reference) {
          setVerificationStatus('completed');
          setVerificationResult(result as VerificationResult);
          isPollingActive.current = false;
          clearInterval(interval);
          
          // Stop expiration timer when payment is completed
          if (expirationIntervalRef.current) {
            clearInterval(expirationIntervalRef.current);
          }
          
          // Payment verification completed successfully
          
          // Start countdown
          let secondsLeft = 5;
          const countdownInterval = setInterval(() => {
            secondsLeft -= 1;
            setCountdown(secondsLeft);
            
            if (secondsLeft <= 0) {
              clearInterval(countdownInterval);
              routerRef.current.push('/dashboard');
            }
          }, 1000);
          
        } else {
          setVerificationStatus('waiting');
        }
        
      } catch (err) {
        console.error('Error checking payment status:', err);
        setVerificationStatus('waiting');
      }
    }, 5000);
    
    pollingIntervalRef.current = interval;
  }, []); // Remove router dependency to prevent recreation

  const stopPolling = useCallback(() => {
    isPollingActive.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (expirationIntervalRef.current) {
      clearInterval(expirationIntervalRef.current);
      expirationIntervalRef.current = null;
    }
  }, []);

  const handleClose = async () => {
    // Get reference from ref first, fallback to paymentData
    const reference = paymentReferenceRef.current || paymentData?.reference;
    
    if (!reference) {
      console.error('No payment reference available for close!');
      // Still redirect even if we can't update status
      stopPolling();
      routerRef.current.push('/create/payment');
      return;
    }
    
    try {
      // Update payment status to CANCELLED
      const updateResult = await updatePaymentStatus(reference, {
        status: 'CANCELLED'
      });

      if (!updateResult.success) {
        console.error('Failed to update payment status:', updateResult.error);
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
    } finally {
      // Always stop polling and navigate away, regardless of status update success
      stopPolling();
      routerRef.current.push('/create/payment');
    }
  };

  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        const resolvedParams = await params;
        const ref = resolvedParams.reference;
        const { getPaymentByReference } = await import('@/app/actions/payment');
        const result = await getPaymentByReference(ref);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch payment');
        }
        
        const data = result.payment;
        setPaymentData(data);
        
        // Store reference in ref to prevent it from becoming undefined
        if (data && data.reference) {
          paymentReferenceRef.current = data.reference;
        }
        
        setIsLoading(false);
        
        if (data) {
          // Start expiration timer immediately
          startExpirationTimer();
          
          // Immediate check for payments that might have been made while page was loading
          setTimeout(() => {
            startPaymentMonitoring(data);
          }, 1000); // Wait 1 second then start monitoring
        }
        
      } catch (err) {
        console.error('Error fetching payment data:', err);
        setError('Failed to load payment details');
        setIsLoading(false);
      }
    };
    
    fetchPaymentData();

    // Cleanup function to stop polling when component unmounts
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (expirationIntervalRef.current) {
        clearInterval(expirationIntervalRef.current);
        expirationIntervalRef.current = null;
      }
      isPollingActive.current = false;
    };
  }, [params]); // Remove startPaymentMonitoring from dependencies

  // Handle tab visibility changes to check expiration when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && expirationTime > 0) {
        const currentTime = Date.now();
        const timeLeft = Math.max(0, Math.ceil((expirationTime - currentTime) / 1000));
        
        setExpirationCountdown(timeLeft);
        
        if (timeLeft <= 0 && !isExpired) {
          handlePaymentExpiration();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [expirationTime, isExpired]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <VerxioLoaderWhite size="lg" />
          <p className="text-white mt-4 text-lg">Loading Payment...</p>
          <p className="text-zinc-400 text-sm mt-2">Please wait while we fetch your payment details</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Error</h2>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <button onClick={() => routerRef.current.push('/dashboard')} className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-white transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-400 text-2xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Payment Not Found</h2>
          <p className="text-zinc-400 text-sm mb-6">The payment reference could not be found</p>
          <button onClick={() => routerRef.current.push('/dashboard')} className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded text-white transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-black border border-red-500/30 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Payment Link Expired</h3>
                <p className="text-white/80">This payment link has expired and is no longer valid.</p>
                
                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-red-400 text-sm">
                    Payment links expire after 5 minutes for security reasons.
                  </p>
                </div>
                
                <div className="pt-4">
                  <p className="text-zinc-400 text-sm mt-2">
                    Redirecting to dashboard in 3 seconds...
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (verificationStatus === 'completed' && verificationResult) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              {/* <CloseButton onClick={() => routerRef.current.push('/dashboard')} />
               */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Payment Received</h3>
                <p className="text-white/80">You&apos;ve received payment for this purchase!</p>
                
                <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white">Amount:</span>
                    <span className="text-white font-medium">{verificationResult.amount} USDC</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-white">Transaction:</span>
                    <span className="text-white font-mono text-sm truncate max-w-32">
                      {verificationResult.signature?.slice(0, 8)}...{verificationResult.signature?.slice(-8)}
                    </span>
                  </div>
                  {/* Payment verification completed successfully */}
                </div>
                
                <div className="pt-4">
                  <p className="text-zinc-400 text-sm mt-2">
                    You will be redirected to the dashboard in <span className="text-white font-medium">{countdown}</span> seconds...
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <UserVerification>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
      
      <div className="min-h-screen bg-black flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              <CloseButton onClick={handleClose} className="absolute -top-3 -right-2"/>
              
              {/* Original Checkout Interface */}
              <div className="original-checkout space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Waiting for Payment</h2>
                  <p className="text-zinc-400 text-sm">Scan the QR code to complete your payment</p>
                </div>

                {/* Expiration Timer */}
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <span className="text-orange-400 text-xs font-medium">Payment link expires in</span>
                    <span className="text-lg font-bold text-orange-400 font-mono">
                      {formatTime(expirationCountdown)}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex justify-center">
                    <QRCodeSVG 
                      value={`${window.location.origin}/pay/${paymentData.reference}`}
                      size={200} 
                      className="mx-auto w-48 h-48 sm:w-52 sm:h-52"
                      bgColor="transparent"
                      fgColor="white"
                    />
                  </div>
                  
                  <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white text-sm">Amount:</span>
                      <span className="text-white font-medium text-sm">{paymentData.amount} USDC</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white text-sm">Fees (0.5%):</span>
                      <span className="text-white font-medium text-sm">{(parseFloat(paymentData.amount) * 0.005).toFixed(4)} USDC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white text-sm">Payment Ref:</span>
                      <span className="text-white font-mono text-xs truncate max-w-32">
                        {paymentData.reference.slice(0, 8)}...{paymentData.reference.slice(-8)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Copy Payment Link Section */}
                  <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-700/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white text-sm font-medium">Payment Link</span>
                      <button
                        onClick={handleCopyLink}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                          copied
                            ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                            : 'bg-zinc-800/50 text-zinc-300 border border-zinc-600/50 hover:bg-zinc-700/50 hover:text-white'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy Link
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-zinc-400 text-xs font-mono bg-black/30 p-2 rounded border border-zinc-700/30 break-all">
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${paymentData.reference}`}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-3">
                    {verificationStatus === 'verifying' ? (
                      <>
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        <span className="text-blue-400 text-sm">Checking payment status...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                        <span className="text-blue-400 text-sm">Waiting for payment...</span>
                      </>
                    )}
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className="text-zinc-400 text-xs">
                      We&apos;ll automatically detect when payment is sent
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </UserVerification>
  );
} 