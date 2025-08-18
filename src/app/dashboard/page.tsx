'use client';

// import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/app-layout';
import { Gift, Users, Copy, Check } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getUserStats } from '@/app/actions/stats';
import { Spinner } from '@/components/ui/spinner';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function Dashboard() {
  const router = useRouter();
  const { user } = usePrivy();
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({
    usdcBalance: '0.00',
    loyaltyProgramCount: 0,
    totalMembers: 0,
    totalRevenue: '0.00',
    totalDiscounts: '0.00',
    recentPayments: [] as Array<{
      amount: string;
      loyaltyDiscount: string;
      createdAt: string;
      reference: string;
    }>
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    // Show loader for a brief moment
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch user stats when user is available
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.wallet?.address) return;
      
      try {
        setStatsLoading(true);
        const result = await getUserStats(user.wallet.address);
        
        if (result.success && result.stats) {
          setStats(result.stats);
        } else {
          console.error('Failed to fetch stats:', result.error);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user?.wallet?.address]);

  const handleCreateVoucher = () => {
    router.push('/voucher');
  };

  const handleLoyaltyManagement = () => {
    router.push('/manage');
  };

  const handleCopyAddress = async () => {
    if (user?.wallet?.address) {
      try {
        await navigator.clipboard.writeText(user.wallet.address);
        setCopied(true);
        toast.success('Wallet address copied!', {
          position: 'top-right',
          autoClose: 3000,
          theme: 'dark',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy address', {
          position: 'top-right',
          autoClose: 3000,
          theme: 'dark',
        });
      }
    }
  };


  if (isLoading) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Spinner size="lg" />
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
        {/* Welcome Card */}
        <Card className="bg-black/50 border-white/10 text-white">
          {/* <CardHeader>
            <CardTitle className="text-lg text-white">Welcome back!</CardTitle>
          </CardHeader> */}
          <CardContent>
            <div className="space-y-4">
              {/* USDC Balance */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">USDC Balance</span>
                  <span className="text-xs text-gray-400">Solana</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {statsLoading ? (
                    <Spinner size="md" className="mx-auto" />
                  ) : (
                    `$${stats.usdcBalance}`
                  )}
                </div>
                {/* <div className="text-xs text-gray-400 mt-1">0.00 USDC</div> */}
                
                {/* User Wallet Address */}
                {user?.wallet?.address && (
                  <div className="flex items-center justify-between mt-3 p-2 bg-white/5 rounded border border-white/10">
                    <span className="text-xs text-gray-300 font-mono">
                      {user.wallet.address.slice(0, 8)}...{user.wallet.address.slice(-6)}
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                      title="Copy wallet address"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Loyalty Program Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-lg font-bold text-white">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    stats.loyaltyProgramCount.toLocaleString()
                  )}
                </div>
                  <div className="text-xs text-gray-300">Loyalty Programs</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
                  <div className="text-lg font-bold text-white">
                    {statsLoading ? (
                      <Spinner size="sm" className="mx-auto" />
                    ) : (
                      stats.totalMembers.toLocaleString()
                    )}
                  </div>
                  <div className="text-xs text-gray-300">Total Members</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Discounts */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">Revenue & Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
                <div className="text-lg font-bold text-green-400">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    `$${stats.totalRevenue}`
                  )}
                </div>
                <div className="text-xs text-gray-300">Total Revenue</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-center">
                <div className="text-lg font-bold text-blue-400">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                    ) : (
                    `$${stats.totalDiscounts}`
                  )}
                </div>
                <div className="text-xs text-gray-300">Discounts Given</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-lg text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleCreateVoucher}
                  className="p-4 border border-white/10 rounded-lg hover:bg-white/10 text-left transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center mb-2">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">Loyalty Voucher</div>
                  <div className="text-xs text-gray-300">Manage loyalty voucher</div>
                </button>
                <button 
                  onClick={handleLoyaltyManagement}
                  className="p-4 border border-white/10 rounded-lg hover:bg-white/10 text-left transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white">Loyalty Program</div>
                  <div className="text-xs text-gray-300">Manage loyalty program</div>
                </button>
              </div>
              
              {/* <button 
                onClick={() => router.push('/history')}
                className="w-full p-4 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">Recent Activity</div>
                    <div className="text-xs text-gray-300">View transaction history</div>
                  </div>
                </div>
              </button> */}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {stats.recentPayments.length > 0 && (
          <Card className="bg-black/50 border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg text-white">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentPayments.map((payment, index) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">
                          Payment: {payment.reference.slice(0, 8)}...
                        </div>
                        <div className="text-xs text-gray-300">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400">
                          ${parseFloat(payment.amount).toLocaleString()}
                        </div>
                        {payment.loyaltyDiscount !== '0' && (
                          <div className="text-xs text-blue-400">
                            -${payment.loyaltyDiscount} discount
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
        </AppLayout>
      </>
    );
  } 