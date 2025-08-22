'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { AuroraHero } from '@/components/layout/hero-section';
import { Tiles } from '@/components/layout/backgroundTiles';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { createOrUpdateUser, getUserByWallet } from '@/app/actions/user';

import { getUserByReferralCode, createReferral } from '@/app/actions/referral';
import { useReferral } from '@/hooks/useReferral';
import { toast, ToastContainer } from 'react-toastify';

function HomeContent() {
  const { authenticated, ready, user } = usePrivy();
  const router = useRouter();
  const { getStoredReferralCode, clearReferralCode } = useReferral();

  useEffect(() => {
    const handleAuth = async () => {
      if (authenticated && user) {

        // Store user details in database and process referral
        const storeUserAndReferral = async () => {
          try {
            if (user.wallet?.address) {
              const userData = {
                walletAddress: user.wallet.address,
                email: user.email?.address || undefined,
                name: user.google?.name || undefined
              };
              const result = await createOrUpdateUser(userData);
              if (!result.success) {
                console.error('Failed to store user:', result.error);
              }

              // Process referral after user is stored
              const referralCode = getStoredReferralCode();
              if (referralCode) {
                try {
                  console.log('Processing referral code:', referralCode);
                  
                  // Check if this is a new user (just created)
                  const existingUser = await getUserByWallet(user.wallet.address);
                  if (existingUser.success && existingUser.user && existingUser.user.createdAt) {
                    const userAge = Date.now() - new Date(existingUser.user.createdAt).getTime();
                    const fiveMinutesInMs = 5 * 60 * 1000;
                    
                    if (userAge > fiveMinutesInMs) {
                      toast.info('Sign up bonus only available for new users.');
                      clearReferralCode();
                      return;
                    }
                  }

                  const referrerResult = await getUserByReferralCode(referralCode);

                  if (referrerResult.success && referrerResult.user) {
                    const referralResult = await createReferral({
                      referrerWalletAddress: referrerResult.user.walletAddress,
                      referredUserWalletAddress: user.wallet.address
                    });

                    if (referralResult.success) {
                      toast.success('You can earn 500 Verxio credits when you deposit at least 5 USDC.');
                      clearReferralCode();
                    } else {
                      if (referralResult.error?.includes('already has a referral relationship')) {
                        toast.error('You already have a referral relationship. No bonus available.');
                      } else {
                        console.error('Failed to create referral:', referralResult.error);
                      }
                      clearReferralCode();
                    }
                  } else {
                    console.error('Invalid referral code');
                    clearReferralCode();
                  }
                } catch (error) {
                  console.error('Error processing referral:', error);
                  clearReferralCode();
                }
              }
            } else {
              console.log('No wallet address found in user object');
            }
          } catch (error) {
            console.error('Error storing user data:', error);
          }
        };

        await storeUserAndReferral();

        router.push('/dashboard');
      }
    };

    handleAuth();
  }, [authenticated, user, router, getStoredReferralCode, clearReferralCode]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-20 right-6 z-50">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          theme="dark"
        />
      </div>
      <div className="w-full relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <AuroraHero />
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
