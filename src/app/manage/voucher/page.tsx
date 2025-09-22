'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getUserVoucherCollections, getUserVouchers } from '@/app/actions/voucher';
import { useRouter } from 'next/navigation';
import { Plus, Gift, ArrowLeft, Currency, ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';

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
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<any>(null);

  // User vouchers states
  const [userVouchers, setUserVouchers] = useState<any[]>([]);
  const [userVouchersLoading, setUserVouchersLoading] = useState(false);
  const [showUserVouchers, setShowUserVouchers] = useState(false);
  const [userVouchersCurrentPage, setUserVouchersCurrentPage] = useState(1);
  const [userVouchersPageSize] = useState(5);

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
        setUserVouchers(result.vouchers);
        console.log('User vouchers data:', result.vouchers);
      }
    } catch (error) {
      console.error('Error loading user vouchers:', error);
    } finally {
      setUserVouchersLoading(false);
    }
  };

  // User vouchers pagination calculations
  const totalUserVouchers = userVouchers.length;
  const totalUserVouchersPages = Math.ceil(totalUserVouchers / userVouchersPageSize) || 1;
  const userVouchersStartIndex = (userVouchersCurrentPage - 1) * userVouchersPageSize;
  const userVouchersEndIndex = userVouchersStartIndex + userVouchersPageSize;
  const currentUserVouchers = userVouchers.slice(userVouchersStartIndex, userVouchersEndIndex);


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
            onClick={() => {
              if (!showUserVouchers && userVouchers.length === 0) {
                loadUserVouchers();
              }
              setShowUserVouchers(!showUserVouchers);
            }}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                My Vouchers ({userVouchers.length})
              </div>
              <span className="text-sm text-gray-400">
                {showUserVouchers ? '▼' : '▶'}
              </span>
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
              ) : userVouchers.length > 0 ? (
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
                        <div>Value: ${voucher.voucherData?.value}</div>
                        <div>Uses: {voucher.voucherData?.currentUses}/{voucher.voucherData?.maxUses}</div>
                        <div>Remaining: {voucher.remainingUses}</div>
                      </div>

                      {/* Expiry Info and Explorer Link */}
                      <div className="flex items-center justify-between mb-3">
                        {voucher.timeUntilExpiry && (
                          <div className="text-xs text-white/50">
                            {voucher.isExpired ? 'Expired' : (() => {
                              const days = Math.floor(voucher.timeUntilExpiry / (1000 * 60 * 60 * 24));
                              const hours = Math.floor(voucher.timeUntilExpiry / (1000 * 60 * 60));
                              const minutes = Math.floor(voucher.timeUntilExpiry / (1000 * 60));
                              
                              if (days > 0) {
                                return `Expires in ${days} day${days > 1 ? 's' : ''}`;
                              } else if (hours > 0) {
                                return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
                              } else if (minutes > 0) {
                                return `Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
                              } else {
                                return 'Expires soon';
                              }
                            })()}
                          </div>
                        )}
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
                  <span className="text-gray-400 text-sm">No vouchers found</span>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">My Voucher Collections ({collections.length})</CardTitle>
              {pagination && (
                <div className="text-xs text-white/60">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} collections
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-8 text-white/60">No voucher collections yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {collections.map((collection) => (
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
                
                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-xs rounded-lg ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-white/20 hover:bg-white/10 text-white'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {pagination.totalPages > 5 && (
                        <>
                          <span className="text-white/60">...</span>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages)}
                            className={`px-3 py-2 text-xs rounded-lg ${
                              currentPage === pagination.totalPages
                                ? 'bg-blue-600 text-white'
                                : 'border border-white/20 hover:bg-white/10 text-white'
                            }`}
                          >
                            {pagination.totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
