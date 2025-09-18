import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLogin } from '@privy-io/react-auth';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

import { motion } from "framer-motion";
import { getUserByWallet } from '@/app/actions/user';
import { useReferral } from '@/hooks/useReferral';
import { toast } from 'react-toastify';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
async function upsertUserViaApi(data: { walletAddress: string; email?: string; name?: string }) {
  const res = await fetch('/api/user/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to upsert user')
  return res.json()
}

export const AuroraHero = () => {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const hasProcessedRef = useRef(false);
  const { getStoredReferralCode, clearReferralCode } = useReferral();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePostAuth = async (walletAddress: string, email?: string, name?: string) => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    setIsProcessing(true);
    const userData = { walletAddress, email, name };
    await upsertUserViaApi(userData);

    // Process referral via API to avoid server action response issues in onComplete
    try {
      const referralCode = getStoredReferralCode();
      if (referralCode) {
        // Check new-user age first (kept locally to preserve behavior and toasts)
        const existingUser = await getUserByWallet(walletAddress);
        if (existingUser.success && existingUser.user && existingUser.user.createdAt) {
          const userAge = Date.now() - new Date(existingUser.user.createdAt).getTime();
          const fiveMinutesInMs = 5 * 60 * 1000;
          if (userAge > fiveMinutesInMs) {
            toast.info('Sign up bonus only available for new users.');
            clearReferralCode();
            router.replace('/dashboard');
            return;
          }
        }

        const res = await fetch('/api/referral/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referredWalletAddress: walletAddress, referralCode })
        })
        const data = await res.json()

        if (data.success) {
          toast.success('You can earn 500 Verxio credits when you deposit at least 5 USDC.');
          clearReferralCode();
        } else {
          if (data.error?.includes('already has a successful referral') || data.error?.includes('already has a referral relationship')) {
            toast.error('You already have a referral relationship. No bonus available.');
          } else if (data.error?.includes('Invalid referral code')) {
            console.error('Invalid referral code');
          } else if (data.error?.includes('Sign up bonus only available for new users')) {
            toast.info('Sign up bonus only available for new users.');
          } else {
            console.error('Failed to create referral:', data.error);
          }
          clearReferralCode();
        }
      }
    } catch (refErr) {
      console.error('Referral process error:', refErr)
      clearReferralCode();
    }

    router.replace('/dashboard');
  };
  const { login } = useLogin({
		onComplete: async (result) => {
			try {
				if (result.user?.wallet?.address) {
					await handlePostAuth(
						result.user.wallet.address,
						result.user.email?.address || undefined,
						result.user.google?.name || undefined,
					);
				}
			} catch (e) {
				console.error('Login completion failed (user upsert):', e);
			}
		},
	});

	// If the user is already authenticated (e.g., post-redirect), process once
	useEffect(() => {
		if (!authenticated || !user?.wallet?.address) return;
		handlePostAuth(
			user.wallet.address,
			user.email?.address || undefined,
			user.google?.name || undefined,
		);
	}, [authenticated, user]);


  return (
    <section className="relative grid min-h-screen place-content-center overflow-hidden bg-black px-4 py-24 text-white">
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <div className="mb-4 inline-block">
              <VerxioLoaderWhite size="md" />
            </div>
            <p className="text-white/80">Setting up your account…</p>
          </div>
        </div>
      )}
      <div className="relative z-10 flex flex-col items-center">
        <span className="mb-1.5 inline-block rounded-full bg-[#117ba6]/40 px-3 py-1.5 text-sm text-white border border-white/20">
          Beta Now Live
        </span>
        <h1 className="max-w-3xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight">
          Add Loyalty Rewards to your checkout experiences
        </h1>
        <p className="my-6 max-w-xl text-center text-base leading-relaxed text-gray-300 md:text-lg md:leading-relaxed">
          Transform your checkouts with native customer rewards and loyalty programs.
        </p>
        <motion.button
          onClick={login}
          whileHover={{
            scale: 1.015,
          }}
          whileTap={{
            scale: 0.985,
          }}
          className="group relative flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20 border border-white/20"
        >
          Continue
          <ArrowRight className="transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
        </motion.button>
      </div>

      <div className="absolute inset-0 z-0">
        <Canvas>
          <Stars radius={50} count={2500} factor={4} fade speed={2} />
        </Canvas>
      </div>
    </section>
  );
};