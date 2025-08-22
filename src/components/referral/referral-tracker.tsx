'use client';

import { useEffect } from 'react';
import { useReferral } from '@/hooks/useReferral';

interface ReferralTrackerProps {
  userWalletAddress: string;
  onReferralCreated?: (success: boolean) => void;
}

export const ReferralTracker = ({ userWalletAddress, onReferralCreated }: ReferralTrackerProps) => {
  const { getStoredReferralCode, clearReferralCode } = useReferral();

  useEffect(() => {
    const trackReferral = async () => {
      const referralCode = getStoredReferralCode();
      
      if (referralCode && userWalletAddress) {
        try {
          // Get the referrer's wallet address from the referral code
          const { getUserByReferralCode } = await import('@/app/actions/referral');
          const referrerResult = await getUserByReferralCode(referralCode);
          
          if (referrerResult.success && referrerResult.user) {
            // Check if referral already exists to prevent duplicates
            const { createReferral } = await import('@/app/actions/referral');
            const referralResult = await createReferral({
              referrerWalletAddress: referrerResult.user.walletAddress,
              referredUserWalletAddress: userWalletAddress
            });
            
            if (referralResult.success) {
              console.log('Referral created successfully');
              onReferralCreated?.(true);
            } else if (referralResult.error === 'Referral already exists') {
              console.log('Referral already exists for this user');
              onReferralCreated?.(true); // Still consider it successful
            } else {
              console.error('Failed to create referral:', referralResult.error);
              onReferralCreated?.(false);
            }
          } else {
            console.error('Invalid referral code');
            onReferralCreated?.(false);
          }
          
          // Clear the referral code after processing
          clearReferralCode();
        } catch (error) {
          console.error('Error tracking referral:', error);
          onReferralCreated?.(false);
          clearReferralCode();
        }
      }
    };

    trackReferral();
  }, [userWalletAddress, getStoredReferralCode, clearReferralCode, onReferralCreated]);

  return null; // This component doesn't render anything
};
