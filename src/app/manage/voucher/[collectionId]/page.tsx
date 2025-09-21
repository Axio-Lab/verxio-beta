'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getVoucherCollectionByPublicKey, mintVoucher, validateVoucher, redeemVoucher, cancelVoucher, extendVoucherExpiry } from '@/app/actions/voucher';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Check, X, Clock, Gift, Users, DollarSign, Copy, ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { VerxioLoaderWhite as VerxioLoaderWhiteSmall } from '@/components/ui/verxio-loader-white';

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
  blockchainDetails?: any;
  vouchers: Array<{
    id: string;
    voucherPublicKey: string;
    recipient: string;
    voucherName: string;
    voucherType: string;
    value: number;
    description: string;
    expiryDate: string;
    maxUses: number;
    currentUses: number;
    transferable: boolean;
    status: string;
    merchantId: string;
    signature: string;
    createdAt: string;
  }>;
}

interface Voucher {
  id: string;
  voucherPublicKey: string;
  recipient: string;
  voucherName: string;
  voucherType: string;
  value: number;
  description: string;
  expiryDate: string;
  maxUses: number;
  currentUses: number;
  transferable: boolean;
  status: string;
  merchantId: string;
  signature: string;
  createdAt: string;
}

export default function VoucherCollectionDetailPage() {
  const { user } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const collectionPublicKey = params.collectionId as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [collection, setCollection] = useState<VoucherCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Mint voucher states
  const [showMintForm, setShowMintForm] = useState(false);
  const [mintData, setMintData] = useState({
    recipient: '',
    voucherName: '',
    voucherType: 'PERCENTAGE_OFF' as const,
    value: '',
    description: '',
    expiryDate: '',
    maxUses: '',
    transferable: true,
    merchantId: ''
  });
  const [isMinting, setIsMinting] = useState(false);
  
  // Operation states
  const [operatingVoucherId, setOperatingVoucherId] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  
  // Copy state
  const [copied, setCopied] = useState(false);
  
  // Vouchers pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Manually control items per page

  // Calculate pagination for vouchers
  const totalVouchers = collection?.vouchers.length || 0;
  const totalPages = Math.ceil(totalVouchers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentVouchers = collection?.vouchers.slice(startIndex, endIndex) || [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.wallet?.address || !collectionPublicKey) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        } else {
          setError(res.error || 'Failed to load voucher collection');
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.wallet?.address, collectionPublicKey]);

  const handleMintVoucher = async () => {
    if (!user?.wallet?.address || !collection) return;
    
    setIsMinting(true);
    try {
      const result = await mintVoucher({
        collectionId: collection.id,
        recipient: mintData.recipient,
        voucherName: mintData.voucherName,
        voucherType: mintData.voucherType,
        value: parseFloat(mintData.value),
        description: mintData.description,
        expiryDate: new Date(mintData.expiryDate),
        maxUses: parseInt(mintData.maxUses),
        transferable: mintData.transferable,
        merchantId: mintData.merchantId
      }, user.wallet.address);

      if (result.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        setShowMintForm(false);
        setMintData({
          recipient: '',
          voucherName: '',
          voucherType: 'PERCENTAGE_OFF',
          value: '',
          description: '',
          expiryDate: '',
          maxUses: '',
          transferable: true,
          merchantId: ''
        });
      } else {
        setError(result.error || 'Failed to mint voucher');
      }
    } catch (error) {
      setError('Failed to mint voucher');
    } finally {
      setIsMinting(false);
    }
  };

  const handleValidateVoucher = async (voucherId: string) => {
    if (!user?.wallet?.address) return;
    
    setOperatingVoucherId(voucherId);
    setOperationType('validate');
    try {
      const result = await validateVoucher(voucherId, user.wallet.address);
      if (result.success && 'result' in result) {
        console.log('Voucher validation result:', result.result);
      } else {
        setError(result.error || 'Failed to validate voucher');
      }
    } catch (error) {
      setError('Failed to validate voucher');
    } finally {
      setOperatingVoucherId(null);
      setOperationType(null);
    }
  };

  const handleRedeemVoucher = async (voucherId: string) => {
    if (!user?.wallet?.address || !redeemAmount) return;
    
    setOperatingVoucherId(voucherId);
    setOperationType('redeem');
    try {
      const result = await redeemVoucher(voucherId, 'merchant_' + Date.now(), user.wallet.address, parseFloat(redeemAmount));
      if (result.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        setRedeemAmount('');
      } else {
        setError(result.error || 'Failed to redeem voucher');
      }
    } catch (error) {
      setError('Failed to redeem voucher');
    } finally {
      setOperatingVoucherId(null);
      setOperationType(null);
    }
  };

  const handleCancelVoucher = async (voucherId: string) => {
    if (!user?.wallet?.address || !cancelReason) return;
    
    setOperatingVoucherId(voucherId);
    setOperationType('cancel');
    try {
      const result = await cancelVoucher(voucherId, cancelReason, user.wallet.address);
      if (result.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        setCancelReason('');
      } else {
        setError(result.error || 'Failed to cancel voucher');
      }
    } catch (error) {
      setError('Failed to cancel voucher');
    } finally {
      setOperatingVoucherId(null);
      setOperationType(null);
    }
  };

  const handleExtendExpiry = async (voucherId: string) => {
    if (!user?.wallet?.address || !newExpiryDate) return;
    
    setOperatingVoucherId(voucherId);
    setOperationType('extend');
    try {
      const result = await extendVoucherExpiry(voucherId, new Date(newExpiryDate), user.wallet.address);
      if (result.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        setNewExpiryDate('');
      } else {
        setError(result.error || 'Failed to extend voucher expiry');
      }
    } catch (error) {
      setError('Failed to extend voucher expiry');
    } finally {
      setOperatingVoucherId(null);
      setOperationType(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'text-green-400';
      case 'USED': return 'text-blue-400';
      case 'EXPIRED': return 'text-red-400';
      case 'CANCELLED': return 'text-gray-400';
      default: return 'text-white/60';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <Check className="w-4 h-4" />;
      case 'USED': return <Check className="w-4 h-4" />;
      case 'EXPIRED': return <X className="w-4 h-4" />;
      case 'CANCELLED': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <VerxioLoaderWhite size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !collection) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center py-12">
            <div className="text-red-400 text-lg font-medium mb-2">Error</div>
            <div className="text-white/60">{error || 'Voucher collection not found'}</div>
            <AppButton
              onClick={() => router.push('/manage/voucher')}
              variant="secondary"
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Collections
            </AppButton>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <AppButton
            onClick={() => router.push('/manage/voucher')}
            variant="secondary"
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </AppButton>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-white">{collection.collectionName || 'Voucher Collection'}</h1>
            <p className="text-white/60 text-sm">Manage your phygital coupons and vouchers</p>
          </div>
        </div>

        {/* Collection Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Vouchers</div>
            <div className="text-xl font-bold text-green-400">{collection.vouchers.length}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Active Vouchers</div>
            <div className="text-xl font-bold text-blue-400">
              {collection.vouchers.filter(v => v.status === 'ACTIVE').length}
            </div>
          </div>
        </div>

        {/* Collection Info */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Collection Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {collection.collectionImage && (
              <div className="w-full h-48 overflow-hidden rounded-lg">
                <img
                  src={collection.collectionImage}
                  alt={collection.collectionName || 'Voucher Collection'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-zinc-400 text-sm mb-1">Voucher Name</p>
                <p className="text-white font-medium">{collection.collectionName || 'Unknown Collection'}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-sm mb-1">Status</p>
                <span className="px-2 py-1 rounded-full text-xs font-medium border border-green-500/50 text-green-400 bg-green-500/10">
                  Active
                </span>
              </div>
              <div>
                <p className="text-zinc-400 text-sm mb-1">Total Vouchers Issued</p>
                <p className="text-white font-medium">{collection.voucherStats?.totalVouchersIssued || 0}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-sm mb-1">Total Redeemed</p>
                <p className="text-white font-medium">{collection.voucherStats?.totalVouchersRedeemed || 0}</p>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-2">Voucher Address</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs truncate text-white/80 border border-white/10 rounded-md px-3 py-2 bg-white/5">
                  {collection.collectionPublicKey}
                </div>
                <AppButton
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(collection.collectionPublicKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  {copied ? 'Copied!' : <Copy className="w-3 h-3" />}
                </AppButton>
                <AppButton
                  onClick={() => window.open(`https://solscan.io/token/${collection.collectionPublicKey}?cluster=devnet`, '_blank')}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </AppButton>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-1">Created</p>
              <p className="text-white font-medium">{new Date(collection.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Mint New Voucher */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Mint New Voucher
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showMintForm ? (
              <AppButton
                onClick={() => setShowMintForm(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Mint New Voucher
              </AppButton>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Recipient Address</Label>
                    <Input
                      value={mintData.recipient}
                      onChange={(e) => setMintData({ ...mintData, recipient: e.target.value })}
                      placeholder="Wallet address"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-1 block">Voucher Name</Label>
                    <Input
                      value={mintData.voucherName}
                      onChange={(e) => setMintData({ ...mintData, voucherName: e.target.value })}
                      placeholder="e.g., 10% Off"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Voucher Type</Label>
                    <CustomSelect
                      value={mintData.voucherType}
                      onChange={(value: string) => setMintData({ ...mintData, voucherType: value as any })}
                      options={[
                        { value: 'PERCENTAGE_OFF', label: 'Percentage Off' },
                        { value: 'FIXED_VERXIO_CREDITS', label: 'Fixed Verxio Credits' },
                        { value: 'FREE_ITEM', label: 'Free Item' },
                        { value: 'BUY_ONE_GET_ONE', label: 'Buy One Get One' },
                        { value: 'CUSTOM_REWARD', label: 'Custom Reward' }
                      ]}
                      className="bg-black/20 border-white/20 text-white text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-1 block">Value</Label>
                    <Input
                      type="number"
                      value={mintData.value}
                      onChange={(e) => setMintData({ ...mintData, value: e.target.value })}
                      placeholder="10"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Max Uses</Label>
                    <Input
                      type="number"
                      value={mintData.maxUses}
                      onChange={(e) => setMintData({ ...mintData, maxUses: e.target.value })}
                      placeholder="1"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-1 block">Expiry Date</Label>
                    <Input
                      type="datetime-local"
                      value={mintData.expiryDate}
                      onChange={(e) => setMintData({ ...mintData, expiryDate: e.target.value })}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white text-sm mb-1 block">Description</Label>
                  <Input
                    value={mintData.description}
                    onChange={(e) => setMintData({ ...mintData, description: e.target.value })}
                    placeholder="Voucher description"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm mb-1 block">Merchant ID</Label>
                  <Input
                    value={mintData.merchantId}
                    onChange={(e) => setMintData({ ...mintData, merchantId: e.target.value })}
                    placeholder="merchant_123"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <AppButton
                    onClick={() => setShowMintForm(false)}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    onClick={handleMintVoucher}
                    disabled={isMinting || !mintData.recipient || !mintData.voucherName || !mintData.value || !mintData.expiryDate || !mintData.merchantId}
                    className="flex-1"
                  >
                    {isMinting ? (
                      <VerxioLoaderWhiteSmall size="sm" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Mint Voucher
                      </>
                    )}
                  </AppButton>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vouchers List */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Vouchers ({collection.vouchers.length})
              </CardTitle>
              {totalVouchers > pageSize && (
                <div className="text-xs text-white/60">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalVouchers)} of {totalVouchers} vouchers
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {collection.vouchers.length === 0 ? (
              <div className="text-center py-8 text-white/60">No vouchers minted yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentVouchers.map((voucher) => (
                  <div key={voucher.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`${getStatusColor(voucher.status)}`}>
                          {getStatusIcon(voucher.status)}
                        </div>
                        <span className="text-white font-medium">{voucher.voucherName}</span>
                      </div>
                      <div className={`text-xs font-medium ${getStatusColor(voucher.status)}`}>
                        {voucher.status}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-white/60 mb-3">
                      <div>Type: {voucher.voucherType.replace('_', ' ')}</div>
                      <div>Value: {voucher.value}</div>
                      <div>Uses: {voucher.currentUses}/{voucher.maxUses}</div>
                      <div>Expires: {new Date(voucher.expiryDate).toLocaleDateString()}</div>
                    </div>
                    
                    <div className="text-xs text-white/40 mb-3">
                      Recipient: {voucher.recipient.slice(0, 6)}...{voucher.recipient.slice(-6)}
                    </div>
                    
                    {voucher.description && (
                      <div className="text-xs text-white/60 mb-3">
                        {voucher.description}
                      </div>
                    )}
                    
                    {/* Voucher Operations */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleValidateVoucher(voucher.id)}
                        disabled={operatingVoucherId === voucher.id && operationType === 'validate'}
                        className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded text-blue-400 text-xs disabled:opacity-50"
                      >
                        {operatingVoucherId === voucher.id && operationType === 'validate' ? (
                          <VerxioLoaderWhiteSmall size="sm" />
                        ) : (
                          'Validate'
                        )}
                      </button>
                      
                      {voucher.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => {
                              const amount = prompt('Enter redemption amount:');
                              if (amount) {
                                setRedeemAmount(amount);
                                handleRedeemVoucher(voucher.id);
                              }
                            }}
                            disabled={operatingVoucherId === voucher.id && operationType === 'redeem'}
                            className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded text-green-400 text-xs disabled:opacity-50"
                          >
                            {operatingVoucherId === voucher.id && operationType === 'redeem' ? (
                              <VerxioLoaderWhiteSmall size="sm" />
                            ) : (
                              'Redeem'
                            )}
                          </button>
                          
                          <button
                            onClick={() => {
                              const reason = prompt('Enter cancellation reason:');
                              if (reason) {
                                setCancelReason(reason);
                                handleCancelVoucher(voucher.id);
                              }
                            }}
                            disabled={operatingVoucherId === voucher.id && operationType === 'cancel'}
                            className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded text-red-400 text-xs disabled:opacity-50"
                          >
                            {operatingVoucherId === voucher.id && operationType === 'cancel' ? (
                              <VerxioLoaderWhiteSmall size="sm" />
                            ) : (
                              'Cancel'
                            )}
                          </button>
                          
                          <button
                            onClick={() => {
                              const newDate = prompt('Enter new expiry date (YYYY-MM-DD):');
                              if (newDate) {
                                setNewExpiryDate(newDate);
                                handleExtendExpiry(voucher.id);
                              }
                            }}
                            disabled={operatingVoucherId === voucher.id && operationType === 'extend'}
                            className="px-3 py-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 rounded text-orange-400 text-xs disabled:opacity-50"
                          >
                            {operatingVoucherId === voucher.id && operationType === 'extend' ? (
                              <VerxioLoaderWhiteSmall size="sm" />
                            ) : (
                              'Extend'
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  ))}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                      {totalPages > 5 && (
                        <>
                          <span className="text-white/60">...</span>
                          <button
                            onClick={() => handlePageChange(totalPages)}
                            className={`px-3 py-2 text-xs rounded-lg ${
                              currentPage === totalPages
                                ? 'bg-blue-600 text-white'
                                : 'border border-white/20 hover:bg-white/10 text-white'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
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

        {/* Error Display */}
        {error && (
          <Card className="bg-red-500/10 border-red-500/20 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-400">
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
