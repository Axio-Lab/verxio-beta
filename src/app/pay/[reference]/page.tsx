"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets, useSendTransaction } from "@privy-io/react-auth/solana";
import { useParams } from "next/navigation";
import { Tiles } from "@/components/layout/backgroundTiles";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";

import { Transaction, Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { awardLoyaltyPointsAfterPurchase, checkUserLoyaltyMembership, fetchLoyaltyProgramDetails } from "./loyalty-actions";
import { updatePaymentStatus, sponsorTransaction } from "@/app/actions/payment";
import { getUserStats } from "@/app/actions/stats";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import "react-toastify/dist/ReactToastify.css";

interface PaymentData {
  reference: string;
  recipient: string;
  amount: string;
  status?: string;
  signature?: string;
  message: string;
  memo: string;
  createdAt: string;
  loyaltyProgramAddress?: string;
  loyaltyProgramName?: string;
  loyaltyDiscount?: string;
}

const Page = () => {
  const { login, authenticated, user, ready, logout } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();
  const params = useParams();
  const [data, setData] = useState<PaymentData | null>(null);
  const BASE_URL = typeof window !== "undefined" ? window.location.origin : "";
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [transactionSignature, setTransactionSignature] = useState<string>("");
  const [isSponsored, setIsSponsored] = useState<boolean>(false);
  const [paymentStep, setPaymentStep] = useState<string>('');
  const [loyaltyMembership, setLoyaltyMembership] = useState<{
    isMember: boolean;
    membershipData?: {
      assetId: string;
      xp: number;
      currentTier: string;
      rewards: string[];
      loyaltyProgram?: {
        address: string;
        name: string;
        tiers: Array<{
          name: string;
          xpRequired: number;
          rewards: string[];
        }>;
        pointsPerAction: Record<string, number>;
      };
    };
    selectedTier?: string;
    selectedDiscount?: string;
  } | null>(null);
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);
  const [loyaltyProgramDetails, setLoyaltyProgramDetails] = useState<{
    name: string;
    pointsPerAction: Record<string, number>;
  } | null>(null);
  const [userBalance, setUserBalance] = useState<string>('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(true);
  const statusCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(
    async () => {
      setIsLoading(true);
      try {
        const { getPaymentByReference } = await import('@/app/actions/payment');
        const result = await getPaymentByReference(params.reference as string);
        if (!result.success) {
          console.log("Failed to fetch payment data:", result.error);
          setIsLoading(false);
          return;
        }

        setData(result.payment);

      } catch (err) {
        console.log("failed", err);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    },
    [params.reference, BASE_URL]
  );

  const checkLoyaltyMembership = useCallback(async () => {
    if (!user?.wallet?.address || !data?.loyaltyProgramAddress) {
      return;
    }

    setIsCheckingLoyalty(true);
    try {
      const result = await checkUserLoyaltyMembership(
        user.wallet.address,
        data.loyaltyProgramAddress
      );

      if (result.success) {
        setLoyaltyMembership({
          isMember: result.isMember || false,
          membershipData: result.membershipData,
          selectedTier: undefined,
          selectedDiscount: undefined
        });
      }
    } catch (error) {
      console.error('Error checking loyalty membership:', error);
    } finally {
      setIsCheckingLoyalty(false);
    }
  }, [user?.wallet?.address, data?.loyaltyProgramAddress]);

  const loadLoyaltyProgramDetails = useCallback(async () => {
    if (!data?.loyaltyProgramAddress) {
      return;
    }

    try {
      // Use extracted function to fetch loyalty program details
      const result = await fetchLoyaltyProgramDetails(data.loyaltyProgramAddress);
      if (result.success && result.data) {
        setLoyaltyProgramDetails({
          name: result.data.name,
          pointsPerAction: result.data.pointsPerAction
        });
      } else {
        console.error('Failed to fetch loyalty program details:', result.error);
      }
    } catch (error) {
      console.error('Error fetching loyalty program details:', error);
    }
  }, [data?.loyaltyProgramAddress]);

  const fetchUserBalance = useCallback(async () => {
    if (!user?.wallet?.address) return;

    try {
      setIsLoadingBalance(true);
      const result = await getUserStats(user.wallet.address);
      
      if (result.success && result.stats) {
        setUserBalance(result.stats.usdcBalance);
      }
    } catch (error) {
      console.error('Error fetching user balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [user?.wallet?.address]);


  // Check loyalty membership when user connects wallet or data changes
  useEffect(() => {
    if (authenticated && user?.wallet?.address && data?.loyaltyProgramAddress) {
      checkLoyaltyMembership();
    }
  }, [authenticated, user?.wallet?.address, data?.loyaltyProgramAddress, checkLoyaltyMembership]);

  // Fetch user balance when user connects wallet
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      fetchUserBalance();
    }
  }, [authenticated, user?.wallet?.address, fetchUserBalance]);

  // Fetch loyalty program details when data changes
  useEffect(() => {
    if (data?.loyaltyProgramAddress) {
      loadLoyaltyProgramDetails();
    }
  }, [data?.loyaltyProgramAddress, loadLoyaltyProgramDetails]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Monitor payment status changes in real-time
  useEffect(() => {
    if (!data?.reference) return;

    const checkStatusInterval = setInterval(async () => {
      try {
        const { getPaymentByReference } = await import('@/app/actions/payment');
        const result = await getPaymentByReference(data.reference);
        if (result.success) {
          const updatedData = result.payment;
          if (updatedData.status !== data.status) {
            setData(updatedData);

            // If payment was cancelled, show immediate feedback
            if (updatedData.status === 'CANCELLED') {
              toast.info('Payment has been cancelled', {
                position: "top-right",
                autoClose: 3000,
                theme: "dark",
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkStatusInterval);
  }, [data?.reference, data?.status, BASE_URL]);

  // Check status when user becomes active (clicks, scrolls, etc.)
  useEffect(() => {
    if (!data?.reference) return;

    const handleUserActivity = () => {
      // Debounce the status check to avoid too many API calls
      if (statusCheckTimeout.current) {
        clearTimeout(statusCheckTimeout.current);
      }
      statusCheckTimeout.current = setTimeout(async () => {
        try {
          const { getPaymentByReference } = await import('@/app/actions/payment');
          const result = await getPaymentByReference(data.reference);
          if (result.success) {
            const updatedData = result.payment;
            if (updatedData.status !== data.status) {
              setData(updatedData);
            }
          }
        } catch (error) {
          console.error('Error checking payment status on user activity:', error);
        }
      }, 1000); // Wait 1 second after user activity
    };

    // Listen for user interactions
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);

    return () => {
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      if (statusCheckTimeout.current) {
        clearTimeout(statusCheckTimeout.current);
      }
    };
  }, [data?.reference, data?.status, BASE_URL]);

  const CreateTransfer = async () => {
    if (!authenticated || !user?.wallet?.address) {
      toast.error("Please connect your wallet.");
      return;
    }

    // Prevent multiple clicks
    if (isProcessing) {
      toast.warning("Payment already in progress. Please wait...");
      return;
    }

    setIsProcessing(true);
    setTransactionStatus("pending");
    setPaymentStep("Initializing payment...");

    try {
      if (!data || !data.recipient) {
        setIsLoading(false);
        setTransactionStatus("failed");
        setPaymentStep("");
        return;
      }

      // Calculate final amount with loyalty discount
      let finalAmount = parseFloat(data.amount);
      let discountAmount = 0;

      if (loyaltyMembership?.selectedDiscount) {
        const discountText = loyaltyMembership.selectedDiscount;
        if (discountText.includes('%')) {
          const percentage = parseFloat(discountText.replace('%', ''));
          discountAmount = finalAmount * (percentage / 100);
        } else if (discountText.includes('$')) {
          discountAmount = parseFloat(discountText.replace('$', ''));
        }
        finalAmount = Math.max(0, finalAmount - discountAmount);
      }

      // Step 1: Get transaction from backend with updated amount
      const { buildPaymentTransaction } = await import('@/app/actions/payment');
      const buildResult = await buildPaymentTransaction({
        reference: data.reference,
        amount: finalAmount.toString(),
        recipient: data.recipient,
        userWallet: user.wallet.address
      });

      if (!buildResult.success || !buildResult.transaction) {
        throw new Error(buildResult.error || 'Failed to build transaction');
      }

      const { transaction: serializedTx, connection: connectionConfig, sponsored } = buildResult;
      setIsSponsored(sponsored || false);
      let result;

      if (sponsored) {
        // For sponsored transactions, user signs their part, then backend adds fee payer signature
        const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

        if (!wallets || wallets.length === 0) {
          throw new Error('No Solana wallets available');
        }

        // For sponsored transactions, we need to sign the message, not the full transaction
        // First, convert to VersionedTransaction and get the message
        const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
        
        // Serialize the message for signing
        const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
        
        // Sign the message with the user's wallet
        const { signMessage } = wallets[0];
        const serializedUserSignature = await signMessage(serializedMessage);
        
        // Add user signature to transaction
        versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
        
        // Serialize the partially signed transaction
        const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

        // Send to backend for fee payer signature and broadcasting
        const sponsorResult = await sponsorTransaction({
          reference: data.reference,
          transaction: serializedUserSignedTx
        });

        if (!sponsorResult.success) {
          throw new Error(sponsorResult.error || 'Failed to sponsor transaction');
        }

        result = { signature: sponsorResult.signature || '' };
      } else {
        // Regular transaction: User pays fees
        const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

        // Sign and send transaction using Privy (automatically sends to blockchain)
        if (!wallets || wallets.length === 0) {
          throw new Error('No Solana wallets available');
        }

        result = await sendTransaction({
          transaction: transaction,
          connection: new Connection(connectionConfig.endpoint, 'confirmed'),
          address: wallets[0].address
        });
      }

      // Step 3: Update payment status to success in database
      setPaymentStep("Updating payment status...");
      if (data?.reference) {
        try {
          // Calculate discount amount for database storage
          let discountAmountForDB = "0";
          if (loyaltyMembership?.selectedDiscount) {
            const discountText = loyaltyMembership.selectedDiscount;
            if (discountText.includes('%')) {
              const percentage = parseFloat(discountText.replace('%', ''));
              discountAmountForDB = (parseFloat(data.amount) * (percentage / 100)).toString();
            } else if (discountText.includes('$')) {
              discountAmountForDB = discountText.replace('$', '');
            }
          }

          // Use server action instead of API route
          const updateResult = await updatePaymentStatus(data.reference, {
            status: "SUCCESS",
            signature: result.signature,
            loyaltyDiscount: discountAmountForDB,
            amount: finalAmount.toString()
          });

          if (!updateResult.success) {
            console.error("Failed to update payment status:", updateResult.error);
          }
        } catch (error) {
          console.error("Failed to update payment status:", error);
          // Don't fail the payment if status update fails
        }
      }

      // Step 4: Award loyalty points if loyalty program exists
      if (data?.loyaltyProgramAddress && user?.wallet?.address) {
        setPaymentStep("Awarding loyalty points...");
        try {
          const loyaltyResult = await awardLoyaltyPointsAfterPurchase(
            user.wallet.address,
            data.loyaltyProgramAddress,
            parseFloat(data.amount)
          );

          if (loyaltyResult.success) {
            toast.success(loyaltyResult.message, {
              position: "top-right",
              autoClose: 5000,
              theme: "dark",
            });
          } else {
            console.warn('Loyalty points award failed:', loyaltyResult.error);
            // Don't fail the payment if loyalty award fails
          }
        } catch (error) {
          console.error("Failed to award loyalty points:", error);
          // Don't fail the payment if loyalty award fails
        }
      }

      setIsProcessing(false);
      setTransactionStatus("success");
      setTransactionSignature(result.signature || '');
      setPaymentStep("");
      const discountMessage = loyaltyMembership?.selectedDiscount
        ? ` with ${loyaltyMembership.selectedDiscount} discount applied`
        : '';

      toast.success(`Payment successful! Signature: ${result.signature.slice(0, 8)}...${discountMessage}`);

      return { success: true };

    } catch (err) {
      setIsProcessing(false);
      setTransactionStatus("failed");
      setPaymentStep("");
      toast.error("Payment failed. Please try again.");
      console.error("Payment failed:", err);
      return { error: "Transaction failed." };
    }
  };

  const handleConnectWallet = async () => {
    if (!ready) return;

    if (authenticated) {
      // Logout first to show wallet selection
      await logout();
      window.location.reload();
      toast.info("Please select a new wallet", {
        position: "top-right",
        autoClose: 3000,
        theme: "dark",
      });
      // Show wallet selection modal
      login();
    } else {
      login();
    }
  };


  if (isLoading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 text-center">
          <VerxioLoaderWhite size="lg" />
          <p className="text-white mt-4 text-lg">Loading Payment...</p>
          <p className="text-zinc-400 text-sm mt-2">Please wait while we fetch your payment details</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Payment Not Found</h2>
          <p className="text-gray-300 text-sm">The payment reference could not be found</p>
        </div>
      </main>
    );
  }

  // Show success page with countdown or when payment is already completed
  if (transactionStatus === "success" || data?.status === "SUCCESS") {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4 pt-20 relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto relative z-10"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {data?.status === "SUCCESS" ? "Payment Completed" : "Payment Successful!"}
              </h3>
              <p className="text-white/80">
                {data?.status === "SUCCESS"
                  ? "This payment has already been processed."
                  : "Your payment has been processed successfully!"
                }
              </p>

              <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Amount:</span>
                  <span className="text-white font-medium">{data.amount} USDC</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Reference:</span>
                  <span className="text-white font-mono text-sm truncate max-w-32">
                    {data.reference.slice(0, 8)}...{data.reference.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white">Recipient:</span>
                  <span className="text-white font-mono text-sm truncate max-w-32">
                    {data.recipient.slice(0, 8)}...{data.recipient.slice(-8)}
                  </span>
                </div>
                {/* Loyalty Points Awarded */}
                {data?.loyaltyProgramAddress && (
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-green-400">Loyalty Points:</span>
                    <span className="text-green-400 font-medium">
                      {(() => {
                        if (loyaltyMembership?.membershipData?.loyaltyProgram?.pointsPerAction) {
                          return loyaltyMembership.membershipData.loyaltyProgram.pointsPerAction.purchase || 0;
                        }
                        if (loyaltyProgramDetails?.pointsPerAction) {
                          return loyaltyProgramDetails.pointsPerAction.purchase || 0;
                        }
                        return 0;
                      })()} points
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3">

                {/* Action Buttons */}
                <div className="flex justify-center gap-3">
                  <a
                    href={`https://solscan.io/tx/${data?.signature || transactionSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00adef]/20 hover:bg-[#00adef]/30 border border-[#00adef]/40 rounded-lg text-[#00adef] text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Explorer
                  </a>


                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    );
  }

  // Show cancelled payment page
  if (data?.status === "CANCELLED") {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center px-4 pt-20 relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mx-auto relative z-10"
        >
          <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <h3 className="text-xl font-bold text-white">Payment Cancelled</h3>
              <p className="text-white/80">This payment has been cancelled and cannot be processed.</p>

              <div className="pt-4 space-y-3">
                <div className="text-center">
                  <p className="text-zinc-400 text-sm mb-4">
                    Request for a new payment link from merchant.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black relative overflow-hidden">
        {/* Background Stars */}
        <Tiles rows={50} cols={50} tileSize="md" />

        {/* Header with Logo */}
        <div className="relative z-20 bg-black/80 backdrop-blur-sm border-b border-white/10 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/logo/verxioIconWhite.svg"
                alt="Verxio Logo"
                width={40}
                height={40}
                className="h-8 w-auto"
              />
            </div>
            {authenticated && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">
                  Wallet: {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
                </span>
                <button
                  onClick={handleConnectWallet}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Switch
                </button>
              </div>
            )}
          </div>
        </div>

      <div className="relative z-10 flex justify-center items-center min-h-[calc(100vh-80px)] flex-col px-[20px] pt-8">
        {/* Payment Details Card */}
        <div className="w-full max-w-[500px] bg-black/50 border border-white/10 rounded-3xl p-6 text-white shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Complete Payment</h2>
          </div>

          <div className="space-y-6">
            {/* Payment Summary */}
            <div className="p-4 bg-black/20 rounded-lg border border-white/10">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-white mb-2">{data.amount} USDC</div>
                <div className="text-sm text-gray-300">Payment Amount</div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-xs">Fee (0.5%):</span>
                  <span className="text-white/70 text-xs">{(parseFloat(data.amount) * 0.005).toFixed(4)} USDC</span>
                </div>

                {/* Loyalty Discount */}
                {loyaltyMembership?.selectedDiscount && (
                  <div className="flex justify-between items-center">
                    <span className="text-green-400 text-xs">Loyalty Discount:</span>
                    <span className="text-green-400 text-xs font-medium">
                      {loyaltyMembership.selectedDiscount}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-white font-medium text-sm">Total You Pay:</span>
                  <span className="text-white font-bold text-lg">
                    {(() => {
                      const baseAmount = parseFloat(data.amount);
                      const fee = baseAmount * 0.005;
                      let discount = 0;

                      if (loyaltyMembership?.selectedDiscount) {
                        const discountText = loyaltyMembership.selectedDiscount;
                        if (discountText.includes('%')) {
                          const percentage = parseFloat(discountText.replace('%', ''));
                          discount = baseAmount * (percentage / 100);
                        } else if (discountText.includes('$')) {
                          discount = parseFloat(discountText.replace('$', ''));
                        }
                      }

                      const finalAmount = baseAmount + fee - discount;
                      return `${Math.max(0, finalAmount).toFixed(4)} USDC`;
                    })()}
                  </span>
                </div>

                {loyaltyMembership?.selectedDiscount && (
                  <div className="text-center pt-2">
                    <div className="text-green-400 text-xs font-medium">
                      You saved {(() => {
                        const discountText = loyaltyMembership.selectedDiscount;
                        if (discountText.includes('%')) {
                          const percentage = parseFloat(discountText.replace('%', ''));
                          return `${percentage}%`;
                        } else if (discountText.includes('$')) {
                          return discountText;
                        }
                        return '0';
                      })()} on this payment!
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Loyalty Program Section */}
            {data.loyaltyProgramAddress ? (
              <div className="space-y-4">


                {/* Membership Status */}
                {isCheckingLoyalty ? (
                  <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                    <div className="flex items-center justify-center space-x-2">
                      <VerxioLoaderWhite size="sm" />
                      <span className="text-white text-sm">Checking your membership...</span>
                    </div>
                  </div>
                ) : loyaltyMembership?.isMember ? (
                  <div className="p-3 bg-green-500/20 rounded-lg border border-green-500/30">
                    <div className="text-center">
                      <div className="text-green-400 font-semibold text-base mb-1">
                        You're a Member!
                      </div>
                      <div className="text-white text-xs">
                        {data.loyaltyProgramName}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                    <div className="text-center">
                      <div className="text-blue-400 font-semibold text-lg mb-2">
                        New Member Bonus!
                      </div>
                      <div className="text-white text-sm">
                        Join this loyalty program and earn future rewards
                      </div>
                    </div>
                  </div>
                )}

                {/* Compact Discount Selection - Only show when loyalty pass exists */}
                {loyaltyMembership?.isMember && loyaltyMembership?.membershipData?.loyaltyProgram?.tiers && loyaltyMembership.membershipData && (
                  <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                    {(() => {
                      const eligibleTiers = loyaltyMembership.membershipData.loyaltyProgram.tiers.filter(
                        (tier: any) => loyaltyMembership.membershipData!.xp >= tier.xpRequired
                      );

                      if (eligibleTiers.length === 0) {
                        return (
                          <div className="text-center py-4">
                            <div className="text-orange-400 font-medium text-sm mb-2">
                              No Discounts Available Yet
                            </div>
                            <div className="text-gray-400 text-xs">
                              You need more verxio points to qualify.
                            </div>
                          </div>
                        );
                      }

                      return (
                        <>
                          <div className="text-center mb-3">
                            <div className="text-white font-medium text-sm">Available Discount</div>
                          </div>

                          <Select
                            value={loyaltyMembership.selectedTier || ''}
                            onValueChange={(value) => {
                              if (value && loyaltyMembership) {
                                const selectedTier = loyaltyMembership.membershipData?.loyaltyProgram?.tiers.find(
                                  (tier: any) => tier.name === value
                                );
                                setLoyaltyMembership({
                                  ...loyaltyMembership,
                                  selectedTier: value,
                                  selectedDiscount: selectedTier?.rewards[0] || 'No discount'
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="bg-black/20 border-white/20 text-white h-12 w-full">
                              <SelectValue placeholder="Choose a discount..." />
                            </SelectTrigger>
                            <SelectContent className="bg-black/90 border-white/20 min-w-[200px]">
                              {eligibleTiers.map((tier: any) => (
                                <SelectItem
                                  key={tier.name}
                                  value={tier.name}
                                  className="text-white"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{tier.name}: {tier.rewards[0]}</span>
                                    <span className="text-xs text-gray-300">
                                      {tier.xpRequired.toLocaleString()} XP required
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-500/20 rounded-lg border border-gray-500/30">
                <div className="text-center">
                  <div className="text-gray-300 text-sm">This payment is not associated with a loyalty program</div>
                </div>
              </div>
            )}

            {/* Rewards Section - Only show when loyalty program exists */}
            {data.loyaltyProgramAddress && (
              <div className="p-4 bg-gradient-to-r from-[#00adef]/20 to-purple-500/20 rounded-lg border border-[#00adef]/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-semibold text-lg">🎁 Earn Rewards</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-2xl">
                      {(() => {
                        if (data.loyaltyProgramAddress) {
                          // If user is a member, get points from their membership data
                          if (loyaltyMembership?.membershipData?.loyaltyProgram?.pointsPerAction) {
                            const pointsPerAction = loyaltyMembership.membershipData.loyaltyProgram.pointsPerAction;
                            return pointsPerAction.purchase || '0';
                          }
                          // If not a member, get points from fetched program details
                          if (loyaltyProgramDetails?.pointsPerAction) {
                            const pointsPerAction = loyaltyProgramDetails.pointsPerAction;
                            return pointsPerAction.purchase || 0;
                          }
                          // Show loading state while fetching program details
                          return (
                            <div className="flex items-center space-x-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Loading...</span>
                            </div>
                          );
                        }
                        return '0';
                      })()}
                    </div>
                    <div className="text-[#00adef] text-xs">
                      Verxio Points
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transaction Details */}
            <div className="p-4 bg-black/20 rounded-lg border border-white/10">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm">Date:</span>
                  <span className="text-white font-medium text-sm">
                    {new Date().toLocaleString("en-US", {
                      weekday: "short",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white text-sm">Recipient:</span>
                  <span className="text-white font-mono text-xs truncate max-w-32">
                    {data.recipient.slice(0, 8)}...{data.recipient.slice(-8)}
                  </span>
                </div>
                {data.memo && (
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">Memo:</span>
                    <span className="text-white font-medium text-sm">{data.memo}</span>
                  </div>
                )}
              </div>
            </div>



            {/* Wallet Connection */}
            <div className="space-y-4">
              {!authenticated ? (
                <button
                  className={`w-full rounded-[8px] justify-center border border-white/20 items-center flex text-[14px] text-white font-medium py-[10px] cursor-pointer hover:bg-white/10 transition-colors gap-3`}
                  onClick={handleConnectWallet}
                >
                  Connect Wallet
                </button>
              ) : (
                <button
                  className={`font-light rounded-[8px] justify-center items-center flex text-[14px] text-white py-[10px] w-full transition-opacity gap-3 ${isProcessing || isCheckingLoyalty || (!!data.loyaltyProgramAddress && !loyaltyProgramDetails) || isLoadingBalance || parseFloat(userBalance) < (() => {
                    const baseAmount = parseFloat(data.amount);
                    const fee = baseAmount * 0.005;
                    let discount = 0;
                    if (loyaltyMembership?.selectedDiscount) {
                      const discountText = loyaltyMembership.selectedDiscount;
                      if (discountText.includes('%')) {
                        const percentage = parseFloat(discountText.replace('%', ''));
                        discount = baseAmount * (percentage / 100);
                      } else if (discountText.includes('$')) {
                        discount = parseFloat(discountText.replace('$', ''));
                      }
                    }
                    return baseAmount + fee - discount;
                  })()
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-[#00adef] cursor-pointer hover:opacity-80'
                    }`}
                  onClick={CreateTransfer}
                  disabled={isProcessing || isCheckingLoyalty || (!!data.loyaltyProgramAddress && !loyaltyProgramDetails) || isLoadingBalance || parseFloat(userBalance) < (() => {
                    const baseAmount = parseFloat(data.amount);
                    const fee = baseAmount * 0.005;
                    let discount = 0;
                    if (loyaltyMembership?.selectedDiscount) {
                      const discountText = loyaltyMembership.selectedDiscount;
                      if (discountText.includes('%')) {
                        const percentage = parseFloat(discountText.replace('%', ''));
                        discount = baseAmount * (percentage / 100);
                      } else if (discountText.includes('$')) {
                        discount = parseFloat(discountText.replace('$', ''));
                      }
                    }
                    return baseAmount + fee - discount;
                  })()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {paymentStep || 'Processing...'}
                    </>
                  ) : isCheckingLoyalty ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking eligible rewards
                    </>
                  ) : (!!data.loyaltyProgramAddress && !loyaltyProgramDetails) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading Program...
                    </>
                  ) : isLoadingBalance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Checking Balance...
                    </>
                  ) : parseFloat(userBalance) < (() => {
                    const baseAmount = parseFloat(data.amount);
                    const fee = baseAmount * 0.005;
                    let discount = 0;
                    if (loyaltyMembership?.selectedDiscount) {
                      const discountText = loyaltyMembership.selectedDiscount;
                      if (discountText.includes('%')) {
                        const percentage = parseFloat(discountText.replace('%', ''));
                        discount = baseAmount * (percentage / 100);
                      } else if (discountText.includes('$')) {
                        discount = parseFloat(discountText.replace('$', ''));
                      }
                    }
                    return baseAmount + fee - discount;
                  })() ? (
                    <>
                      Insufficient Balance
                    </>
                  ) : (
                    <>
                      Pay Now
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="text-center space-y-2">
              <p className="text-zinc-400 text-xs">
                Loyalty rewards will be auto-credited to your account.
              </p>
            </div>
          </div>
        </div>
      </div>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="dark"
        />
      </main>
  );
};

export default Page; 