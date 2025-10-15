'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { LogOut, AlertCircle, Gift, Copy, ExternalLink } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";
import { getRewardLink, claimRewardLink } from '@/app/actions/reward';
import { getVoucherDetails } from '@/lib/voucher/getVoucherDetails';
import { getVoucherIdByAddress, redeemVoucher, cancelVoucher, extendVoucherExpiry } from '@/app/actions/voucher';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { AppButton } from '@/components/ui/app-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createOrUpdateUser } from '@/app/actions/user';

interface RewardDetails {
  id: string;
  slug: string;
  collectionId: string;
  creator: string;
  voucherType: string;
  name: string | null;
  description: string | null;
  value: number | null;
  voucherWorth: number | null;
  symbol: string | null;
  maxUses: number | null;
  expiryDate: Date | null;
  transferable: boolean;
  conditions: string | null;
  imageUri: string | null;
  metadataUri: string | null;
  status: string;
  voucherAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ClaimRewardPage() {
  const params = useParams();
  const { authenticated, ready, user, login, logout } = usePrivy();
  const [rewardDetails, setRewardDetails] = useState<RewardDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [voucherDetails, setVoucherDetails] = useState<any>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Withdraw states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawType, setWithdrawType] = useState<'verxio' | 'external'>('verxio');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [voucherTokenBalance, setVoucherTokenBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showWithdrawSuccess, setShowWithdrawSuccess] = useState(false);
  const [withdrawSignature, setWithdrawSignature] = useState('');
  const [withdrawAmountSuccess, setWithdrawAmountSuccess] = useState(0);
  const [withdrawSymbol, setWithdrawSymbol] = useState('');

  // Modal states for voucher operations
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherModalType, setVoucherModalType] = useState<'redeem' | 'cancel' | 'extend' | null>(null);
  const [voucherOperationLoading, setVoucherOperationLoading] = useState(false);
  const [voucherModalError, setVoucherModalError] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [operationSuccess, setOperationSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Yield earning states
  const [showEarnModal, setShowEarnModal] = useState(false);
  const [earnAmount, setEarnAmount] = useState('');
  const [isEarning, setIsEarning] = useState(false);
  const [earnError, setEarnError] = useState<string | null>(null);
  const [showWithdrawEarnModal, setShowWithdrawEarnModal] = useState(false);
  const [withdrawEarnAmount, setWithdrawEarnAmount] = useState('');
  const [isWithdrawingEarn, setIsWithdrawingEarn] = useState(false);
  const [earnBalance, setEarnBalance] = useState<number | null>(null);
  const [isLoadingEarnBalance, setIsLoadingEarnBalance] = useState(false);
  const [earnSuccess, setEarnSuccess] = useState(false);
  const [earnSuccessMessage, setEarnSuccessMessage] = useState('');

  const rewardId = params.id as string;

  // Fetch reward details on component mount
  useEffect(() => {
    const fetchRewardDetails = async () => {
      if (!rewardId) return;

      try {
        setIsLoading(true);
        setError(null);
        
        const result = await getRewardLink(rewardId);
        if (result.success && result.reward) {
          setRewardDetails(result.reward as RewardDetails);
        } else {
          setError(result.error || 'Reward not found');
        }
      } catch (error) {
        console.error('Error fetching reward details:', error);
        setError('Failed to load reward details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRewardDetails();
  }, [rewardId]);

  // Create/update user when wallet connects
  useEffect(() => {
    const createUserRecord = async () => {
      if (!authenticated || !user?.wallet?.address) return;

      try {
        const result = await createOrUpdateUser({
          walletAddress: user.wallet.address,
          email: user.email?.address,
          name: user.email?.address?.split('@')[0] // Use email prefix as name if no name provided
        });

        if (!result.success) {
          console.error('Failed to create/update user:', result.error);
        }
      } catch (error) {
        console.error('Error creating/updating user:', error);
      }
    };

    createUserRecord();
  }, [authenticated, user?.wallet?.address, user?.email?.address]);

  // Countdown timer for expiry
  useEffect(() => {
    if (!rewardDetails?.expiryDate) {
      setCountdown(null);
      setIsExpired(false);
      return;
    }
    const expiryTs = new Date(rewardDetails.expiryDate as any).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = expiryTs - now;
      if (diff <= 0) {
        setIsExpired(true);
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown({ days, hours, minutes, seconds });
      setIsExpired(false);
    };
    // initial
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [rewardDetails?.expiryDate]);

  // Show splash video for already claimed rewards on page load
  useEffect(() => {
    if (rewardDetails && rewardDetails.status === 'claimed' && !isLoading) {
      setShowSplash(true);
    }
  }, [rewardDetails, isLoading]);

  // Hide splash automatically after it ends or after a fallback timeout
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => setShowSplash(false), 8000); // fallback 8s (safety net only)
    return () => clearTimeout(t);
  }, [showSplash]);

  // Attempt to programmatically start playback when splash appears (iOS/Safari reliability)
  useEffect(() => {
    if (!showSplash) return;
    const v = videoRef.current;
    if (!v) return;
    
    // Force mobile-friendly attributes
    v.muted = true;
    v.setAttribute('playsinline', 'true');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('controls', 'false');
    v.setAttribute('autoplay', 'true');
    v.setAttribute('loop', 'false');
    v.setAttribute('preload', 'auto');
    
    // Try to play with user interaction simulation
    const attemptPlay = async () => {
      try {
        // For mobile, we need to ensure the video is ready
        if (v.readyState < 3) {
          await new Promise((resolve) => {
            v.addEventListener('canplaythrough', resolve, { once: true });
          });
        }
        
        const playPromise = v.play();
        if (playPromise && typeof playPromise.then === 'function') {
          await playPromise;
          // console.log('Video autoplay successful');
        }
      } catch (error) {
        console.log('Autoplay failed, trying fallback:', error);
        // Fallback: try again after a short delay
        setTimeout(() => {
          try {
            v.play().catch(() => {
              console.log('Fallback autoplay also failed');
            });
          } catch (e) {
            console.log('Fallback autoplay error:', e);
          }
        }, 500);
      }
    };

    // Try immediately and also on user interaction
    attemptPlay();
    
    // Also try on first user interaction (mobile browsers often require this)
    const handleFirstInteraction = () => {
      attemptPlay();
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
    
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    document.addEventListener('click', handleFirstInteraction, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('click', handleFirstInteraction);
    };
  }, [showSplash]);

  // Fetch voucher details when reward is claimed
  useEffect(() => {
    const fetchVoucherDetails = async () => {
      if (!rewardDetails?.voucherAddress || rewardDetails.status !== 'claimed') {
        return;
      }

      setVoucherLoading(true);
      try {
        const result = await getVoucherDetails(rewardDetails.voucherAddress);
        if (result.success && result.data) {
          setVoucherDetails(result.data);
        }
      } catch (error) {
        console.error('Error fetching voucher details:', error);
      } finally {
        setVoucherLoading(false);
      }
    };

    fetchVoucherDetails();
  }, [rewardDetails?.voucherAddress, rewardDetails?.status]);

  // Fetch token balance when voucher details are ready (for TOKEN vouchers)
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (!rewardDetails?.voucherAddress || !voucherDetails?.attributes?.['Token Address']) {
          setVoucherTokenBalance(null);
          return;
        }
        setIsLoadingBalance(true);
        const { getVoucherTokenBalance } = await import('@/app/actions/withdraw');
        const res = await getVoucherTokenBalance(
          rewardDetails.voucherAddress,
          voucherDetails.attributes['Token Address']
        );
        if (res.success) setVoucherTokenBalance(res.balance!);
        else setVoucherTokenBalance(null);
      } catch {
        setVoucherTokenBalance(null);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    if (rewardDetails?.status === 'claimed' && voucherDetails?.voucherData?.type?.toLowerCase() === 'token') {
      fetchBalance();
    }
  }, [rewardDetails?.status, rewardDetails?.voucherAddress, voucherDetails?.attributes, voucherDetails?.voucherData?.type]);

  // Fetch earn pool balance (mock function - replace with actual implementation)
  useEffect(() => {
    const fetchEarnBalance = async () => {
      if (!rewardDetails?.voucherAddress || rewardDetails.status !== 'claimed' || rewardDetails.symbol !== 'USDC') {
        setEarnBalance(null);
        return;
      }
      
      setIsLoadingEarnBalance(true);
      try {
        // Mock implementation - replace with actual Reflect Money API call
        // const { getEarnBalance } = await import('@/app/actions/reflect');
        // const result = await getEarnBalance(rewardDetails.voucherAddress);
        // if (result.success) setEarnBalance(result.balance);
        
        // Mock balance for now
        setTimeout(() => {
          setEarnBalance(12.50); // Mock: $12.50 earning yield
          setIsLoadingEarnBalance(false);
        }, 1000);
      } catch {
        setEarnBalance(null);
        setIsLoadingEarnBalance(false);
      }
    };

    fetchEarnBalance();
  }, [rewardDetails?.status, rewardDetails?.voucherAddress, rewardDetails?.symbol]);

  const fetchVoucherBalance = async () => {
    if (!rewardDetails?.voucherAddress || !voucherDetails?.attributes?.['Token Address']) {
      setVoucherTokenBalance(null);
      return;
    }
    setIsLoadingBalance(true);
    try {
      const { getVoucherTokenBalance } = await import('@/app/actions/withdraw');
      const result = await getVoucherTokenBalance(
        rewardDetails.voucherAddress,
        voucherDetails.attributes['Token Address']
      );
      if (result.success) {
        setVoucherTokenBalance(result.balance!);
      } else {
        setVoucherTokenBalance(null);
      }
    } catch (e) {
      setVoucherTokenBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleClaimReward = async () => {
    if (!authenticated || !user?.wallet?.address || !rewardDetails) return;

    try {
      setIsClaiming(true);
      
        const result = await claimRewardLink(rewardId, user.wallet.address, rewardDetails.creator);
      
      if (result.success) {
        // reflect claimed state immediately to trigger the claimed view
        setRewardDetails(prev => prev ? { ...prev, status: 'claimed', voucherAddress: (result as any).voucherAddress } as any : prev);
        setShowSplash(true); // Play celebration video
        toast.success('Reward claimed successfully!', {
          position: "top-right",
          autoClose: 5000,
          theme: "dark",
        });
      } else {
        toast.error(result.error || 'Failed to claim reward', {
          position: "top-right",
          autoClose: 5000,
          theme: "dark",
        });
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward', {
        position: "top-right",
        autoClose: 5000,
        theme: "dark",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleWithdraw = async () => {
    if (!authenticated || !user?.wallet?.address || !rewardDetails?.voucherAddress) return;
    if (!withdrawRecipient.trim() || !withdrawAmount.trim()) return;

    const numAmount = parseFloat(withdrawAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsWithdrawing(true);
    try {
      const { withdrawTokens } = await import('@/app/actions/withdraw');
      const result = await withdrawTokens({
        voucherAddress: rewardDetails.voucherAddress,
        withdrawType,
        recipient: withdrawRecipient.trim(),
        amount: numAmount,
        senderWalletAddress: user.wallet.address,
      });

      if (result.success && result.recipientWalletAddress) {
        const { buildWithdrawTransaction, updateWithdrawStatus } = await import('@/app/actions/withdraw');
        const buildResult = await buildWithdrawTransaction({
          voucherAddress: rewardDetails.voucherAddress,
          recipientWallet: result.recipientWalletAddress,
          amount: numAmount,
          voucherId: result.voucherId!,
          creatorAddress: rewardDetails.creator,
        });

        if (!buildResult.success || !buildResult.transaction) {
          throw new Error(buildResult.error || 'Failed to execute withdraw transaction');
        }

        await updateWithdrawStatus(result.withdrawId!, buildResult.transaction);

        // Success popup
        setShowWithdrawModal(false);
        setWithdrawSignature(buildResult.transaction);
        setWithdrawAmountSuccess(numAmount);
        setWithdrawSymbol(rewardDetails.symbol || 'USDC');
        setShowWithdrawSuccess(true);

        // Cleanup
        setWithdrawRecipient('');
        setWithdrawAmount('');
        setWithdrawType('verxio');
        setVoucherTokenBalance(null);
        setIsLoadingBalance(false);
      } else {
        // Handle validation errors from withdrawTokens
        throw new Error(result.error || 'Withdrawal validation failed');
      }
    } catch (txError) {
      toast.error(txError instanceof Error ? txError.message : 'Withdrawal failed', {
        position: "top-right",
        autoClose: 5000,
        theme: "dark",
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Voucher operation handlers
  const handleRedeemVoucher = async () => {
    if (!user?.wallet?.address || !rewardDetails?.voucherAddress || !redeemAmount) return;

    setVoucherOperationLoading(true);
    setVoucherModalError(null);
    try {
      // Get voucher ID by address
      const voucherIdResult = await getVoucherIdByAddress(rewardDetails.voucherAddress, user.wallet.address);
      if (!voucherIdResult.success) {
        setVoucherModalError(voucherIdResult.error || 'Failed to find voucher');
        return;
      }

      // Redeem voucher using existing function
      const result = await redeemVoucher(voucherIdResult.voucherId, user.wallet.address, user.wallet.address, parseFloat(redeemAmount));
      
      if (result.success && 'result' in result && result.result?.success) {
        setSuccessMessage('Voucher redeemed successfully!');
        setOperationSuccess(true);
        setShowVoucherModal(false);
        setVoucherModalType(null);
        setRedeemAmount('');
        
        // Refresh voucher details
        if (rewardDetails?.voucherAddress) {
          await getVoucherDetails(rewardDetails.voucherAddress);
        }
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to redeem voucher';
        setVoucherModalError(errorMessage);
      }
    } catch (error) {
      console.error('Redeem voucher error:', error);
      setVoucherModalError('Failed to redeem voucher');
    } finally {
      setVoucherOperationLoading(false);
    }
  };

  const handleCancelVoucher = async () => {
    if (!user?.wallet?.address || !rewardDetails?.voucherAddress) return;

    setVoucherOperationLoading(true);
    setVoucherModalError(null);
    try {
      // Get voucher ID by address
      const voucherIdResult = await getVoucherIdByAddress(rewardDetails.voucherAddress, user.wallet.address);
      if (!voucherIdResult.success) {
        setVoucherModalError(voucherIdResult.error || 'Failed to find voucher');
        return;
      }

      // Cancel voucher using existing function
      const result = await cancelVoucher(voucherIdResult.voucherId, cancelReason || 'Voucher cancelled by creator', user.wallet.address);
      
      if (result.success && 'result' in result && result.result?.success) {
        setSuccessMessage('Voucher cancelled successfully!');
        setOperationSuccess(true);
        setShowVoucherModal(false);
        setVoucherModalType(null);
        setCancelReason('');
        
        // Refresh voucher details
        if (rewardDetails?.voucherAddress) {
          await getVoucherDetails(rewardDetails.voucherAddress);
        }
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to cancel voucher';
        setVoucherModalError(errorMessage);
      }
    } catch (error) {
      console.error('Cancel voucher error:', error);
      setVoucherModalError('Failed to cancel voucher');
    } finally {
      setVoucherOperationLoading(false);
    }
  };

  const handleExtendVoucherExpiry = async () => {
    if (!user?.wallet?.address || !rewardDetails?.voucherAddress || !newExpiryDate) return;

    setVoucherOperationLoading(true);
    setVoucherModalError(null);
    try {
      // Get voucher ID by address
      const voucherIdResult = await getVoucherIdByAddress(rewardDetails.voucherAddress, user.wallet.address);
      if (!voucherIdResult.success) {
        setVoucherModalError(voucherIdResult.error || 'Failed to find voucher');
        return;
      }

      // Set the expiry date to the end of the selected day
      const updatedExpiryDate = new Date(new Date(newExpiryDate).setHours(23, 59, 59, 999) + 24 * 60 * 60 * 1000);

      // Extend voucher expiry using existing function
      const result = await extendVoucherExpiry(voucherIdResult.voucherId, updatedExpiryDate, user.wallet.address);
      
      if (result.success && 'result' in result && result.result?.success) {
        setSuccessMessage('Voucher expiry extended successfully!');
        setOperationSuccess(true);
        setShowVoucherModal(false);
        setVoucherModalType(null);
        setNewExpiryDate('');
        
        // Refresh voucher details
        if (rewardDetails?.voucherAddress) {
          await getVoucherDetails(rewardDetails.voucherAddress);
        }
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to extend voucher expiry';
        setVoucherModalError(errorMessage);
      }
    } catch (error) {
      console.error('Extend voucher expiry error:', error);
      setVoucherModalError('Failed to extend voucher expiry');
    } finally {
      setVoucherOperationLoading(false);
    }
  };

  // Yield earning handlers
  const handleEarnDeposit = async () => {
    if (!user?.wallet?.address || !rewardDetails?.voucherAddress || !earnAmount) return;

    const numAmount = parseFloat(earnAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsEarning(true);
    setEarnError(null);
    try {
      const res = await fetch('/api/reflect/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherAddress: rewardDetails.voucherAddress, amountUsdc: numAmount }),
      })
      const result = await res.json()

      if (!result.success) throw new Error(result.error);

      setEarnSuccessMessage(`Deposited ${numAmount.toFixed(2)} USDC • ${result.signature.slice(0, 8)}...`);
      setEarnSuccess(true);
      setShowEarnModal(false);
      setEarnAmount('');

      // Refresh balances (optimistic)
      setEarnBalance(prev => (prev || 0) + numAmount);
      if (voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC') {
        // Decrease available USDC balance optimistically
        setVoucherTokenBalance(prev => (prev || 0) - numAmount);
      }

      toast.success('Deposited to earn pool', { position: 'top-right', autoClose: 4000, theme: 'dark' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deposit to earn pool';
      setEarnError(errorMessage);
      toast.error(errorMessage, { position: 'top-right', autoClose: 5000, theme: 'dark' });
    } finally {
      setIsEarning(false);
    }
  };

  const handleEarnWithdraw = async () => {
    if (!user?.wallet?.address || !rewardDetails?.voucherAddress || !withdrawEarnAmount) return;

    const numAmount = parseFloat(withdrawEarnAmount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > (earnBalance || 0)) return;

    setIsWithdrawingEarn(true);
    setEarnError(null);
    try {
      const res = await fetch('/api/reflect/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherAddress: rewardDetails.voucherAddress, amountUsdcPlus: numAmount }),
      })
      const result = await res.json()

      if (!result.success) throw new Error(result.error);

      setEarnSuccessMessage(`Withdrew ${numAmount.toFixed(2)} USDC from earn • ${result.signature.slice(0, 8)}...`);
      setEarnSuccess(true);
      setShowWithdrawEarnModal(false);
      setWithdrawEarnAmount('');

      // Refresh balances (optimistic)
      setEarnBalance(prev => Math.max(0, (prev || 0) - numAmount));
      if (voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC') {
        // Increase available USDC balance optimistically
        setVoucherTokenBalance(prev => (prev || 0) + numAmount);
      }

      toast.success('Withdrew from earn pool', { position: 'top-right', autoClose: 4000, theme: 'dark' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to withdraw from earn pool';
      setEarnError(errorMessage);
      toast.error(errorMessage, { position: 'top-right', autoClose: 5000, theme: 'dark' });
    } finally {
      setIsWithdrawingEarn(false);
    }
  };

  const formatVoucherType = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'FREE_ITEM': 'Free Item',
      'BUY_ONE_GET_ONE': 'Buy One Get One',
      'FIXED_VERXIO_CREDITS': 'Fixed Verxio Credits',
      'PERCENTAGE_OFF': 'Percentage Off',
      'CUSTOM_REWARD': 'Custom Reward'
    };
    return typeMap[type] || type;
  };

  const formatConditionString = (condition: string | null): string => {
    if (!condition) return 'No conditions';

    const conditionMap: { [key: string]: string } = {
      'minimum_purchase_10': 'Minimum purchase $10',
      'minimum_purchase_25': 'Minimum purchase $25',
      'minimum_purchase_50': 'Minimum purchase $50',
      'weekdays_only': 'Valid weekdays only',
      'weekends_only': 'Valid weekends only',
      'first_time_customer': 'First-time customers only',
      'new_customer': 'New customers only',
      'loyalty_member': 'Loyalty members only'
    };

    return conditionMap[condition] || condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatMaxUses = (maxUses: number | null): string => {
    if (!maxUses) return 'Unlimited';
    if (maxUses === 1) return 'Once';
    if (maxUses === 2) return 'Twice';
    return `${maxUses} times`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Tiles />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <VerxioLoaderWhite size="lg" />
          <p className="text-white/60">Loading reward details...</p>
        </div>
      </div>
    );
  }

  if (error || !rewardDetails) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Tiles />
        <div className="relative z-10 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Reward Not Found</h1>
          <p className="text-white/60 mb-6">{error || 'This reward link is invalid or has expired.'}</p>
          <AppButton
            onClick={() => window.history.back()}
            variant="secondary"
          >
            Go Back
          </AppButton>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Splash video overlay */}
      {showSplash && (
        <div className="fixed inset-0 z-30 pointer-events-none">
          <video
            ref={videoRef}
            className="w-full h-full object-cover opacity-50"
            autoPlay
            muted
            playsInline
            preload="auto"
            controls={false}
            loop={false}
            onPlay={() => setTimeout(() => setShowSplash(false), 4000)}
            onEnded={() => setShowSplash(false)}
            onError={(e) => {
              console.log('Video error:', e);
              setShowSplash(false);
            }}
          >
            <source src="/Splash.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}
      <Tiles />
      {/* Header - match @claim/ */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="relative w-10 h-10">
          <img src="/logo/verxioIconWhite.svg" alt="Verxio" className="w-full h-full" />
        </div>
        <div className="flex items-center gap-4">
          {authenticated ? (
            <>
              <span className="text-white text-sm">
                {user?.email?.address || `${user?.wallet?.address?.slice(0, 6)}...${user?.wallet?.address?.slice(-4)}`}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="flex items-center gap-2 text-white hover:text-[#00adef] transition-colors text-sm px-4 py-2 border border-white/20 rounded-lg hover:border-[#00adef]/40"
            >
              Log in to manage
            </button>
          )}
        </div>
      </header>
      <div className="relative z-10 min-h-screen flex flex-col pt-20 px-4">

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full"
          >
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
              {/* Countdown Banner - Only show for unclaimed rewards */}
              {rewardDetails.expiryDate && rewardDetails.status !== 'claimed' && (
                <div className="mb-4">
                  <div className={`w-full text-center px-3 py-2 rounded-lg border text-sm ${
                    isExpired ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                  }`}>
                    {isExpired || !countdown ? (
                      <span>Expired</span>
                    ) : (
                      <span>
                        Expires in: {String(countdown.days).padStart(2, '0')}d : {String(countdown.hours).padStart(2, '0')}h : {String(countdown.minutes).padStart(2, '0')}m : {String(countdown.seconds).padStart(2, '0')}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Voucher Address - Show for all claimed rewards at the top */}
              {rewardDetails.status === 'claimed' && rewardDetails.voucherAddress && (
                <div className="mb-4">
                  <div className="flex items-center justify-between p-3 bg-black/20 border border-white/10 rounded-lg">
                    <span className="text-white/60 text-sm">Verxio Card</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {rewardDetails.voucherAddress.slice(0, 10)}...{rewardDetails.voucherAddress.slice(-6)}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(rewardDetails.voucherAddress || '');
                          toast.success('Voucher address copied!', {
                            position: "top-right",
                            autoClose: 2000,
                            theme: "dark",
                          });
                        }}
                        className="text-white/40 hover:text-white/60 transition-colors"
                        title="Copy voucher address"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Yield Earning Section for claimed USDC token vouchers - Move to top */}
              {rewardDetails.status === 'claimed' && authenticated && rewardDetails.creator !== user?.wallet?.address && voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC' && voucherDetails?.owner === user?.wallet?.address && (
                <div className="mb-6">
                  {/* Yield Earning Banner */}
                  <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg">
                    {/* Header with Reflect info */}
                    <div className="flex items-center gap-3 mb-3">
                      <img src="/logo/reflect.svg" alt="Reflect" className="w-6 h-6" />
                      <div>
                        <h4 className="text-green-400 font-semibold text-sm">Earn up to 8% APY</h4>
                        <p className="text-white/70 text-xs">on idle deposits</p>
                      </div>
                      
                    </div>
                    
                    <p className="text-white/60 text-xs mb-3">
                      Deposit your USDC to the earn pool powered by Reflect and start earning yield automatically.
                    </p>

                    {/* Current Earn Balance */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white/60 text-xs">Earn Pool Balance:</span>
                      {isLoadingEarnBalance ? (
                        <span className="text-white/40 text-xs">Loading...</span>
                      ) : (
                        <span className="text-green-400 font-medium text-sm">
                          {(earnBalance || 0).toFixed(2)} USDC+
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEarnAmount('');
                          setEarnError(null);
                          setShowEarnModal(true);
                        }}
                        className="flex-1 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded text-green-400 text-xs font-medium transition-colors"
                      >
                        Deposit to Earn
                      </button>
                      <button
                        onClick={() => {
                          setWithdrawEarnAmount('');
                          setEarnError(null);
                          setShowWithdrawEarnModal(true);
                        }}
                        disabled={!earnBalance || earnBalance <= 0}
                        className={`flex-1 px-3 py-2 border rounded text-xs font-medium transition-colors ${
                          !earnBalance || earnBalance <= 0
                            ? 'bg-gray-700/30 text-gray-400 border-gray-600 cursor-not-allowed'
                            : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-600/30 text-blue-400'
                        }`}
                      >
                        Withdraw from Earn
                      </button>
                      
                    </div>
                    
                  </div>
                </div>
              )}

              {/* Reward Image */}
              {rewardDetails.imageUri && (
                <div className="mb-6">
                  <div className="relative w-full h-48 rounded-xl overflow-hidden">
                    <img
                      src={rewardDetails.imageUri}
                      alt={rewardDetails.name || 'Reward'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Reward Details */}
              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {rewardDetails.name || 'Reward Voucher'}
                  </h3>
                </div>

                <div className="space-y-2">
                  {rewardDetails.voucherWorth && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Voucher Worth</span>
                      <span className="text-white font-medium">
                        {voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC'
                          ? (isLoadingBalance ? 'Loading...' : `${(voucherTokenBalance ?? 0).toFixed(2)} USDC`)
                          : `${(voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth).toLocaleString()} ${rewardDetails.symbol || 'USDC'}`}
                      </span>
                    </div>
                  )}

                  {rewardDetails.maxUses && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Max Use</span>
                      <span className="text-white font-medium">
                        {formatMaxUses(rewardDetails.maxUses)}
                      </span>
                    </div>
                  )}

                  {voucherDetails?.voucherData?.status && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Status</span>
                      <span className={`font-medium ${
                        voucherDetails.voucherData.status === 'active' ? 'text-green-400' :
                        voucherDetails.voucherData.status === 'used' ? 'text-blue-400' :
                        voucherDetails.voucherData.status === 'cancelled' ? 'text-red-400' :
                        voucherDetails.voucherData.status === 'expired' ? 'text-orange-400' :
                        'text-white'
                      }`}>
                        {voucherDetails.voucherData.status.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Expires row replaced by countdown banner above */}

                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Transferable</span>
                    <span className="text-white font-medium">
                      {rewardDetails.transferable ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Conditions</span>
                    <span className="text-white font-medium text-right">
                      {formatConditionString(rewardDetails.conditions)}
                    </span>
                  </div>

                  {/* Expiry Date - Only show for claimed rewards */}
                  {rewardDetails.status === 'claimed' && rewardDetails.expiryDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Expires</span>
                      <span className="text-white font-medium">
                        {new Date(rewardDetails.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Explorer Link - Only show for claimed rewards */}
                  {rewardDetails.status === 'claimed' && rewardDetails.voucherAddress && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Explorer</span>
                      <button
                        onClick={() => window.open(`https://solscan.io/token/${rewardDetails.voucherAddress}`, '_blank')}
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View on Solscan
                      </button>
                    </div>
                  )}
                </div>
              </div>


              {/* Claim Button or Status Message */}
              {rewardDetails.status === 'claimed' && rewardDetails.creator !== user?.wallet?.address ? (
                <div className="space-y-4">
                  {/* <div className="p-4 bg-green-500/20 border border-green-500/40 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-green-400">Reward Claimed</h3>
                  </div> */}
                  
                  {/* Withdraw functionality for USDC token vouchers */}
                  {authenticated && rewardDetails.creator !== user?.wallet?.address && voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC' && voucherDetails?.owner === user?.wallet?.address ? (
                    <div className="space-y-2">
                      {isLoadingBalance ? (
                        <div className="text-center text-xs text-white/60">Checking balance...</div>
                      ) : voucherTokenBalance !== null && voucherTokenBalance <= 0 ? (
                        <div className="space-y-2">
                          <div className="p-2 rounded border border-white/10 bg-white/5 text-white/70 text-xs text-center">Nothing to withdraw</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setWithdrawRecipient('');
                              setWithdrawAmount(((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0).toString());
                              setWithdrawType('verxio');
                              setVoucherTokenBalance(null);
                              setIsLoadingBalance(true);
                              setShowWithdrawModal(true);
                              // Fetch balance when modal opens
                              if (voucherDetails?.attributes?.['Token Address']) {
                                fetchVoucherBalance();
                              }
                            }}
                            disabled={voucherTokenBalance !== null && voucherTokenBalance <= 0}
                            className={`flex-1 px-3 py-2 border text-sm font-medium rounded transition-colors ${
                              voucherTokenBalance !== null && voucherTokenBalance <= 0
                                ? 'bg-gray-700/30 text-gray-400 border-gray-600 cursor-not-allowed'
                                : 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border-orange-600/30'
                            }`}
                          >
                            Withdraw Tokens
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Merchant Management for Claimed Rewards - Show for creator only */}
              {rewardDetails.status === 'claimed' && authenticated && rewardDetails.creator === user?.wallet?.address && voucherDetails && (
                <div className="space-y-4">
                  {/* Horizontal Divider */}
                  <div className="border-t border-white/10"></div>
                  
                  <div className="text-center text-sm text-white/60 mb-3">
                    Manage this voucher as the creator
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                        {voucherDetails.voucherData?.status === 'active' && !voucherDetails.voucherData?.isExpired &&  voucherDetails.voucherData?.type?.toLowerCase() !== 'token' && (
                          <button
                            onClick={() => {
                              setVoucherModalType('redeem');
                              setShowVoucherModal(true);
                              setRedeemAmount(((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0).toString());
                              setVoucherModalError(null);
                            }}
                            className="px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded text-green-400 text-sm transition-colors"
                          >
                            Redeem
                          </button>
                        )}
                    
                    {voucherDetails.voucherData?.status === 'active' && (
                      <button
                        onClick={() => {
                          setVoucherModalType('cancel');
                          setShowVoucherModal(true);
                          setCancelReason('Voucher cancelled by creator');
                          setVoucherModalError(null);
                        }}
                        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded text-red-400 text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    
                    {(voucherDetails.voucherData?.status === 'used' || voucherDetails.voucherData?.status === 'active' || voucherDetails.voucherData?.isExpired) && (
                      <button
                        onClick={() => {
                          setVoucherModalType('extend');
                          setShowVoucherModal(true);
                          setNewExpiryDate('');
                          setVoucherModalError(null);
                        }}
                        className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 rounded text-orange-400 text-sm transition-colors"
                      >
                        Extend Expiry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Unclaimed Reward - Show claim button for non-creators */}
              {rewardDetails.status !== 'claimed' && authenticated && rewardDetails.creator !== user?.wallet?.address && (
                <AppButton
                  onClick={handleClaimReward}
                  disabled={isClaiming || isExpired}
                  className="w-full"
                >
                  {isClaiming ? (
                    <>
                      <VerxioLoaderWhite size="sm" />
                      <span className="ml-2">Claiming...</span>
                    </>
                  ) : isExpired ? (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Reward Expired
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Claim Reward
                    </>
                  )}
                </AppButton>
              )}

              {/* Login button for unauthenticated users */}
              {!authenticated && rewardDetails.status !== 'claimed' && (
                <AppButton
                  onClick={login}
                  disabled={isExpired}
                  className="w-full"
                >
                  {isExpired ? 'Reward Expired' : 'Continue to Claim Reward'}
                </AppButton>
              )}

              {/* Powered by Verxio Protocol - Bottom of card */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-gray-400 text-xs text-center">
                  Powered by Verxio Protocol
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && rewardDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Withdraw Tokens</h3>
            </div>

            <div className="space-y-4">
              {/* Voucher Info */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-sm font-medium mb-1">Withdrawing from:</div>
                <div className="text-white text-sm">
                  {rewardDetails.name || `Voucher`} - {voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth} {rewardDetails.symbol || 'USDC'}
                </div>
              </div>

              {/* Withdraw Type Toggle */}
              <div className="space-y-3">
                <Label className="text-white text-sm font-medium">Withdraw To</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={withdrawType === 'verxio'}
                      onCheckedChange={(checked) => {
                        setWithdrawType(checked ? 'verxio' : 'external');
                        setWithdrawRecipient('');
                      }}
                    />
                    <Label className="text-white text-sm">Verxio User</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={withdrawType === 'external'}
                      onCheckedChange={(checked) => {
                        setWithdrawType(checked ? 'external' : 'verxio');
                        setWithdrawRecipient('');
                      }}
                    />
                    <Label className="text-white text-sm">External Wallet</Label>
                  </div>
                </div>
              </div>

              {/* Recipient Field */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-recipient" className="text-white text-sm font-medium">
                  {withdrawType === 'verxio' ? 'Recipient Email' : 'Recipient Wallet Address'}
                </Label>
                <Input
                  id="withdraw-recipient"
                  type={withdrawType === 'verxio' ? 'email' : 'text'}
                  value={withdrawRecipient}
                  onChange={(e) => setWithdrawRecipient(e.target.value)}
                  placeholder={withdrawType === 'verxio' ? 'Enter verxio user email address' : 'Enter Solana wallet address'}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount" className="text-white text-sm font-medium">
                  Amount to Withdraw ({rewardDetails.symbol || 'USDC'})
                </Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={voucherTokenBalance !== null ? voucherTokenBalance : ((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0)}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
                  <div className="text-xs text-white/60">
                    {isLoadingBalance ? (
                      <span>Loading balance...</span>
                    ) : voucherTokenBalance !== null ? (
                      <span>Available: {voucherTokenBalance.toFixed(2)} {rewardDetails.symbol || 'USDC'}</span>
                    ) : (
                      <span>Unable to load balance</span>
                    )}
                  </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="text-orange-400 text-sm font-medium mb-1">Warning</div>
                <div className="text-orange-300 text-xs">
                  This will withdraw tokens from the voucher and transfer them to the specified recipient.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <AppButton
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawRecipient('');
                    setWithdrawAmount('');
                    setWithdrawType('verxio');
                    setVoucherTokenBalance(null);
                    setIsLoadingBalance(false);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AppButton>
                  <AppButton
                    onClick={handleWithdraw}
                    disabled={
                      !withdrawRecipient.trim() || 
                      !withdrawAmount.trim() || 
                      parseFloat(withdrawAmount) <= 0 ||
                      parseFloat(withdrawAmount) > (voucherTokenBalance !== null ? voucherTokenBalance : ((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0)) ||
                      isWithdrawing ||
                      (voucherTokenBalance !== null && voucherTokenBalance <= 0) ||
                      isLoadingBalance ||
                      voucherTokenBalance === null
                    }
                    className="flex-1"
                  >
                    {isWithdrawing ? (
                      <div className="flex items-center gap-2">
                        <VerxioLoaderWhite size="sm" />
                        Withdrawing...
                      </div>
                    ) : isLoadingBalance ? (
                      <div className="flex items-center gap-2">
                        <VerxioLoaderWhite size="sm" />
                        Loading Balance...
                      </div>
                    ) : voucherTokenBalance === null ? (
                      'Loading Balance...'
                    ) : (voucherTokenBalance <= 0) ? (
                      'Insufficient Balance'
                    ) : (
                      'Confirm Withdraw'
                    )}
                  </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Success Modal */}
      {showWithdrawSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Withdrawal Successful!</h3>
              <p className="text-white/80">
                Your tokens have been withdrawn successfully!
              </p>

              <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Amount:</span>
                  <span className="text-white font-medium">{withdrawAmountSuccess.toFixed(2)} {withdrawSymbol}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Transaction:</span>
                  <span className="text-white font-mono text-sm truncate max-w-32">
                    {withdrawSignature.slice(0, 8)}...{withdrawSignature.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <a
                    href={`https://solscan.io/tx/${withdrawSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#00adef] text-sm hover:text-[#00adef]/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Solscan
                  </a>
                </div>
              </div>

                <button
                  onClick={async () => {
                    setShowWithdrawSuccess(false);
                    setWithdrawSignature('');
                    setWithdrawAmountSuccess(0);
                    setWithdrawSymbol('');
                    // Refresh component state after successful withdrawal
                    setVoucherTokenBalance(null);
                    setIsLoadingBalance(true);
                    // Re-fetch voucher details and balance
                    if (rewardDetails?.voucherAddress) {
                      const result = await getVoucherDetails(rewardDetails.voucherAddress);
                      if (result.success && result.data) {
                        setVoucherDetails(result.data);
                        if (result.data.attributes?.['Token Address']) {
                          fetchVoucherBalance();
                        }
                      }
                    }
                  }}
                  className="w-full px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Operation Modal */}
      {showVoucherModal && voucherModalType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">
                {voucherModalType === 'redeem' && 'Confirm Voucher Redemption'}
                {voucherModalType === 'cancel' && 'Confirm Voucher Cancellation'}
                {voucherModalType === 'extend' && 'Extend Voucher Expiry'}
              </h3>
            </div>

            <div className="space-y-4">
              {voucherModalType === 'redeem' && (
                <>
                  <div className="text-center">
                    <div className="text-white/80 mb-4">
                      You're about to redeem{' '}
                      <span className="text-green-400 font-medium">
                        {voucherDetails?.voucherData?.type?.toLowerCase() || rewardDetails?.voucherType?.toLowerCase()}
                      </span>{' '}
                      voucher for{' '}
                      <span className="text-blue-400 font-medium">
                        {((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails?.voucherWorth) || 0).toLocaleString()} {rewardDetails?.symbol || 'USD'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-2 block">Redemption Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="Enter redemption amount"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                    <div className="text-xs text-white/60 mt-1">
                      Max: {((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails?.voucherWorth) || 0).toLocaleString()} {rewardDetails?.symbol || 'USD'}
                    </div>
                  </div>
                </>
              )}

              {voucherModalType === 'cancel' && (
                <>
                  <div className="text-center">
                    <div className="text-white/80 mb-4">
                      You're about to cancel the{' '}
                      <span className="text-red-400 font-medium">
                        {voucherDetails?.voucherData?.type?.toLowerCase() || rewardDetails?.voucherType?.toLowerCase()}
                      </span>{' '}
                      voucher
                    </div>
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-2 block">Cancellation Reason</Label>
                    <Input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Enter reason for cancellation"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </>
              )}

              {voucherModalType === 'extend' && (
                <>
                  <div>
                    <Label className="text-white text-sm mb-2 block">New Expiry Date</Label>
                    <Input
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Modal Error Display */}
              {voucherModalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{voucherModalError}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <AppButton
                  onClick={() => {
                    setShowVoucherModal(false);
                    setVoucherModalType(null);
                    setRedeemAmount('');
                    setCancelReason('');
                    setNewExpiryDate('');
                    setVoucherModalError(null);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AppButton>
                <AppButton
                  onClick={() => {
                    if (voucherModalType === 'redeem') {
                      handleRedeemVoucher();
                    } else if (voucherModalType === 'cancel') {
                      handleCancelVoucher();
                    } else if (voucherModalType === 'extend') {
                      handleExtendVoucherExpiry();
                    }
                  }}
                  disabled={
                    (voucherModalType === 'extend' && !newExpiryDate) ||
                    (voucherModalType === 'redeem' && (!redeemAmount || parseFloat(redeemAmount) <= 0 || parseFloat(redeemAmount) > ((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails?.voucherWorth) || 0))) ||
                    (voucherModalType === 'cancel' && !cancelReason.trim()) ||
                    voucherOperationLoading
                  }
                  className="flex-1"
                >
                  {voucherOperationLoading ? (
                    <VerxioLoaderWhite size="sm" />
                  ) : (
                    <>
                      {voucherModalType === 'redeem' && 'Confirm Redeem'}
                      {voucherModalType === 'cancel' && 'Confirm Cancel'}
                      {voucherModalType === 'extend' && 'Extend Expiry'}
                    </>
                  )}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operation Success Modal */}
      {operationSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-8 w-full max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-xl mb-2">Success!</h3>
            <p className="text-white/80 mb-6">{successMessage}</p>
            <AppButton
              onClick={() => {
                setOperationSuccess(false);
                setSuccessMessage('');
              }}
              className="w-full"
            >
              Continue
            </AppButton>
          </div>
        </div>
      )}

      {/* Earn Pool Deposit Modal */}
      {showEarnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src="/logo/reflect.svg" alt="Reflect" className="w-6 h-6" />
                <h3 className="text-white font-semibold text-lg">Deposit to Earn Pool</h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Voucher Info */}
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-green-400 text-sm font-medium mb-1">Depositing from:</div>
                <div className="text-white text-sm">
                  {rewardDetails.name || `Voucher`} - {
                    (voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC')
                      ? (isLoadingBalance ? 'Loading...' : `${(voucherTokenBalance ?? 0).toFixed(2)} USDC`)
                      : `${Number(((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) ?? 0)).toFixed(2)} USDC`
                  }
                </div>
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <Label htmlFor="earn-amount" className="text-white text-sm font-medium">
                  Amount to Deposit (USDC)
                </Label>
                <Input
                  id="earn-amount"
                  type="number"
                  value={earnAmount}
                  onChange={(e) => setEarnAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={
                    (voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC')
                      ? (voucherTokenBalance || 0)
                      : ((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0)
                  }
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
                <div className="text-xs text-white/60">
                  {voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC'
                    ? (isLoadingBalance ? 'Available: Loading...' : `Available: ${(voucherTokenBalance || 0).toFixed(2)} USDC`)
                    : `Available: ${(((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0).toFixed(2))} USDC`}
                </div>
              </div>

              {/* Yield Info */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <img src="/logo/reflect.svg" alt="Reflect" className="w-4 h-4" />
                  <div className="text-blue-400 text-sm font-medium">Earn up to 8% APY</div>
                </div>
                <div className="text-blue-300 text-xs">
                  Your deposited amount will start earning yield automatically through Reflect Money's yield-bearing stablecoins.
                </div>
              </div>

              {/* Error Display */}
              {earnError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{earnError}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <AppButton
                  onClick={() => {
                    setShowEarnModal(false);
                    setEarnAmount('');
                    setEarnError(null);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AppButton>
                <AppButton
                  onClick={handleEarnDeposit}
                  disabled={
                    !earnAmount.trim() || 
                    parseFloat(earnAmount) <= 0 ||
                    (
                      (voucherDetails?.voucherData?.type?.toLowerCase() === 'token' && rewardDetails.symbol === 'USDC')
                        ? (voucherTokenBalance !== null && parseFloat(earnAmount) > (voucherTokenBalance || 0))
                        : (parseFloat(earnAmount) > (((voucherDetails?.voucherData?.remainingWorth ?? rewardDetails.voucherWorth) || 0)))
                    ) ||
                    isEarning
                  }
                  className="flex-1"
                >
                  {isEarning ? (
                    <div className="flex items-center gap-2">
                      <VerxioLoaderWhite size="sm" />
                      Depositing...
                    </div>
                  ) : (
                    'Deposit to Earn Pool'
                  )}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Earn Pool Withdraw Modal */}
      {showWithdrawEarnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src="/logo/reflect.svg" alt="Reflect" className="w-6 h-6" />
                <h3 className="text-white font-semibold text-lg">Withdraw from Earn Pool</h3>
              </div>
            </div>

            <div className="space-y-4">
              {/* Voucher Info */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-sm font-medium mb-1">Withdrawing from:</div>
                <div className="text-white text-sm">
                  {rewardDetails.name || `Voucher`} Earn Pool
                </div>
              </div>

              {/* Current Balance */}
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-sm font-medium">Earn Pool Balance:</span>
                  <span className="text-white font-medium">
                    {(earnBalance || 0).toFixed(2)} USDC+
                  </span>
                </div>
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-earn-amount" className="text-white text-sm font-medium">
                  Amount to Withdraw (USDC)
                </Label>
                <Input
                  id="withdraw-earn-amount"
                  type="number"
                  value={withdrawEarnAmount}
                  onChange={(e) => setWithdrawEarnAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={earnBalance || 0}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
                <div className="text-xs text-white/60">
                  Available: {(earnBalance || 0).toFixed(2)} USDC
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="text-orange-400 text-sm font-medium mb-1">Note</div>
                <div className="text-orange-300 text-xs">
                  Withdrawing from the earn pool will stop earning yield on the withdrawn amount.
                </div>
              </div>

              {/* Error Display */}
              {earnError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{earnError}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <AppButton
                  onClick={() => {
                    setShowWithdrawEarnModal(false);
                    setWithdrawEarnAmount('');
                    setEarnError(null);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AppButton>
                <AppButton
                  onClick={handleEarnWithdraw}
                  disabled={
                    !withdrawEarnAmount.trim() || 
                    parseFloat(withdrawEarnAmount) <= 0 ||
                    parseFloat(withdrawEarnAmount) > (earnBalance || 0) ||
                    isWithdrawingEarn
                  }
                  className="flex-1"
                >
                  {isWithdrawingEarn ? (
                    <div className="flex items-center gap-2">
                      <VerxioLoaderWhite size="sm" />
                      Withdrawing...
                    </div>
                  ) : (
                    'Withdraw from Earn Pool'
                  )}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Earn Success Modal */}
      {earnSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-8 w-full max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <img src="/logo/reflect.svg" alt="Reflect" className="w-8 h-8" />
            </div>
            <h3 className="text-white font-semibold text-xl mb-2">Success!</h3>
            <p className="text-white/80 mb-6">{earnSuccessMessage}</p>
            <AppButton
              onClick={() => {
                setEarnSuccess(false);
                setEarnSuccessMessage('');
              }}
              className="w-full"
            >
              Continue
            </AppButton>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </div>
  );
}
