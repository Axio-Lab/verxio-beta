'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { motion } from 'framer-motion';
import { LogOut, AlertCircle, Check, Gift, ExternalLink, } from 'lucide-react';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";
import { getLoyaltyProgramByAddress, checkUserLoyaltyProgramMembership, getLoyaltyProgramDetails } from '@/app/actions/loyalty';
import { saveLoyaltyPass } from '@/app/actions/loyalty-pass';
import { initializeVerxio, issueNewLoyaltyPass } from '@/app/actions/verxio';
import { createSignerFromKeypair, generateSigner, publicKey } from '@metaplex-foundation/umi';
import { convertSecretKeyToKeypair, uint8ArrayToBase58String } from '@/lib/utils';
import { getVerxioConfig, getCollectionAuthoritySecretKey } from '@/app/actions/loyalty';
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from '@/app/actions/verxio-credit';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

interface ProgramDetails {
  collectionAddress: string;
  creator: string;
  metadata: {
    organizationName: string;
    brandColor?: string;
  };
  name: string;
  numMinted: number;
  pointsPerAction: Record<string, number>;
  tiers: Array<{
    name: string;
    xpRequired: number;
    rewards: string[];
  }>;
  transferAuthority: string;
  updateAuthority: string;
  uri: string;
  claimEnabled?: boolean;
}

export default function ClaimLoyaltyPassPage() {
  const params = useParams();
  const { authenticated, ready, user, login, logout } = usePrivy();
  const [programDetails, setProgramDetails] = useState<ProgramDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ passAddress: string, programName: string } | null>(null);
  const [isMembershipCheckComplete, setIsMembershipCheckComplete] = useState(false);

  const programAddress = params.programAddress as string;

    // Fetch program details on component mount
  useEffect(() => {
    const fetchProgramDetails = async () => {
      if (!programAddress) return;

      try {
        setIsLoading(true);
        
        // First get basic info and claim status
        const result = await getLoyaltyProgramByAddress(programAddress)
        
        if (result.success && result.data) {
          // Then get full program details from blockchain
          const details = await getLoyaltyProgramDetails(result.data.creator, programAddress);
          
          if (details.success && details.programDetails) {
            setProgramDetails({
              collectionAddress: result.data.address!,
              creator: result.data.creator!,
              metadata: {
                organizationName: details.programDetails.metadata?.organizationName,
                brandColor: details.programDetails.metadata?.brandColor
              },
              name: details.programDetails.name,
              numMinted: details.programDetails.numMinted,
              pointsPerAction: details.programDetails.pointsPerAction || {},
              tiers: details.programDetails.tiers || [],
              transferAuthority: details.programDetails.transferAuthority,
              updateAuthority: details.programDetails.updateAuthority,
              uri: details.programDetails.uri || '',
              claimEnabled: result.data.claimEnabled ?? true // Get from database, default to true if not found
            });
          } 
        } else {
          toast.error('Failed to fetch program details');
        }
      } catch (error) {
        console.error('Error fetching program details:', error);
        toast.error('Failed to load program details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgramDetails();
  }, [programAddress]);

  // Real-time claim status updates (only when user hasn't claimed/isn't a member)
  useEffect(() => {
    if (!programAddress || isAlreadyMember) return; // Stop polling if user is already a member

    // Poll for claim status updates every 3 seconds
    const interval = setInterval(async () => {
      try {
        const result = await getLoyaltyProgramByAddress(programAddress);
        if (result.success && result.data && programDetails) {
          const newClaimEnabled = result.data.claimEnabled ?? true;
          if (newClaimEnabled !== programDetails.claimEnabled) {
            // Update program details with new claim status
            setProgramDetails(prev => prev ? {
              ...prev,
              claimEnabled: newClaimEnabled
            } : null);
            
            // Show toast notification for status change
            if (newClaimEnabled) {
              toast.info('Claiming is now enabled!', {
                position: "top-right",
                autoClose: 5000,
                theme: "dark",
              });
            } else {
              toast.info('Claiming has been disabled!', {
                position: "top-right",
                autoClose: 5000,
                theme: "dark",
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking claim status updates:', error);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [programAddress, programDetails?.claimEnabled, isAlreadyMember]);

  // Check if user is already a member when wallet connects
  useEffect(() => {
    const checkMembership = async () => {
      if (!authenticated || !user?.wallet?.address || !programAddress) return;

      try {
        const result = await checkUserLoyaltyProgramMembership(user.wallet.address, programAddress);
        if (result.success && result.isMember) {
          setIsAlreadyMember(true);
        }
      } catch (error) {
        console.error('Error checking membership:', error);
      } finally {
        setIsMembershipCheckComplete(true);
      }
    };

    // Only check membership if wallet is connected
    if (authenticated && user?.wallet?.address) {
      checkMembership();
    } else if (!authenticated) {
      // If not authenticated, mark membership check as complete (no need to check)
      setIsMembershipCheckComplete(true);
    }
  }, [authenticated, user?.wallet?.address, programAddress]);

  const handleClaimLoyaltyPass = async () => {
    if (!authenticated || !user?.wallet?.address || !programDetails) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (isAlreadyMember) {
      toast.error('You already have a loyalty pass for this program');
      return;
    }

    if (!programDetails.claimEnabled) {
      toast.error('Claiming is currently disabled for this program. Please contact the program creator.');
      return;
    }

    setIsClaiming(true);

    try {
      // Check if creator has sufficient Verxio credits (500 required for pass issuance)
      const creditCheck = await getUserVerxioCreditBalance(programDetails.creator);
      if (!creditCheck.success || (creditCheck.balance || 0) < 500) {
        toast.error(`Insufficient Verxio credits. Program creator needs at least 500 credits to issue loyalty passes. Current balance: ${creditCheck.balance || 0} credits.`);
        return;
      }

      // Get Verxio configuration
      const config = await getVerxioConfig();
      if (!config.rpcEndpoint || !config.privateKey) {
        toast.error('Failed to get Verxio configuration');
        return;
      }

      // Initialize Verxio
      const initResult = await initializeVerxio(user.wallet.address, config.rpcEndpoint, config.privateKey);
      if (!initResult.success || !initResult.context) {
        toast.error('Failed to initialize Verxio program');
        return;
      }

      const context = initResult.context;
      context.collectionAddress = publicKey(programAddress);

      // Get collection authority
      const authorityResult = await getCollectionAuthoritySecretKey(programAddress);
      if (!authorityResult.success || !authorityResult.authoritySecretKey) {
        toast.error('Failed to get collection authority');
        return;
      }

      const authoritySecretKey = authorityResult.authoritySecretKey;

      // Create asset keypair using authority secret key
      const assetKeypair = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));

      const issueParams = {
        collectionAddress: programAddress,
        recipient: user.wallet.address,
        passName: `${programDetails.name} Pass`,
        passMetadataUri: programDetails.uri,
        assetSigner: generateSigner(context.umi),
        updateAuthority: assetKeypair,
        organizationName: programDetails.metadata?.organizationName
      };

      // Issue new loyalty pass
      const result = await issueNewLoyaltyPass(context, issueParams);

      // Save to database
      const passData = {
        programAddress: programAddress,
        recipient: user.wallet.address,
        passPublicKey: result.asset.publicKey,
        passPrivateKey: uint8ArrayToBase58String(result.asset.secretKey),
        signature: result.signature
      };

      const saveResult = await saveLoyaltyPass(passData);
      if (!saveResult.success) {
        console.warn('Failed to save loyalty pass to database:', saveResult.error);
      }

      // Deduct 500 Verxio credits from the program creator for issuing the loyalty pass
      const deductionResult = await awardOrRevokeLoyaltyPoints({
        creatorAddress: programDetails.creator,
        points: 500,
        assetAddress: result.asset.publicKey,
        assetOwner: user.wallet.address,
        action: 'REVOKE'
      });

      if (!deductionResult.success) {
        console.error('Failed to deduct Verxio credits from creator:', deductionResult.error);
        // Don't fail the entire operation, just log the error
      }

      // Show success
      setSuccessData({
        passAddress: result.asset.publicKey,
        programName: programDetails.name
      });
      setShowSuccess(true);
      setIsAlreadyMember(true); // This will stop the polling

    } catch (error) {
      console.error('Error claiming loyalty pass:', error);
      toast.error('Failed to claim loyalty pass. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard!');
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading Program...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!programDetails) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Program Not Found</h2>
            <p className="text-gray-300 text-sm">The loyalty program could not be found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Tiles rows={50} cols={50} tileSize="md" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="relative w-10 h-10">
          <Image
            src="/logo/verxioIconWhite.svg"
            alt="Verxio"
            width={40}
            height={40}
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center gap-4">
          {authenticated && (
            <>
              <span className="text-white text-sm">
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
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

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
        {!isMembershipCheckComplete ? (
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">
              {!authenticated ? 'Loading...' : 'Checking membership...'}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto"
          >
            <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
            <div className="relative">
              {/* Program Details */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-600 to-orange-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{programDetails.name}</h2>
                <p className="text-zinc-400 text-sm">{programDetails.metadata.organizationName}</p>
              </div>

              {/* Program Info */}
              <div className="p-4 bg-black/20 rounded-lg border border-white/10 mb-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Program Address:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-white font-mono text-xs">
                        {programDetails.collectionAddress.slice(0, 8)}...{programDetails.collectionAddress.slice(-8)}
                      </code>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70 text-sm">Members:</span>
                    <span className="text-white font-medium">{programDetails.numMinted}</span>
                  </div>
                  {programDetails.collectionAddress && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/70 text-sm">Details:</span>
                      <a
                        href={`https://solscan.io/token/${programDetails.collectionAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Claim Status */}
              {!programDetails.claimEnabled ? (
                <div className="p-4 bg-red-500/20 rounded-lg border border-red-500/30 mb-6">
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-400 font-medium mb-1">Claiming Disabled</p>
                    <p className="text-red-300 text-sm">This program is not accepting new members at the moment.</p>
                    <p className="text-red-300 text-xs mt-2">Please contact the program creator for assistance.</p>
                  </div>
                </div>
              ) : isAlreadyMember ? (
                <div className="p-4 bg-green-500/20 rounded-lg border border-green-500/30 mb-6">
                  <div className="text-center">
                    <p className="text-green-300 text-sm">You're already a member of this program.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center mb-6">
                  <p className="text-blue-300 text-sm">Claim your loyalty pass and start earning rewards.</p>
                </div>
              )}

              {/* Action Button */}
              {!authenticated ? (
                <div className="text-center py-4">
                  <button
                    onClick={login}
                    className="bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : !programDetails.claimEnabled ? (
                <button
                  disabled
                  className="w-full bg-gray-500 cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium opacity-50"
                >
                  Claiming Disabled
                </button>
              ) : isAlreadyMember ? (
                <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
              >
                Go to Dashboard
              </button>
              ) : (
                <button
                  onClick={handleClaimLoyaltyPass}
                  disabled={isClaiming}
                  className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50 py-3 px-6 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl shadow-[#00adef]/25 hover:shadow-[#00adef]/40 transform hover:scale-105 disabled:hover:scale-100"
                >
                  {isClaiming ? (
                    <div className="flex items-center gap-2 justify-center">
                      <VerxioLoaderWhite size="sm" />
                      Claiming Pass...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 justify-center">
                      Claim Loyalty Pass
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
        )}
      </div>

      {/* Success Page */}
      {showSuccess && successData && (
        <div className="fixed inset-0 z-50 bg-black">
          <Tiles rows={50} cols={50} tileSize="md" />
          <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto"
            >
              <div className="bg-black border border-zinc-800 p-6 max-w-md w-full rounded-xl relative overflow-hidden">
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Welcome to {successData.programName}!</h3>
                    <p className="text-white/80">Your loyalty pass has been issued successfully!</p>

                    <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white">Program:</span>
                        <span className="text-white font-medium">{successData.programName}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white">Pass Address:</span>
                        <span className="text-white font-mono text-sm truncate max-w-32">
                          {successData.passAddress.slice(0, 8)}...{successData.passAddress.slice(-8)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 space-y-3">
                      <button
                        onClick={() => setShowSuccess(false)}
                        className="w-full bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                      >
                        Continue
                      </button>
                      <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200"
                      >
                        Go to Dashboard
                      </button>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
    </div>
  );
}
