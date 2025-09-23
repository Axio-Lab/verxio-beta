'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { LogOut, AlertCircle, Gift } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";
import { getRewardLink, claimRewardLink } from '@/app/actions/reward';
import { getVoucherDetails } from '@/lib/voucher/getVoucherDetails';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { AppButton } from '@/components/ui/app-button';
import { ExternalLink } from 'lucide-react';

interface RewardDetails {
  id: string;
  slug: string;
  collectionId: string;
  creator: string;
  voucherType: string;
  name: string | null;
  description: string | null;
  value: number | null;
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
  const [showSplash, setShowSplash] = useState(true);
  const [voucherDetails, setVoucherDetails] = useState<any>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    try {
      v.muted = true; // ensure muted before play
      v.setAttribute('playsinline', 'true');
      // @ts-ignore legacy iOS attribute
      v.setAttribute('webkit-playsinline', 'true');
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {
          // ignore autoplay rejection; overlay remains until fallback/onPlay/onEnded
        });
      }
    } catch {}
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

  const handleClaimReward = async () => {
    if (!authenticated || !user?.wallet?.address || !rewardDetails) return;

    try {
      setIsClaiming(true);
      
      const result = await claimRewardLink(rewardId, user.wallet.address, rewardDetails.creator);
      
      if (result.success) {
        // reflect claimed state immediately to trigger the claimed view
        setRewardDetails(prev => prev ? { ...prev, status: 'claimed' } as any : prev);
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
            onPlay={() => setTimeout(() => setShowSplash(false), 4000)}
            onEnded={() => setShowSplash(false)}
          >
            <source src="/Splash.mp4" type="video/mp4" />
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
          {authenticated && (
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
              {/* Countdown Banner */}
              {rewardDetails.expiryDate && (
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

              {/* Claimed Message - Only show for claimed rewards */}
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
                  <div className="flex justify-between items-center">
                    <span className="text-white/60 text-sm">Type</span>
                    <span className="text-white font-medium">
                      {formatVoucherType(rewardDetails.voucherType)}
                    </span>
                  </div>

                  {rewardDetails.value && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Value</span>
                      <span className="text-white font-medium">
                        ${rewardDetails.value.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {rewardDetails.maxUses && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">Max Uses</span>
                      <span className="text-white font-medium">
                        {formatMaxUses(rewardDetails.maxUses)}
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
              {rewardDetails.status === 'claimed' ? (
                <div className="text-center">
                  <div className="mb-4 p-4 bg-green-500/20 border border-green-500/40 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-400 mb-2">Reward Claimed</h3>
                  </div>
                </div>
              ) : authenticated ? (
                <AppButton
                  onClick={handleClaimReward}
                  disabled={isClaiming}
                  className="w-full"
                >
                  {isClaiming ? (
                    <>
                      <VerxioLoaderWhite size="sm" />
                      <span className="ml-2">Claiming...</span>
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4 mr-2" />
                      Claim Reward
                    </>
                  )}
                </AppButton>
              ) : (
                <AppButton
                  onClick={login}
                  className="w-full"
                >
                  Continue to Claim Reward
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
