'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserByWallet, createOrUpdateUser } from '@/app/actions/user';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Tiles } from '@/components/layout/backgroundTiles';

interface UserVerificationProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function UserVerification({ children, redirectTo = '/' }: UserVerificationProps) {
  const { authenticated, ready, user } = usePrivy();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'creating' | 'verified' | 'error'>('checking');

  useEffect(() => {
    const verifyUser = async () => {
      if (!ready || !authenticated || !user) {
        setIsVerifying(false);
        return;
      }

      try {
        setVerificationStatus('checking');
        
        // Check if user exists in database
        const userResult = await getUserByWallet(user.wallet?.address || '');
        
        if (userResult.success && userResult.user) {
          // User exists, allow access
          setVerificationStatus('verified');
          setIsVerifying(false);
        } else {
          // User doesn't exist, create them
          setVerificationStatus('creating');
          
          const userData = {
            walletAddress: user.wallet?.address || '',
            email: user.email?.address || undefined,
            name: user.google?.name || undefined
          };

          const createResult = await createOrUpdateUser(userData);
          
          if (createResult.success) {
            setVerificationStatus('verified');
            setIsVerifying(false);
          } else {
            console.error('Failed to create user:', createResult.error);
            setVerificationStatus('error');
            setIsVerifying(false);
          }
        }
      } catch (error) {
        console.error('Error during user verification:', error);
        setVerificationStatus('error');
        setIsVerifying(false);
      }
    };

    verifyUser();
  }, [ready, authenticated, user, router]);

  // Show loading screen while verifying
  if (!ready || !authenticated || isVerifying) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 text-center">
          <VerxioLoaderWhite size="lg" />
          <div className="mt-4 space-y-2">
            <p className="text-white text-lg">
              {!ready ? 'Initializing...' : 
               !authenticated ? 'Checking Authentication...' :
               verificationStatus === 'checking' ? 'Verifying Account...' :
               verificationStatus === 'creating' ? 'Setting Up Account...' :
               'Loading...'}
            </p>
            {verificationStatus === 'creating' && (
              <p className="text-zinc-400 text-sm">
                Creating your Verxio account...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show error state if verification failed
  if (verificationStatus === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 text-center max-w-md mx-auto px-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Account Setup Failed</h3>
            <p className="text-white/80 mb-4">
              We couldn't set up your account. Please try refreshing the page or contact support if the issue persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is verified, render children
  return <>{children}</>;
}
