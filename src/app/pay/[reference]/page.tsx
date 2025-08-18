"use client";
import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { toast, ToastContainer } from "react-toastify";
import { motion } from "framer-motion";
import { Loader2, Check } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets, useSendTransaction } from "@privy-io/react-auth/solana";
import { useParams } from "next/navigation";
import { Tiles } from "@/components/layout/backgroundTiles";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { Transaction, Connection } from "@solana/web3.js";
import { checkUserLoyaltyProgramMembership } from "@/app/actions/loyalty";
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
      };
    };
    selectedTier?: string;
    selectedDiscount?: string;
  } | null>(null);
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);

  const loadData = useCallback(
    async () => {
      setIsLoading(true);
      try {
        console.log("loading data", params.reference);
        const res = await fetch(`${BASE_URL}/api/payment?reference=${params.reference}`);
        if (!res.ok) {
          console.log("Failed to fetch payment data");
          setIsLoading(false);
          return;
        }
  
        const response = await res.json();
        setData(response);
  
      } catch (err) {
        console.log("failed", err);
      }
  
      setIsLoading(false);
    },
    [params.reference, BASE_URL]
  );

  const checkLoyaltyMembership = useCallback(async () => {
    if (!user?.wallet?.address || !data?.loyaltyProgramAddress) {
      return;
    }

    setIsCheckingLoyalty(true);
    try {
      const result = await checkUserLoyaltyProgramMembership(
        user.wallet.address,
        data.loyaltyProgramAddress
      );
      
      if (result.success) {
        setLoyaltyMembership({
          isMember: result.isMember || false,
          membershipData: result.membershipData ? {
            assetId: result.membershipData.assetId || '',
            xp: result.membershipData.xp || 0,
            currentTier: result.membershipData.currentTier || '',
            rewards: result.membershipData.rewards || [],
            loyaltyProgram: result.membershipData.loyaltyProgram ? {
              address: result.membershipData.loyaltyProgram.address || '',
              name: result.membershipData.loyaltyProgram.name || '',
              tiers: result.membershipData.loyaltyProgram.tiers || []
            } : undefined
          } : undefined,
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

  // Check loyalty membership when user connects wallet or data changes
  useEffect(() => {
    if (authenticated && user?.wallet?.address && data?.loyaltyProgramAddress) {
      checkLoyaltyMembership();
    }
  }, [authenticated, user?.wallet?.address, data?.loyaltyProgramAddress, checkLoyaltyMembership]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    
    try {
      if (!data || !data.recipient) {
        console.log("Recipient wallet address is missing");
        setIsLoading(false);
        setTransactionStatus("failed");
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

      console.log(finalAmount);
      // Step 1: Get transaction from backend with updated amount
      const txResponse = await fetch('/api/payment/build-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: data.reference,
          amount: finalAmount.toString(),
          recipient: data.recipient,
          userWallet: user.wallet.address
        })
      });

      if (!txResponse.ok) {
        throw new Error('Failed to build transaction');
      }

      const { transaction: serializedTx, connection: connectionConfig } = await txResponse.json();

      // Step 2: User signs and sends transaction using Privy Solana wallet
      const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));
      
      // Sign and send transaction using Privy (automatically sends to blockchain)
      if (!wallets || wallets.length === 0) {
        throw new Error('No Solana wallets available');
      }

      const result = await sendTransaction({
        transaction: transaction,
        connection: new Connection(connectionConfig.endpoint, 'finalized'),
        address: wallets[0].address
      });


      // Step 3: Update payment status to success in database
      if (data?.reference) {
        try {
          await fetch(`/api/payment/${data.reference}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              status: "SUCCESS",
              signature: result.signature 
            }),
          });
        } catch (error) {
          console.error("Failed to update payment status:", error);
          // Don't fail the payment if status update fails
        }
      }
      
      setIsProcessing(false);
      setTransactionStatus("success");
      setTransactionSignature(result.signature);
      const discountMessage = loyaltyMembership?.selectedDiscount 
        ? ` with ${loyaltyMembership.selectedDiscount} discount applied`
        : '';
      
      toast.success(`Payment successful! Signature: ${result.signature.slice(0, 8)}...${discountMessage}`);
      
      return { success: true };

    } catch (err) {
      setIsProcessing(false);
      setTransactionStatus("failed");
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
              </div>
              
              <div className="pt-4 space-y-3">
                
                {/* Action Buttons */}
                <div className="flex justify-center gap-3">
                  <a
                    href={`https://explorer.solana.com/tx/${data?.signature || transactionSignature}?cluster=devnet`}
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
                        {loyaltyMembership.membershipData.loyaltyProgram.tiers.map((tier: any) => {
                          const isEligible = loyaltyMembership.membershipData!.xp >= tier.xpRequired;
                          return (
                            <SelectItem 
                              key={tier.name} 
                              value={tier.name} 
                              className={`text-white ${!isEligible ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={!isEligible}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{tier.name}: {tier.rewards[0]}</span>
                                <span className="text-xs text-gray-300">
                                  {/* {tier.xpRequired.toLocaleString()} XP required */}
                                  {!isEligible && ` - Need ${(tier.xpRequired - loyaltyMembership.membershipData!.xp).toLocaleString()} more XP`}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-500/20 rounded-lg border border-gray-500/30">
                <div className="text-center">
                  <div className="text-gray-400 font-semibold text-lg">No Loyalty Program</div>
                  <div className="text-gray-300 text-sm">This payment is not associated with a loyalty program</div>
                </div>
              </div>
            )}

            {/* Rewards Section */}
            <div className="p-4 bg-gradient-to-r from-[#00adef]/20 to-purple-500/20 rounded-lg border border-[#00adef]/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-lg">🎁 Earn Rewards</div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-2xl">100</div>
                  <div className="text-[#00adef] text-xs">Verxio Points</div>
                </div>
              </div>
            </div>
            
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
                  className={`font-light rounded-[8px] justify-center items-center flex text-[14px] text-white bg-[#00adef] py-[10px] w-full cursor-pointer hover:opacity-80 transition-opacity gap-3`}
                  onClick={CreateTransfer}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Pay Now"
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