'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Gift, ExternalLink, Copy, ArrowLeft } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";
import { getLoyaltyProgramDetails, getCollectionAuthoritySecretKey, getLoyaltyProgramUsers, toggleClaimEnabled, getClaimStatus, checkUserLoyaltyProgramMembership, getLoyaltyPassDetails } from '@/app/actions/loyalty';
import { getUserByEmail, getUserByWallet } from '@/app/actions/user';
import { saveLoyaltyPass, getLoyaltyPassesByProgram } from '@/app/actions/loyalty-pass';
import { usePrivy } from '@privy-io/react-auth';
import { initializeVerxio, issueNewLoyaltyPass, giftPoints, revokePoints } from '@/app/actions/verxio';
import { convertSecretKeyToKeypair, uint8ArrayToBase58String } from '@/lib/utils';
import { createSignerFromKeypair, generateSigner, publicKey } from '@metaplex-foundation/umi';
import { getVerxioConfig } from '@/app/actions/loyalty';
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from '@/app/actions/verxio-credit';

type TabType = 'issue' | 'gift' | 'revoke' | 'tiers' | 'members';

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

export default function LoyaltyProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ITEMS_PER_PAGE = 10;

  const [programDetails, setProgramDetails] = useState<ProgramDetails | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('issue');
  const [isLoading, setIsLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [claimEnabled, setClaimEnabled] = useState<boolean | undefined>(undefined);
  const [memberEmails, setMemberEmails] = useState<Record<string, string | null>>({});
  const { user } = usePrivy();

  // MemberEmail component to display user email
  const MemberEmail = ({ owner, emails }: { owner: string; emails: Record<string, string | null> }) => {
    const email = emails[owner];

    if (email === undefined) {
      return <p className="text-white/40 text-xs">Loading...</p>;
    }

    if (!email) {
      return <p className="text-white/40 text-xs">No email</p>;
    }

    return <p className="text-white/60 text-xs">{email}</p>;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  useEffect(() => {
    const fetchProgramDetails = async () => {
      if (!user?.wallet?.address || !params.collectionAddress) {
        setIsLoading(false);
        return;
      }

      try {
        const details = await getLoyaltyProgramDetails(
          user.wallet.address,
          params.collectionAddress as string
        );

        if (details.success && details.programDetails) {
          const programData = {
            ...details.programDetails,
            claimEnabled: true // This will be updated when we fetch the actual claim status
          };
          setProgramDetails(programData);
        }
      } catch (error) {
        console.error('Error fetching program details:', error);
      }

      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    };

    fetchProgramDetails();
  }, [params.collectionAddress, user?.wallet?.address]);

  const handleClose = () => {
    router.push('/manage');
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard!');
  };

  const getUsers = async () => {
    setMembersLoading(true);
    try {
      const result: any = await getLoyaltyProgramUsers(params.collectionAddress as string);
      if (result.success && result.users) {
        const sortedMembers = result.users.items.sort((a: any, b: any) => {
          const aXp = a.external_plugins?.[0]?.data?.xp;
          const bXp = b.external_plugins?.[0]?.data?.xp;
          return bXp - aXp;
        });

        setAllMembers(sortedMembers);
        setMembers(sortedMembers.slice(0, ITEMS_PER_PAGE));
        setTotalMembers(result.users.total);
        setCurrentPage(1);

        // Fetch all member emails at once
        const emailPromises = sortedMembers.map(async (member: any) => {
          const owner = member.ownership?.owner;
          if (owner) {
            try {
              const userResult = await getUserByWallet(owner);
              return { owner, email: userResult.success ? userResult.user?.email || null : null };
            } catch (error) {
              console.error('Error fetching email for', owner, error);
              return { owner, email: null };
            }
          }
          return { owner: null, email: null };
        });

        const emailResults = await Promise.all(emailPromises);
        const emailMap: Record<string, string | null> = {};
        emailResults.forEach(({ owner, email }) => {
          if (owner) {
            emailMap[owner] = email;
          }
        });
        setMemberEmails(emailMap);
      } else {
        console.error('Error:', result.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setMembersLoading(false);
    }
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > Math.ceil(totalMembers / ITEMS_PER_PAGE)) return;

    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    setMembers(allMembers.slice(startIndex, endIndex));
    setCurrentPage(page);
  }

  useEffect(() => {
    if (params.collectionAddress) {
      getUsers();
    }
  }, [params.collectionAddress]);

  // Fetch claim status when component mounts
  useEffect(() => {
    const fetchClaimStatus = async () => {
      if (!params.collectionAddress) return;

      try {
        const result = await getClaimStatus(params.collectionAddress as string);
        if (result.success) {
          setClaimEnabled(result.claimEnabled);
        }
      } catch (error) {
        console.error('Error fetching claim status:', error);
        setClaimEnabled(true); // Default to true on error
      }
    };

    fetchClaimStatus();
  }, [params.collectionAddress]);

  const handleSubmit = async (action: TabType) => {
    if (!user?.wallet?.address || !programDetails) {
      toast.error('Wallet not connected or program details not loaded');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get Verxio configuration from server
      const config = await getVerxioConfig();
      if (!config.rpcEndpoint || !config.privateKey) {
        toast.error('Failed to get Verxio configuration');
        return;
      }
      const initResult = await initializeVerxio(user.wallet.address, config.rpcEndpoint, config.privateKey);
      if (!initResult.success || !initResult.context) {
        toast.error('Failed to initialize Verxio program');
        return;
      }

      const context = initResult.context;
      context.collectionAddress = publicKey(params.collectionAddress as string);

      // Get the authority secret key for this collection
      const authorityResult = await getCollectionAuthoritySecretKey(params.collectionAddress as string);
      if (!authorityResult.success || !authorityResult.authoritySecretKey) {
        toast.error('Failed to get collection authority: ' + authorityResult.error);
        return;
      }

      const authoritySecretKey = authorityResult.authoritySecretKey;
      if (action === 'issue') {
        if (!recipientEmail.trim()) {
          toast.error('Please enter a recipient email address');
          return;
        }

        // Fetch user wallet address from email
        const userResult = await getUserByEmail(recipientEmail.trim());
        if (!userResult.success || !userResult.user?.walletAddress) {
          setRecipientEmail('');
          toast.error('User not found. Please check the email address or ask the user to create an account first.');
          return;
        }
 

        const recipientWalletAddress = userResult.user.walletAddress;

        // Check if recipient is already a member
        const membershipCheck = await checkUserLoyaltyProgramMembership(recipientWalletAddress, params.collectionAddress as string);
        if (membershipCheck.success && membershipCheck.isMember) {
          setRecipientEmail('');
          toast.error('This user is already a member!');
          return;
        }

        // Check if user has sufficient Verxio credits (minimum 1000 required for issuing passes)
        const creditCheck = await getUserVerxioCreditBalance(user.wallet.address);
        if (!creditCheck.success || (creditCheck.balance || 0) < 1000) {
          toast.error(`Insufficient Verxio credits. You need at least 1000 credits to issue loyalty passes. Current balance: ${creditCheck.balance || 0} credits.`);
          return;
        }

        // Create a new keypair for the asset using the authority secret key
        const assetKeypair = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
        const issueParams = {
          collectionAddress: params.collectionAddress as string,
          recipient: recipientWalletAddress,
          passName: `${programDetails.name}`,
          passMetadataUri: programDetails.uri,
          assetSigner: generateSigner(context.umi),
          updateAuthority: assetKeypair,
          organizationName: programDetails.metadata?.organizationName
        };

        const result = await issueNewLoyaltyPass(context, issueParams);
        const passData = {
          programAddress: params.collectionAddress as string,
          recipient: recipientWalletAddress,
          passPublicKey: result.asset.publicKey,
          passPrivateKey: uint8ArrayToBase58String(result.asset.secretKey),
          signature: result.signature
        };

        const saveResult = await saveLoyaltyPass(passData);
        if (!saveResult.success) {
          console.warn('Failed to save loyalty pass to database:', saveResult.error);
          // Don't fail the entire operation, just log the warning
        }

        // Deduct 500 Verxio credits for issuing loyalty pass
        const deductionResult = await awardOrRevokeLoyaltyPoints({
          creatorAddress: user.wallet.address,
          points: 500,
          assetAddress: result.asset.publicKey,
          assetOwner: recipientWalletAddress,
          action: 'REVOKE'
        });

        if (!deductionResult.success) {
          console.error('Failed to deduct Verxio credits:', deductionResult.error);
          // Don't fail the entire operation, just log the error
        }

        toast.success(`Loyalty pass issued successfully to ${recipientEmail.trim()}`);
        setRecipientEmail('');
        await getUsers();

      } else if (action === 'gift') {
        if (!userEmail.trim() || !points.trim()) {
          toast.error('Please enter both user email and points');
          return;
        }

        const pointsToGift = parseInt(points);
        if (isNaN(pointsToGift) || pointsToGift <= 0) {
          toast.error('Please enter a valid positive number for points');
          return;
        }

        // Fetch user wallet address from email
        const userResult = await getUserByEmail(userEmail.trim());
        if (!userResult.success || !userResult.user?.walletAddress) {
          setUserEmail('');
          toast.error('User not found. Please check the email address or ask the user to create an account first.');
          return;
        }

        const userWalletAddress = userResult.user.walletAddress;

        // Get loyalty passes for this program and find the one owned by this user
        const loyaltyPassesResult = await getLoyaltyPassesByProgram(params.collectionAddress as string);
        if (!loyaltyPassesResult.success || !loyaltyPassesResult.passes) {
          toast.error('Failed to fetch loyalty passes for this program');
          return;
        }

        const userPass = loyaltyPassesResult.passes.find(pass => pass.recipient === userWalletAddress);
        if (!userPass) {
          toast.error('No loyalty pass found for this user in this program. Please issue a loyalty pass first.');
          return;
        }

        // Check if user has sufficient Verxio credits (must have at least the amount they want to gift)
        const creditCheck = await getUserVerxioCreditBalance(user.wallet.address);
        if (!creditCheck.success || (creditCheck.balance || 0) < pointsToGift) {
          toast.error(`Insufficient Verxio credits. You need at least ${pointsToGift} credits to gift ${pointsToGift} points. Current balance: ${creditCheck.balance || 0} credits.`);
          return;
        }

        // Create a signer for the gift action using the authority secret key
        const giftSigner = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
        const giftParams = {
          passAddress: userPass.passPublicKey,
          pointsToGift,
          signer: giftSigner,
          action: `${reason.trim() || 'No reason provided'}`
        };

        // Deduct Verxio credits equal to the points gifted
        const deductionResult = await awardOrRevokeLoyaltyPoints({
          creatorAddress: user.wallet.address,
          points: pointsToGift,
          assetAddress: userPass.passPublicKey,
          assetOwner: userWalletAddress,
          action: 'REVOKE'
        });

        if (!deductionResult.success) {
          console.error('Failed to deduct Verxio credits:', deductionResult.error);
          // Don't fail the entire operation, just log the error
        }
        
        await giftPoints(context, giftParams);
        toast.success(`Points gifted successfully to ${userEmail.trim()}`);
        setUserEmail('');
        setPoints('');
        setReason('');
        await getUsers();

      } else if (action === 'revoke') {
        if (!userEmail.trim() || !points.trim()) {
          toast.error('Please enter both user email and points');
          return;
        }

        const pointsToRevoke = parseInt(points);
        if (isNaN(pointsToRevoke) || pointsToRevoke <= 0) {
          toast.error('Please enter a valid positive number for points');
          return;
        }

        // Fetch user wallet address from email
        const userResult = await getUserByEmail(userEmail.trim());
        if (!userResult.success || !userResult.user?.walletAddress) {
          setUserEmail('');
          toast.error('User not found. Please check the email address or ask the user to create an account first.');
          return;
        }

        const userWalletAddress = userResult.user.walletAddress;

        // Get loyalty passes for this program and find the one owned by this user
        const loyaltyPassesResult = await getLoyaltyPassesByProgram(params.collectionAddress as string);
        if (!loyaltyPassesResult.success || !loyaltyPassesResult.passes) {
          toast.error('Failed to fetch loyalty passes for this program');
          return;
        }

        const userPass = loyaltyPassesResult.passes.find((pass: any) => pass.recipient === userWalletAddress);
        if (!userPass) {
          toast.error('No loyalty pass found for this user in this program. Please issue a loyalty pass first.');
          return;
        }

        // Create a signer for the revoke action using the authority secret key
        const revokeSigner = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
        const revokeParams = {
          passAddress: userPass.passPublicKey,
          pointsToRevoke,
          signer: revokeSigner
        };

        await revokePoints(context, revokeParams);
        toast.success(`Points revoked successfully from ${userEmail.trim()}`);
        setUserEmail('');
        setPoints('');
        await getUsers();
      }

    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      toast.error(`Failed to ${action}. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExplorerUrl = (address: string) => {
    return `https://solscan.io/token/${address}`;
  };

  if (isLoading || !programDetails) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
      <AppLayout currentPage="dashboard">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">{programDetails?.name}</h1>
              <p className="text-gray-400">Manage your loyalty program</p>
            </div>
          </div>

          {/* Program Details */}
          <Card className="bg-black/50 border-white/10 text-white relative">
            <CardContent>
              <div className="space-y-4">
                {/* Program Name & Organization */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {programDetails?.metadata?.organizationName}
                      </div>
                    </div>
                  </div>
                  <a
                    href={getExplorerUrl(params.collectionAddress as string)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors text-xs flex items-center space-x-1"
                  >
                    <span>View on Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Claim Link Section - Local Toggle Only */}
                <div className="space-y-3 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">Claim Link</span>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={claimEnabled}
                            disabled={claimEnabled === undefined}
                            onChange={async () => {
                              if (claimEnabled === undefined) return; // Don't allow toggle while loading

                              const newStatus = !claimEnabled;
                              const result = await toggleClaimEnabled(params.collectionAddress as string, newStatus);

                              if (result.success) {
                                setClaimEnabled(newStatus);
                                if (programDetails) {
                                  setProgramDetails({
                                    ...programDetails,
                                    claimEnabled: newStatus
                                  });
                                }
                                toast.success(result.message);
                              } else {
                                toast.error(result.error || 'Failed to toggle claim status');
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-xs text-gray-400">
                          {claimEnabled === undefined ? 'Loading...' : (claimEnabled ? 'Enabled' : 'Disabled')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {claimEnabled === undefined ? (
                    <div className="text-center py-2">
                      <div className="text-gray-400 text-sm">Loading claim status...</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {claimEnabled && (
                        <div className="text-xs text-gray-400">Share this link for users to claim loyalty passes:</div>
                      )}
                      <div className="flex items-center justify-between p-2 bg-black/20 rounded border border-white/10">
                        <code className="text-xs text-white truncate flex-1 mr-2">
                          {typeof window !== 'undefined' ? `${window.location.origin}/claim/${params.collectionAddress}` : ''}
                        </code>
                        <button
                          onClick={() => {
                            const claimUrl = `${window.location.origin}/claim/${params.collectionAddress}`;
                            navigator.clipboard.writeText(claimUrl);
                            toast.success('Claim link copied to clipboard!');
                          }}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white"
                          title="Copy claim link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Update Authority */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-400">Update Authority</div>
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-white bg-white/10 px-2 py-1 rounded text-[10px]">
                      {programDetails?.updateAuthority}
                    </code>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => programDetails?.updateAuthority && handleCopyAddress(programDetails.updateAuthority)}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tiers and Rewards */}
          {programDetails?.tiers && programDetails.tiers.length > 0 ? (
            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader
                className="cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setActiveTab(activeTab === 'tiers' ? 'issue' : 'tiers')}
              >
                <CardTitle className="text-lg text-white flex items-center justify-between">
                  Reward Tiers
                  <span className="text-sm text-gray-400">
                    {activeTab === 'tiers' ? '▼' : '▶'}
                  </span>
                </CardTitle>
              </CardHeader>
              {activeTab === 'tiers' && (
                <CardContent>
                  <div className="space-y-3">
                    {programDetails.tiers.map((tier, index) => (
                      <div key={index} className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-3 border border-white/20 hover:border-white/30 transition-all duration-300">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${index === 0 ? 'bg-gradient-to-br from-amber-500 to-yellow-600' :
                                index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                                  'bg-gradient-to-br from-orange-500 to-red-600'
                              }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                            <div>
                              <h4 className="text-base font-semibold text-white">{tier.name}</h4>
                              <p className="text-white/60 text-xs">Tier {index + 1}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-400">{tier.xpRequired}</div>
                            <div className="text-white/60 text-xs">XP</div>
                          </div>
                        </div>

                        <div className="bg-white/10 rounded p-2">
                          <h5 className="text-white font-medium mb-1 text-xs">Rewards</h5>
                          <div className="flex flex-wrap gap-1">
                            {tier.rewards.map((reward, rewardIndex) => (
                              <span
                                key={rewardIndex}
                                className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium border border-blue-400/30"
                              >
                                {reward}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ) : (
            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-lg text-white">Reward Tiers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-2">
                    <VerxioLoaderWhite size="sm" />
                    <span className="text-gray-400 text-sm">Loading tiers...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members Section */}
          <Card className="bg-black/50 border-white/10 text-white">
            <CardHeader
              className="cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => setActiveTab(activeTab === 'members' ? 'issue' : 'members')}
            >
              <CardTitle className="text-lg text-white flex items-center justify-between">
                Program Members
                <span className="text-sm text-gray-400">
                  {activeTab === 'members' ? '▼' : '▶'}
                </span>
              </CardTitle>
            </CardHeader>
            {activeTab === 'members' && (
              <CardContent>
                {membersLoading && members.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <VerxioLoaderWhite size="sm" />
                      <span className="text-gray-400 text-sm">Loading members...</span>
                    </div>
                  </div>
                ) : members.length > 0 ? (
                  <div className="space-y-3">
                    {members.map((member, index) => {
                      const memberData = member.external_plugins?.[0]?.data;
                      const currentTier = memberData?.current_tier;
                      const xp = memberData?.xp || 0;
                      const owner = member.ownership?.owner;

                      return (
                        <div key={index} className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-3 border border-white/20 hover:border-white/30 transition-all duration-300">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                👤
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-white">
                                  {owner.slice(0, 6)}...{owner.slice(-6)}
                                </h4>
                                <MemberEmail owner={owner} emails={memberEmails} />
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-green-400">{formatNumber(xp)}</div>
                              <div className="text-white/60 text-xs">verxio points</div>
                            </div>
                          </div>

                          <div className="bg-white/10 rounded p-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-white font-medium text-xs">Current Tier</h5>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${currentTier === 'Gold' ? 'bg-gradient-to-r from-amber-500/20 to-yellow-600/20 text-amber-300 border border-amber-400/30' :
                                  currentTier === 'Silver' ? 'bg-gradient-to-r from-gray-400/20 to-gray-600/20 text-gray-300 border border-gray-400/30' :
                                    currentTier === 'Bronze' ? 'bg-gradient-to-r from-orange-500/20 to-red-600/20 text-orange-300 border border-orange-400/30' :
                                      'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 border border-blue-400/30'
                                }`}>
                                {currentTier}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagination Controls */}
                    <div className="flex flex-col items-center pt-4 border-t border-white/20 space-y-3">
                      <div className="text-xs text-gray-400">
                        Page {currentPage} of {Math.ceil(totalMembers / ITEMS_PER_PAGE)}
                      </div>
                      <div className="flex items-center space-x-4">
                        {currentPage > 1 && (
                          <Button
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={membersLoading}
                            className="bg-gradient-to-r from-[#0088c1] to-[#005a7a] hover:from-[#0077a8] hover:to-[#004d6b] text-white disabled:opacity-50"
                          >
                            Previous
                          </Button>
                        )}
                        {currentPage < Math.ceil(totalMembers / ITEMS_PER_PAGE) && (
                          <Button
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={membersLoading}
                            className="bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50"
                          >
                            Next
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <span className="text-gray-400 text-sm">No members found</span>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Action Tabs */}
          <Card className="bg-black/50 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg text-white">Loyalty Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {programDetails ? (
                <>
                  {/* Tab Navigation */}
                  <div className="flex space-x-1 mb-6 bg-white/10 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('issue')}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${activeTab === 'issue'
                          ? 'bg-white text-black'
                          : 'text-gray-300 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Issue Pass</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('gift')}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${activeTab === 'gift'
                          ? 'bg-white text-black'
                          : 'text-gray-300 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Gift Points</span>
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('revoke')}
                      className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors ${activeTab === 'revoke'
                          ? 'bg-white text-black'
                          : 'text-gray-300 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <span>Revoke Points</span>
                      </div>
                    </button>
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'issue' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="recipient" className="text-white text-sm">Recipient Email</Label>
                        <Input
                          id="recipient"
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="Enter email address"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <Button
                        onClick={() => handleSubmit('issue')}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <VerxioLoaderWhite size="sm" /> : 'Issue Loyalty Pass'}
                      </Button>
                    </div>
                  )}

                  {activeTab === 'gift' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="userEmail" className="text-white text-sm">User Email</Label>
                        <Input
                          id="userEmail"
                          type="email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          placeholder="Enter user email address"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="giftPoints" className="text-white text-sm">Points to Gift</Label>
                        <Input
                          id="giftPoints"
                          type="number"
                          value={points}
                          onChange={(e) => setPoints(e.target.value)}
                          placeholder="Enter points amount"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="giftReason" className="text-white text-sm">Reason (Optional)</Label>
                        <Input
                          id="giftReason"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Enter reason for gifting points"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <Button
                        onClick={() => handleSubmit('gift')}
                        className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <VerxioLoaderWhite size="sm" /> : 'Gift Points'}
                      </Button>
                    </div>
                  )}

                  {activeTab === 'revoke' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="revokeUserEmail" className="text-white text-sm">User Email</Label>
                        <Input
                          id="revokeUserEmail"
                          type="email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          placeholder="Enter user email address"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="revokePoints" className="text-white text-sm">Points to Revoke</Label>
                        <Input
                          id="revokePoints"
                          type="number"
                          value={points}
                          onChange={(e) => setPoints(e.target.value)}
                          placeholder="Enter points amount"
                          className="bg-black/20 border-white/20 text-white placeholder:text-white/40"
                        />
                      </div>
                      <Button
                        onClick={() => handleSubmit('revoke')}
                        className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <VerxioLoaderWhite size="sm" /> : 'Revoke Points'}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-2">
                    <VerxioLoaderWhite size="sm" />
                    <span className="text-gray-400 text-sm">Loading actions...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </>
  );
}
