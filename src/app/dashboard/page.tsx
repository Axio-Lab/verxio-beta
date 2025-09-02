'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/app-layout';
import { Gift, Users, Copy, Check } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { getUserStats } from '@/app/actions/stats';
import { Spinner } from '@/components/ui/spinner';
import { toast, ToastContainer } from 'react-toastify';
import Image from 'next/image';
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
    verxioCreditBalance: 0,
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

  const handleSendTokens = () => {
    router.push('/send');
  };

  const handleFund = () => {
    router.push('/fund');
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
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/3 via-transparent to-purple-500/3 opacity-40"></div>
          
          <CardContent className="p-5 relative z-10">
            {/* Header with Balance */}
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white/70 uppercase tracking-wider">USDC Balance</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    `$${stats.usdcBalance}`
                  )}
                </div>
                {/* <span className="text-xs text-white/50 font-medium">Solana Network</span> */}
              </div>
              
              {/* Verxio Credits Badge */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30 rounded-full px-3 py-1.5">
                <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center">
                  <Image
                    src="/logo/verxioIconBlack.svg"
                    alt="Verxio"
                    width={8}
                    height={8}
                    className="w-2 h-2"
                  />
                </div>
                <span className="text-xs font-semibold text-white">
                  {statsLoading ? (
                    <Spinner size="sm" className="inline" />
                  ) : (
                    stats.verxioCreditBalance.toLocaleString()
                  )}
                </span>
                <span className="text-xs text-white/60">Credits</span>
              </div>
            </div>
            
            {/* Wallet Address */}
            {user?.wallet?.address && (
              <div className="flex items-center justify-between p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                  <span className="text-xs font-mono text-white/80">
                    {user.wallet.address.slice(0, 15)}...{user.wallet.address.slice(-10)}
                  </span>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-all duration-200 hover:scale-105 group"
                  title="Copy wallet address"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/60 group-hover:text-white" />
                  )}
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <button
                onClick={handleFund}
                className="flex items-center justify-center bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 px-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-green-500/25"
              >
                <span className="text-sm">Fund</span>
              </button>
              <button
                onClick={handleSendTokens}
                className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 px-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-blue-500/25"
              >
                <span className="text-sm">Send</span>
              </button>
              <button
                disabled
                className="flex items-center justify-center bg-gradient-to-r from-gray-600 to-gray-700 text-white/60 py-3 px-2 rounded-lg font-medium cursor-not-allowed relative shadow-lg"
              >
                <span className="text-sm">Withdraw</span>
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded-full font-bold shadow-lg text-[9px]">
                  Soon
                </span>
              </button>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                <div className="text-lg font-bold text-blue-400 mb-1">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    stats.loyaltyProgramCount.toLocaleString()
                  )}
                </div>
                <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Loyalty Programs</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                <div className="text-lg font-bold text-purple-400 mb-1">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    stats.totalMembers.toLocaleString()
                  )}
                </div>
                <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Total Members</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Discounts */}
        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/3 via-transparent to-blue-500/3 opacity-40"></div>
          
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">Revenue & Discounts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105 text-center">
                <div className="text-lg font-bold text-green-400 mb-1">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                  ) : (
                    `$${stats.totalRevenue}`
                  )}
                </div>
                <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Total Revenue</div>
              </div>
              <div className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105 text-center">
                <div className="text-lg font-bold text-blue-400 mb-1">
                  {statsLoading ? (
                    <Spinner size="sm" className="mx-auto" />
                    ) : (
                    `$${stats.totalDiscounts}`
                  )}
                </div>
                <div className="text-xs text-white/60 font-medium uppercase tracking-wider">Discounts Given</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/3 via-transparent to-purple-500/3 opacity-40"></div>
          
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">Quick Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleCreateVoucher}
                  className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 text-left transition-all duration-300 hover:scale-105 backdrop-blur-sm group"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">Loyalty Voucher</div>
                  <div className="text-xs text-white/60 font-medium">Manage loyalty voucher</div>
                </button>
                <button 
                  onClick={handleLoyaltyManagement}
                  className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 text-left transition-all duration-300 hover:scale-105 backdrop-blur-sm group"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 shadow-lg">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">Loyalty Program</div>
                  <div className="text-xs text-white/60 font-medium">Manage loyalty program</div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {stats.recentPayments.length > 0 && (
          <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/3 via-transparent to-pink-500/3 opacity-40"></div>
            
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg text-white font-semibold">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-0">
              <div className="space-y-3">
                {stats.recentPayments.map((payment, index) => (
                  <div key={index} className="p-3 bg-gradient-to-br from-white/8 to-white/3 rounded-lg border border-white/15 backdrop-blur-sm hover:border-white/25 transition-all duration-300 hover:scale-105">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white mb-1">
                          Payment: {payment.reference.slice(0, 8)}...
                        </div>
                        <div className="text-xs text-white/60 font-medium uppercase tracking-wider">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400 mb-1">
                          ${parseFloat(payment.amount).toLocaleString()}
                        </div>
                        {payment.loyaltyDiscount !== '0' && (
                          <div className="text-xs text-blue-400 font-medium">
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