'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Star, ArrowLeft, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { getUserLoyaltyPasses } from '@/app/actions/loyalty';

export default function LoyaltyPasses() {
  const [isLoading, setIsLoading] = useState(true);
  const [loyaltyPasses, setLoyaltyPasses] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = usePrivy();

  useEffect(() => {
    const fetchLoyaltyPasses = async () => {
      if (!user?.wallet?.address) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      
      try {
        const result = await getUserLoyaltyPasses(user.wallet.address);
        if (result.success && result.loyaltyPasses) {
          setLoyaltyPasses(result.loyaltyPasses);
        } else {
          setError(result.error);
        }
      } catch (error) {
        console.error('Error fetching loyalty passes:', error);
        setError('Failed to fetch loyalty passes');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoyaltyPasses();
  }, [user?.wallet?.address]);

  const handleBack = () => {
    router.back();
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'Gold':
        return 'from-amber-500 to-yellow-600';
      case 'Silver':
        return 'from-gray-400 to-gray-600';
      case 'Bronze':
        return 'from-orange-500 to-red-600';
      default:
        return 'from-blue-500 to-purple-600';
    }
  };

  const getExplorerUrl = (address: string) => {
    return `https://solscan.io/token/${address}`;
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleBack}
            className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Loyalty Passes</h1>
            <p className="text-gray-400">View all issued loyalty passes</p>
          </div>
        </div>

        {/* Stats */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center space-x-2">
                  <VerxioLoaderWhite size="sm" />
                  <span className="text-gray-400 text-sm">Loading stats...</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{loyaltyPasses.length}</div>
                  <div className="text-xs text-gray-300">Total Passes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {loyaltyPasses.filter(pass => pass.currentTier && pass.currentTier !== 'None').length}
                  </div>
                  <div className="text-xs text-gray-300">Active</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {loyaltyPasses.reduce((total, pass) => total + (pass.xp || 0), 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-300">Verxio Points</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loyalty Passes List */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">Your Loyalty Passes</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8 text-red-400">
                <p className="text-sm">Error loading loyalty passes</p>
                <p className="text-xs">{error}</p>
              </div>
            ) : loyaltyPasses.length > 0 ? (
              <div className="space-y-3">
                {loyaltyPasses.map((pass, index) => (
                  <div key={pass.assetId} className="p-4 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${getTierColor(pass.currentTier)} rounded-lg flex items-center justify-center`}>
                          <CreditCard className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{pass.nftName}</div>
                          <div className="text-xs text-gray-300">{pass.organizationName}</div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-xs text-green-400 font-medium">{pass.currentTier} Tier</div>
                        <div className="text-xs text-gray-400">
                          {pass.tierUpdatedAt ? new Date(pass.tierUpdatedAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-center text-xs text-gray-300">
                        <div className="flex items-center space-x-1">
                          <Star className="w-3 h-3" color='gold' />
                          <span>{formatNumber(pass.xp)} VP</span>
                        </div>
                      </div>
                      
                      {pass.rewards && pass.rewards.length > 0 && (
                        <div className="bg-white/10 rounded p-2">
                          <h5 className="text-white font-medium mb-1 text-xs">Rewards</h5>
                          <div className="flex flex-wrap gap-1">
                            {pass.rewards.map((reward: string, rewardIndex: number) => (
                              <span
                                key={rewardIndex}
                                className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 px-2 py-1 rounded text-xs font-medium border border-blue-400/30"
                              >
                                {reward}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="text-xs text-gray-400">
                          Collection: {pass.collectionAddress.slice(0, 6)}...{pass.collectionAddress.slice(-6)}
                        </div>
                        <a 
                          href={getExplorerUrl(pass.assetId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No loyalty passes yet</p>
                <p className="text-xs">You haven't been issued any loyalty passes yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
