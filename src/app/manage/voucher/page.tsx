'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getUserVoucherCollections, getUserVouchers } from '@/app/actions/voucher';
import { useRouter } from 'next/navigation';
import { Plus, Gift, ArrowLeft, Currency, ExternalLink, X } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface VoucherCollection {
  id: string;
  collectionPublicKey: string;
  signature: string;
  createdAt: string;
  collectionName?: string;
  collectionImage?: string;
  voucherStats?: {
    totalVouchersIssued: number;
    totalVouchersRedeemed: number;
    totalValueRedeemed: number;
  };
  vouchers: Array<{
    id: string;
    voucherName: string;
    voucherType: string;
    value: number;
    status: string;
    expiryDate: string;
    recipient: string;
    currentUses: number;
    maxUses: number;
  }>;
}

export default function ManageVouchersPage() {
  const { user } = usePrivy();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [collections, setCollections] = useState<VoucherCollection[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [pagination, setPagination] = useState<any>(null);

  // User vouchers states
  const [userVouchers, setUserVouchers] = useState<any[]>([]);
  const [userVouchersLoading, setUserVouchersLoading] = useState(false);
  const [showUserVouchers, setShowUserVouchers] = useState(false);
  const [userVouchersCurrentPage, setUserVouchersCurrentPage] = useState(1);
  const [userVouchersPageSize] = useState(5);
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<'active' | 'used' | 'expired' | 'all'>('active');
  
    // Withdraw modal states
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawVoucher, setWithdrawVoucher] = useState<any>(null);
    const [withdrawType, setWithdrawType] = useState<'verxio' | 'external'>('verxio');
    const [withdrawRecipient, setWithdrawRecipient] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [voucherTokenBalance, setVoucherTokenBalance] = useState<number | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    
    // Withdraw success states
    const [showWithdrawSuccess, setShowWithdrawSuccess] = useState(false);
    const [withdrawSignature, setWithdrawSignature] = useState<string>('');
    const [withdrawAmountSuccess, setWithdrawAmountSuccess] = useState<number>(0);
    const [withdrawSymbol, setWithdrawSymbol] = useState<string>('');

  // Collections dropdown state
  const [showCollections, setShowCollections] = useState(false);

  const load = async (page: number = currentPage, size: number = pageSize) => {
    if (!user?.wallet?.address) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await getUserVoucherCollections(user.wallet.address, page, size);
      if (res.success && res.collections) {
        setCollections(res.collections as VoucherCollection[]);
        setPagination({ ...res.pagination, totals: res.totals });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadUserVouchers();
  }, [user?.wallet?.address]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    load(page, pageSize);
  };

  const loadUserVouchers = async () => {
    if (!user?.wallet?.address) return;
    
    setUserVouchersLoading(true);
    try {
      const result = await getUserVouchers(user.wallet.address);
      
      if (result.success && result.vouchers) {
        // Get detailed voucher information including symbol for each voucher
        const { getVoucherDetails } = await import('@/lib/voucher/getVoucherDetails');
        
        const vouchersWithDetails = await Promise.all(
          result.vouchers.map(async (voucher: any) => {
            try {
              const voucherDetails = await getVoucherDetails(voucher.voucherAddress);
              if (voucherDetails.success && voucherDetails.data) {
                return {
                  ...voucher,
                  symbol: voucherDetails.data.attributes?.['Asset Symbol'],
                  tokenAddress: voucherDetails.data.attributes?.['Token Address']
                };
              }
              
              return {
                ...voucher,
                symbol: 'USDC' // fallback
              };
            } catch (error) {
              console.error('Error fetching voucher details:', error);
              return {
                ...voucher,
                symbol: 'USDC' // fallback
              };
            }
          })
        );
        
        setUserVouchers(vouchersWithDetails);
      }
    } catch (error) {
      console.error('Error loading user vouchers:', error);
    } finally {
      setUserVouchersLoading(false);
    }
  };

  const fetchVoucherBalance = async (voucher: any) => {
    if (!voucher.tokenAddress) {
      console.log('No token address found for voucher');
      setVoucherTokenBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    try {
      const { getVoucherTokenBalance } = await import('@/app/actions/withdraw');
      const result = await getVoucherTokenBalance(voucher.voucherAddress, voucher.tokenAddress);
      
      if (result.success) {
        setVoucherTokenBalance(result.balance!);
      } else {
        console.error('Failed to fetch token balance:', result.error);
        setVoucherTokenBalance(null);
      }
    } catch (error) {
      console.error('Error fetching voucher balance:', error);
      setVoucherTokenBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user?.wallet?.address || !withdrawVoucher || !withdrawRecipient.trim() || !withdrawAmount.trim()) {
      return;
    }

    const numAmount = parseFloat(withdrawAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    setIsWithdrawing(true);

    try {
      // Step 1: Validate withdrawal using backend action
      const { withdrawTokens } = await import('@/app/actions/withdraw');
      const result = await withdrawTokens({
        voucherAddress: withdrawVoucher.voucherAddress,
        withdrawType: withdrawType,
        recipient: withdrawRecipient.trim(),
        amount: numAmount,
        senderWalletAddress: user.wallet.address
      });

      if (result.success && result.recipientWalletAddress) {
        try {
          // Step 2: Execute the withdraw transaction (backend handles signing with voucher key)
          const { buildWithdrawTransaction } = await import('@/app/actions/withdraw');
          const buildResult = await buildWithdrawTransaction({
            voucherAddress: withdrawVoucher.voucherAddress,
            recipientWallet: result.recipientWalletAddress,
            amount: numAmount,
            voucherId: result.voucherId!,
            creatorAddress: user.wallet.address
          });

          if (!buildResult.success || !buildResult.transaction) {
            throw new Error(buildResult.error || 'Failed to execute withdraw transaction');
          }

          // Update withdraw status with the transaction signature
          const { updateWithdrawStatus } = await import('@/app/actions/withdraw');
          const updateResult = await updateWithdrawStatus(result.withdrawId!, buildResult.transaction);

          // Step 3: Show success popup
          setShowWithdrawModal(false);
          setWithdrawSignature(buildResult.transaction);
          setWithdrawAmountSuccess(numAmount);
          setWithdrawSymbol(withdrawVoucher.symbol || 'USDC');
          setShowWithdrawSuccess(true);
          
          // Clear withdraw modal states
          setWithdrawVoucher(null);
          setWithdrawRecipient('');
          setWithdrawAmount('');
          setWithdrawType('verxio');
          setVoucherTokenBalance(null);
          setIsLoadingBalance(false);
          
          // Refresh vouchers to show updated status
          await loadUserVouchers();

        } catch (txError) {
          console.error('Withdraw transaction failed:', txError);
          
          // Update withdraw status to FAILED if we have a withdrawId
          if (result.withdrawId) {
            try {
              const { updateWithdrawStatusFailed } = await import('@/app/actions/withdraw');
              await updateWithdrawStatusFailed(result.withdrawId, txError instanceof Error ? txError.message : 'Transaction failed');
              console.log('Updated withdraw status to FAILED for ID:', result.withdrawId);
            } catch (updateError) {
              console.error('Failed to update withdraw status to failed:', updateError);
            }
          }
          // Keep modal open to show error
        }
      } else {
        console.error('Withdraw validation failed:', result.error);
      }
    } catch (error) {
      console.error('Error withdrawing tokens:', error);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // User vouchers pagination calculations
  // Sort user vouchers by most recent first (createdAt descending)
  const sortedUserVouchers = userVouchers.sort((a, b) => 
    new Date(b.createdAt || b.voucherData?.createdAt || 0).getTime() - new Date(a.createdAt || a.voucherData?.createdAt || 0).getTime()
  );
  
  // Filter vouchers by status
  const filteredUserVouchers = sortedUserVouchers.filter(voucher => {
    if (voucherStatusFilter === 'all') return true;
    if (voucherStatusFilter === 'expired') return voucher.isExpired;
    if (voucherStatusFilter === 'used') return voucher.voucherData?.status === 'used';
    if (voucherStatusFilter === 'active') return voucher.voucherData?.status === 'active' && !voucher.isExpired;
    return true;
  });
  
  const totalUserVouchers = filteredUserVouchers.length;
  const totalUserVouchersPages = Math.ceil(totalUserVouchers / userVouchersPageSize) || 1;
  const userVouchersStartIndex = (userVouchersCurrentPage - 1) * userVouchersPageSize;
  const userVouchersEndIndex = userVouchersStartIndex + userVouchersPageSize;
  const currentUserVouchers = filteredUserVouchers.slice(userVouchersStartIndex, userVouchersEndIndex);

  // Collections pagination calculations
  const totalCollections = collections.length;
  const totalCollectionsPages = Math.ceil(totalCollections / pageSize) || 1;
  const collectionsStartIndex = (currentPage - 1) * pageSize;
  const collectionsEndIndex = collectionsStartIndex + pageSize;
  const currentCollections = collections.slice(collectionsStartIndex, collectionsEndIndex);


  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <AppButton
            onClick={() => router.push('/dashboard')}
            variant="secondary"
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </AppButton>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-white">Voucher Management</h1>
            <p className="text-white/60 text-sm">Create and manage voucher collections</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/create/voucher')}
            className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 text-left transition-all duration-300 hover:scale-105 backdrop-blur-sm group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Create Collection</div>
            <div className="text-xs text-white/60 font-medium">Start creating vouchers</div>
          </button>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Currency className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Voucher Worth</div>
            <div className="text-xl font-bold text-emerald-300">
              ${(pagination?.totals?.totalWorth ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-green-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Unclaimed Value</div>
            <div className="text-xl font-bold text-green-400">
              ${userVouchers
                .filter(v => v.voucherData?.status === 'active' && !v.isExpired)
                .reduce((sum, voucher) => sum + (voucher.voucherData?.value || 0), 0)
                .toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Active Vouchers</div>
            <div className="text-xl font-bold text-orange-400">
              {userVouchers.filter(v => v.voucherData?.status === 'active' && !v.isExpired).length}
            </div>
          </div>
        </div>

        {/* User Vouchers Section */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowUserVouchers(!showUserVouchers)}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                My Vouchers ({totalUserVouchers})
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={voucherStatusFilter}
                  onChange={(e) => {
                    setVoucherStatusFilter(e.target.value as 'active' | 'used' | 'expired' | 'all');
                    setUserVouchersCurrentPage(1); // Reset to first page when filter changes
                  }}
                  className="bg-black/20 border border-white/20 text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-blue-500"
                  onClick={(e) => e.stopPropagation()} // Prevent card toggle when clicking select
                >
                  <option value="active">Active</option>
                  <option value="used">Used</option>
                  <option value="expired">Expired</option>
                  <option value="all">All</option>
                </select>
                <span className="text-sm text-gray-400">
                  {showUserVouchers ? '▼' : '▶'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          {showUserVouchers && (
            <CardContent>
              {userVouchersLoading && userVouchers.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center space-x-2">
                    <VerxioLoaderWhite size="sm" />
                    <span className="text-gray-400 text-sm">Loading vouchers...</span>
                  </div>
                </div>
              ) : filteredUserVouchers.length > 0 ? (
                <div className="space-y-3">
                  {currentUserVouchers.map((voucher, index) => (
                    <div key={voucher.voucherAddress || index} className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-4 border border-white/20 hover:border-white/30 transition-all duration-300">
                      {/* Voucher Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-white truncate">
                          {voucher.name || `Voucher ${index + 1}`}
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          voucher.isExpired ? 'bg-red-500/20 text-red-400' :
                          voucher.voucherData?.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          voucher.voucherData?.status === 'used' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {voucher.isExpired ? 'EXPIRED' : voucher.voucherData?.status?.toUpperCase()}
                        </div>
                      </div>

                      {/* Voucher Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-white/60 mb-3">
                        <div>Type: {voucher.voucherData?.type?.replace('_', ' ')}</div>
                        <div>Value: {voucher.voucherData?.value} {voucher.symbol }</div>
                        {!voucher.isExpired && (
                          <>
                            <div>Uses: {voucher.voucherData?.currentUses}/{voucher.voucherData?.maxUses}</div>
                            <div>Remaining: {voucher.remainingUses}</div>
                          </>
                        )}
                      </div>


                      {/* Withdraw Button for TOKEN vouchers */}
                      {voucher.voucherData?.type?.toLowerCase() === 'token' && 
                       voucher.voucherData?.status === 'active' && 
                       !voucher.isExpired && (
                        <div className="mb-3">
                          <button
                            onClick={() => {
                              setWithdrawVoucher(voucher);
                              setWithdrawAmount(voucher.voucherData?.value?.toString() || '');
                              setWithdrawRecipient('');
                              setWithdrawType('verxio');
                              setVoucherTokenBalance(null);
                              setShowWithdrawModal(true);
                              // Fetch actual token balance
                              fetchVoucherBalance(voucher);
                            }}
                            disabled={!voucher.tokenAddress}
                            className={`w-full px-3 py-2 border border-orange-600/30 text-xs font-medium transition-colors ${
                              !voucher.tokenAddress 
                                ? 'bg-gray-600/20 text-gray-400 cursor-not-allowed' 
                                : 'bg-orange-600/20 hover:bg-orange-600/30 text-orange-400'
                            }`}
                          >
                            {!voucher.tokenAddress ? 'Token Address Not Found' : 'Withdraw Tokens'}
                          </button>
                        </div>
                      )}

                      {/* Expiry Info and Explorer Link */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs text-white/50">
                          {!voucher.isExpired && voucher.timeUntilExpiry ? (() => {
                            const days = Math.floor(voucher.timeUntilExpiry / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((voucher.timeUntilExpiry % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((voucher.timeUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (days > 0) {
                              return `Expires in ${days} day${days > 1 ? 's' : ''}`;
                            } else if (hours > 0) {
                              return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
                            } else if (minutes > 0) {
                              return `Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
                            } else {
                              return 'Expires soon';
                            }
                          })() : ''}
                        </div>
                        <button
                          onClick={() => window.open(`https://solscan.io/token/${voucher.voucherAddress}`, '_blank')}
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View on Solscan
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* User Vouchers Pagination */}
                  {totalUserVouchersPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setUserVouchersCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={userVouchersCurrentPage === 1}
                        className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      >
                        Previous
                      </button>
                      <div className="text-xs text-white/60">
                        Showing {userVouchersStartIndex + 1}-{Math.min(userVouchersEndIndex, totalUserVouchers)} of {totalUserVouchers} vouchers
                      </div>
                      <button
                        onClick={() => setUserVouchersCurrentPage((p) => Math.min(totalUserVouchersPages, p + 1))}
                        disabled={userVouchersCurrentPage === totalUserVouchersPages}
                        className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <span className="text-gray-400 text-sm">
                    {userVouchers.length === 0 
                      ? 'No vouchers found' 
                      : `No ${voucherStatusFilter} vouchers found`
                    }
                  </span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowCollections(!showCollections)}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                My Voucher Collections ({collections.length})
              </div>
              <span className="text-sm text-gray-400">
                {showCollections ? '▼' : '▶'}
              </span>
            </CardTitle>
          </CardHeader>
          {showCollections && (
            <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-8 text-white/60">No voucher collections yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentCollections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => router.push(`/manage/voucher/${collection.collectionPublicKey}`)}
                      className="w-full p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 transition-all duration-300 hover:scale-105 backdrop-blur-sm text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-white">
                          {collection.collectionName || `Collection ${collection.id.slice(-8)}`}
                        </div>
                        <div className="text-xs text-blue-400 font-medium">
                          {collection.vouchers.length} vouchers
                        </div>
                      </div>
                      <div className="text-xs text-white/60">
                        {new Date(collection.createdAt).toLocaleDateString()} • 
                        {collection.vouchers.filter(v => v.status === 'ACTIVE').length} active
                      </div>
                      <div className="text-[10px] text-white/40 mt-1">
                        {collection.collectionPublicKey.slice(0, 6)}...{collection.collectionPublicKey.slice(-6)}
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Collections Pagination */}
                {totalCollectionsPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Previous
                    </button>
                    <div className="text-xs text-white/60">
                      Showing {collectionsStartIndex + 1}-{Math.min(collectionsEndIndex, totalCollections)} of {totalCollections} collections
                    </div>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalCollectionsPages, p + 1))}
                      disabled={currentPage === totalCollectionsPages}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && withdrawVoucher && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Withdraw Tokens</h3>
            </div>

            <div className="space-y-4">
              {/* Voucher Info */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 text-sm font-medium mb-1">Withdrawing from:</div>
                <div className="text-white text-sm">
                  {withdrawVoucher.name || `Voucher`} - {withdrawVoucher.voucherData?.value} {withdrawVoucher.symbol || 'USDC'}
                </div>
              </div>

              {/* Withdraw Type Toggle */}
              <div className="space-y-3">
                <Label className="text-white text-sm font-medium">Withdraw To</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={withdrawType === 'verxio'}
                      onCheckedChange={(checked) => {
                        setWithdrawType(checked ? 'verxio' : 'external');
                        setWithdrawRecipient('');
                      }}
                    />
                    <Label className="text-white text-sm">Verxio User</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={withdrawType === 'external'}
                      onCheckedChange={(checked) => {
                        setWithdrawType(checked ? 'external' : 'verxio');
                        setWithdrawRecipient('');
                      }}
                    />
                    <Label className="text-white text-sm">External Wallet</Label>
                  </div>
                </div>
              </div>

              {/* Recipient Field */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-recipient" className="text-white text-sm font-medium">
                  {withdrawType === 'verxio' ? 'Recipient Email' : 'Recipient Wallet Address'}
                </Label>
                <Input
                  id="withdraw-recipient"
                  type={withdrawType === 'verxio' ? 'email' : 'text'}
                  value={withdrawRecipient}
                  onChange={(e) => setWithdrawRecipient(e.target.value)}
                  placeholder={withdrawType === 'verxio' ? 'Enter verxio user email address' : 'Enter Solana wallet address'}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
              </div>

              {/* Amount Field */}
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount" className="text-white text-sm font-medium">
                  Amount to Withdraw ({withdrawVoucher.symbol})
                </Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={voucherTokenBalance !== null ? voucherTokenBalance : (withdrawVoucher.voucherData?.value || 0)}
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                />
                <div className="text-xs text-white/60">
                  {isLoadingBalance ? (
                    <span>Loading balance...</span>
                  ) : voucherTokenBalance !== null && (
                    <span>Available: {voucherTokenBalance.toFixed(2)} {withdrawVoucher.symbol || 'USDC'}</span>
                  )}
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <div className="text-orange-400 text-sm font-medium mb-1">Warning</div>
                <div className="text-orange-300 text-xs">
                  This will withdraw tokens from the voucher and transfer them to the specified recipient. 
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <AppButton
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawVoucher(null);
                    setWithdrawRecipient('');
                    setWithdrawAmount('');
                    setWithdrawType('verxio');
                    setVoucherTokenBalance(null);
                    setIsLoadingBalance(false);
                  }}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancel
                </AppButton>
                <AppButton
                  onClick={handleWithdraw}
                  disabled={
                    !withdrawRecipient.trim() || 
                    !withdrawAmount.trim() || 
                    parseFloat(withdrawAmount) <= 0 ||
                    parseFloat(withdrawAmount) > (voucherTokenBalance !== null ? voucherTokenBalance : (withdrawVoucher.voucherData?.value || 0)) ||
                    isWithdrawing ||
                    (voucherTokenBalance !== null && voucherTokenBalance <= 0) ||
                    isLoadingBalance
                  }
                  className="flex-1"
                >
                  {isWithdrawing ? (
                    <div className="flex items-center gap-2">
                      <VerxioLoaderWhite size="sm" />
                      Withdrawing...
                    </div>
                  ) : isLoadingBalance ? (
                    <div className="flex items-center gap-2">
                      <VerxioLoaderWhite size="sm" />
                      Loading Balance...
                    </div>
                  ) : (voucherTokenBalance !== null && voucherTokenBalance <= 0) ? (
                    'Insufficient Balance'
                  ) : (
                    'Confirm Withdraw'
                  )}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Success Modal */}
      {showWithdrawSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Withdrawal Successful!</h3>
              <p className="text-white/80">
                Your tokens have been withdrawn successfully!
              </p>

              <div className="p-4 bg-black/20 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Amount:</span>
                  <span className="text-white font-medium">{withdrawAmountSuccess.toFixed(2)} {withdrawSymbol}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white">Transaction:</span>
                  <span className="text-white font-mono text-sm truncate max-w-32">
                    {withdrawSignature.slice(0, 8)}...{withdrawSignature.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <a
                    href={`https://solscan.io/tx/${withdrawSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[#00adef] text-sm hover:text-[#00adef]/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Solscan
                  </a>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowWithdrawSuccess(false);
                  setWithdrawSignature('');
                  setWithdrawAmountSuccess(0);
                  setWithdrawSymbol('');
                }}
                className="w-full px-4 py-2 bg-white hover:bg-gray-100 text-black rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
