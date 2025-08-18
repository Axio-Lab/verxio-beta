'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuroraHero } from '@/components/layout/hero-section';
import { Tiles } from '@/components/layout/backgroundTiles';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { createOrUpdateUser } from '@/app/actions/user';

export default function Home() {
  const { authenticated, ready, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {

    if (authenticated && user) {

      // Store user details in database
      const storeUser = async () => {
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
          } else {
            console.log('No wallet address found in user object');
          }
        } catch (error) {
          console.error('Error storing user data:', error);
        }
      };
      
      storeUser();
      router.push('/dashboard');
    }
  }, [authenticated, user, router]);

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
  );
}
