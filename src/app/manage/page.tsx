
'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, CreditCard, Users, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getUserLoyaltyPrograms, getLoyaltyProgramDetails } from '@/app/actions/loyalty';
import { usePrivy } from '@privy-io/react-auth';

interface LoyaltyProgram {
  id: string;
  name: string;
  programPublicKey?: string;
  programDetails?: any;
}

export default function ManageLoyaltyProgram() {
  const [isLoading, setIsLoading] = useState(true);
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgram[]>([]);
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const router = useRouter();
  const { user } = usePrivy();

  useEffect(() => {
    // Show loader for a brief moment
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user's loyalty programs
  useEffect(() => {
    const fetchLoyaltyPrograms = async () => {
      if (user?.wallet?.address) {
        setIsLoadingPrograms(true);
        try {
          const result = await getUserLoyaltyPrograms(user.wallet.address);
          
          if (result.success && result.programs) {
            const uiPrograms: LoyaltyProgram[] = result.programs.map((program: any) => ({
              id: program.id,
              name: program.programPublicKey,
              programPublicKey: program.programPublicKey
            }));
            
            setLoyaltyPrograms(uiPrograms);

            for (const program of result.programs) {
              try {
                const details = await getLoyaltyProgramDetails(program.creator, program.programPublicKey);
                if (details.success && details.programDetails) {
                  setLoyaltyPrograms(prev => prev.map(p => {
                    if (p.programPublicKey === program.programPublicKey) {
                      return {
                        ...p,
                        name: details.programDetails?.name,
                        programDetails: details.programDetails
                      };
                    }
                    return p;
                  }));
                }
              } catch (error) {
                console.error(`Error fetching details for program ${program.programPublicKey}:`, error);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching loyalty programs:', error);
        } finally {
          setIsLoadingPrograms(false);
        }
      }
    };

    fetchLoyaltyPrograms();
  }, [user?.wallet?.address]);

  const handleCreateLoyalty = () => {
    router.push('/create/loyalty');
  };

  const handleViewPasses = () => {
    router.push('/pass');
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
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Loyalty Management</h1>
          <p className="text-sm text-gray-400">Manage your loyalty programs and customer rewards</p>
        </div>

        {/* Quick Actions */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardContent>
            <div className="space-y-3">
              <button 
                onClick={handleCreateLoyalty}
                className="w-full p-4 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Create Loyalty Program</div>
                    <div className="text-xs text-gray-300">Build new loyalty programs</div>
                  </div>
                </div>
              </button>
              
              <button 
                onClick={handleViewPasses}
                className="w-full p-4 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">View Loyalty Passes</div>
                    <div className="text-xs text-gray-300">See all issued passes</div>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Programs */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">My Loyalty Programs</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPrograms ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : (
              <div className="space-y-3">
                {loyaltyPrograms.length > 0 ? (
                  loyaltyPrograms.map((program) => (
                    <div 
                      key={program.id} 
                      className="p-4 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => {
                        if (program.programDetails?.collectionAddress) {
                          // Store program details in sessionStorage for the detail page
                          sessionStorage.setItem('currentProgramDetails', JSON.stringify(program.programDetails));
                          router.push(`/manage/program/${program.programDetails.collectionAddress}`);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center">
                            <Gift className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{program.name}</div>
                            <div className="text-xs text-blue-400">
                              {program.programDetails?.numMinted} members • {program.programDetails?.tiers?.length} reward tiers
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-green-400">Active</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No loyalty programs yet</p>
                    <p className="text-xs">Create your first program to get started</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
} 