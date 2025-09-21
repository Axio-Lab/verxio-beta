'use client';

import { useEffect, useState } from 'react';

// Extend Window interface for timeout
declare global {
  interface Window {
    emailCheckTimeout?: NodeJS.Timeout;
  }
}
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getVoucherCollectionByPublicKey, mintVoucher, validateVoucher, redeemVoucher, cancelVoucher, extendVoucherExpiry } from '@/app/actions/voucher';
import { getUserByEmail } from '@/app/actions/user';
import { generateImageUri } from '@/lib/metadata/generateImageURI';
import { storeMetadata } from '@/app/actions/metadata';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Check, X, Clock, Gift, Users, Copy, ExternalLink, Upload } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { VerxioLoaderWhite as VerxioLoaderWhiteSmall } from '@/components/ui/verxio-loader-white';

// Format condition string to proper display format
const formatConditionString = (condition: string): string => {
  if (!condition) return '';
  
  const conditionMap: { [key: string]: string } = {
    'minimum_purchase_10': 'Minimum purchase $10',
    'minimum_purchase_25': 'Minimum purchase $25',
    'minimum_purchase_50': 'Minimum purchase $50',
    'weekdays_only': 'Valid weekdays only',
    'weekends_only': 'Valid weekends only',
    'first_time_customer': 'First-time customers only',
    'new_customer': 'New customers only',
    'loyalty_member': 'Loyalty members only'
  };
  
  // Return mapped value or fallback to formatted string
  return conditionMap[condition] || condition.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

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
    signature: string;
    createdAt: string;
  }>;
}

interface Voucher {
  id: string;
  voucherPublicKey: string;
  recipient: string;
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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [mintData, setMintData] = useState({
    recipient: '',
    voucherType: 'PERCENTAGE_OFF' as const,
    value: '',
    expiryDate: '',
    maxUses: '1',
    transferable: true,
    conditions: ''
  });
  const [recipientWalletAddress, setRecipientWalletAddress] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Operation states
  const [operatingVoucherId, setOperatingVoucherId] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Copy state
  const [copied, setCopied] = useState(false);
  
  // Separate minting error from critical errors
  const [mintingError, setMintingError] = useState<string | null>(null);

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

  const handleRecipientEmailChange = (email: string) => {
    setMintData({ ...mintData, recipient: email });

    // Clear previous wallet address immediately
    setRecipientWalletAddress(null);

    // Clear any existing timeout
    if (window.emailCheckTimeout) {
      clearTimeout(window.emailCheckTimeout);
    }



    // Set new timeout for email check (500ms delay)
    window.emailCheckTimeout = setTimeout(async () => {
      if (email.trim()) {
        setIsCheckingEmail(true);
        try {
          const userResult = await getUserByEmail(email.trim());
          if (userResult.success && userResult.user) {
            setRecipientWalletAddress(userResult.user.walletAddress);
          } else {
            setRecipientWalletAddress(null);
          }
        } catch (error) {
          console.error('Error looking up user:', error);
          setRecipientWalletAddress(null);
        } finally {
          setIsCheckingEmail(false);
        }
      } else {
        setRecipientWalletAddress(null);
        setIsCheckingEmail(false);
      }
    }, 500);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (window.emailCheckTimeout) {
        clearTimeout(window.emailCheckTimeout);
      }
    };
  }, []);

  const handleMintVoucher = async () => {
    if (!user?.wallet?.address || !collection || !recipientWalletAddress) return;

    // Clear any previous minting errors when starting
    setMintingError(null);
    setIsMinting(true);
    try {
      // Always use form data since we always upload custom image
        const voucherName = collection.collectionName || 'Voucher';
      const description = `Voucher from ${collection.collectionName}`;
      const merchantId = user.wallet.address; // Use creator's address as merchant ID

      let voucherMetadataUri: string | null = null;

      // Always generate metadata for vouchers using uploaded image
      try {
        // Always upload custom image to IPFS
        const imageUri = await generateImageUri(uploadedImageFile!);

        // Generate voucher metadata
        const metadata = {
          name: voucherName,
          symbol: 'VERXIO-VOUCHER',
          description: description,
          image: imageUri,
          properties: {
            files: [
              {
                uri: imageUri,
                type: 'image/png',
              },
            ],
            category: 'image',
            creators: [
              {
                address: user.wallet.address,
                share: 100,
              },
            ],
          },
          attributes: [
            {
              trait_type: 'Voucher Type',
              value: mintData.voucherType,
            },
            {
              trait_type: 'Max Uses',
              value: mintData.maxUses.toString(),
            },
            {
              trait_type: 'Expiry Date',
              value: new Date(mintData.expiryDate).toISOString(),
            },
            {
              trait_type: 'Merchant ID',
              value: merchantId,
            },
            {
              trait_type: 'Status',
              value: 'Active',
            },
            {
              trait_type: 'conditions',
              value: formatConditionString(mintData.conditions),
            },
            
          ],
        };

        // Store metadata to IPFS
        voucherMetadataUri = await storeMetadata(metadata);
      } catch (error) {
        console.error('Error generating voucher metadata:', error);
        setError('Failed to generate voucher metadata. Please try again.');
        setIsMinting(false);
        return;
      }

      const calculatedExpiryDate = new Date(new Date(mintData.expiryDate).setHours(23, 59, 59, 999) + 24 * 60 * 60 * 1000);
      const mintVoucherData = {
        collectionId: collection.id,
        recipient: recipientWalletAddress,
        voucherName,
        voucherType: mintData.voucherType,
        value: 0, // Value not needed as per agreement
        description,
        expiryDate: calculatedExpiryDate,
        maxUses: parseInt(mintData.maxUses),
        transferable: mintData.transferable,
        merchantId,
        conditions: mintData.conditions ? formatConditionString(mintData.conditions) : '', 
        voucherMetadataUri
      };

      // console.log('Full mint voucher data:', mintVoucherData);
      const result = await mintVoucher(mintVoucherData, user.wallet.address);
      if (result.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        // Close form and reset on success
        setShowMintForm(false);
        setUploadedImage(null);
        setUploadedImageFile(null);
        setRecipientWalletAddress(null);
        setMintData({
          recipient: '',
          voucherType: 'PERCENTAGE_OFF',
          value: '',
          expiryDate: '',
          maxUses: '1',
          transferable: true,
          conditions: ''
        });
      } else {
        // On failure, just refresh stats but keep form open
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        setMintingError(result.error || 'Failed to mint voucher');
        // Keep form open, keep uploaded image, keep all form data for retry
      }
    } catch (error: any) {
      console.error('Voucher minting error:', error);
      setMintingError(error.message || 'Failed to mint voucher. Please try again.');
      // Keep form open for user to retry
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

  if ((error && !mintingError) || !collection) {
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
              {collection.vouchers.length}
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
                    } catch { }
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
                onClick={() => {
                  setShowMintForm(true);
                  setMintingError(null); // Clear minting errors when opening form
                }}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Mint New Voucher
              </AppButton>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-white text-sm mb-1 block">Recipient Email</Label>
                  <Input
                    type="email"
                    value={mintData.recipient}
                    onChange={(e) => handleRecipientEmailChange(e.target.value)}
                    placeholder="Enter verxio email address"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                  />
                  {isCheckingEmail && (
                    <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                      <div className="w-3 h-3 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                      Verifying user record...
                    </div>
                  )}
                  {!isCheckingEmail && recipientWalletAddress && (
                    <div className="text-xs text-green-400 mt-1">
                      ✓ User found: {recipientWalletAddress.slice(0, 6)}...{recipientWalletAddress.slice(-6)}
                    </div>
                  )}
                  {!isCheckingEmail && mintData.recipient && !recipientWalletAddress && (
                    <div className="text-xs text-red-400 mt-1">
                      ✗ User not found with this email
                    </div>
                  )}
                </div>

                {/* Voucher Image Upload */}
                <div className="space-y-2">
                  <Label className="text-white text-sm">Upload Voucher Image</Label>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-white/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="voucher-image-upload"
                    />
                    <label htmlFor="voucher-image-upload" className="cursor-pointer">
                      {uploadedImage ? (
                        <div className="space-y-2">
                          <div className="w-full h-32 overflow-hidden rounded-lg relative">
                            <img
                              src={uploadedImage}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-white/60 text-sm text-center">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-6 h-6 text-white/60 mx-auto" />
                          <p className="text-white/60 text-sm">Click to upload image</p>
                          <p className="text-white/40 text-xs">Recommended size: 500x500px</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-white text-sm mb-1 block">Voucher Type</Label>
                  <CustomSelect
                    value={mintData.voucherType}
                    onChange={(value: string) => setMintData({ ...mintData, voucherType: value as any })}
                    options={collection?.blockchainDetails?.metadata?.voucherTypes?.map((type: string) => ({
                      value: type.toUpperCase().replace(' ', '_'),
                      label: type
                    })) || [
                        { value: 'FREE_ITEM', label: 'Free Item' },
                        { value: 'BUY_ONE_GET_ONE', label: 'Buy One Get One' },
                        { value: 'CUSTOM_REWARD', label: 'Custom Reward' }
                      ]}
                    className="bg-black/20 border-white/20 text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Max Uses</Label>
                    <Input
                      type="number"
                      value={mintData.maxUses}
                      onChange={(e) => setMintData({ ...mintData, maxUses: e.target.value })}
                      placeholder="1"
                      min="1"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-1 block">Expiry Date</Label>
                    <Input
                      type="date"
                      value={mintData.expiryDate}
                      onChange={(e) => setMintData({ ...mintData, expiryDate: e.target.value })}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-white text-sm mb-1 block">Conditions (Optional)</Label>
                  <CustomSelect
                    value={mintData.conditions}
                    onChange={(value: string) => setMintData({ ...mintData, conditions: value })}
                    options={[
                      { value: '', label: 'No conditions' },
                      { value: 'minimum_purchase_10', label: 'Minimum purchase $10' },
                      { value: 'minimum_purchase_25', label: 'Minimum purchase $25' },
                      { value: 'minimum_purchase_50', label: 'Minimum purchase $50' },
                      { value: 'weekdays_only', label: 'Valid weekdays only' },
                      { value: 'weekends_only', label: 'Valid weekends only' },
                      { value: 'first_time_customer', label: 'First-time customers only' },
                      { value: 'new_customer', label: 'New customers only' },
                      { value: 'loyalty_member', label: 'Loyalty members only' }
                    ]}
                    className="bg-black/20 border-white/20 text-white text-sm"
                  />
                  <div className="text-xs text-white/60 mt-1">
                    Select a condition for voucher redemption
                  </div>
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
                    disabled={isMinting || !recipientWalletAddress || !mintData.expiryDate || !uploadedImageFile}
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
                
                {/* Minting Error Display */}
                {mintingError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{mintingError}</span>
                    </div>
                  </div>
                )}
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
                          <div className="text-blue-400">
                            <Gift className="w-4 h-4" />
                          </div>
                          <span className="text-white font-medium">Voucher #{voucher.id.slice(-6)}</span>
                        </div>
                        <div className="text-xs font-medium text-blue-400">
                          Loading...
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-white/60 mb-3">
                        <div>Type: Loading...</div>
                        <div>Value: Loading...</div>
                        <div>Uses: Loading...</div>
                        <div>Expires: Loading...</div>
                      </div>

                      <div className="text-xs text-white/40 mb-3">
                        Recipient: {voucher.recipient.slice(0, 6)}...{voucher.recipient.slice(-6)}
                      </div>


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
                            className={`px-3 py-2 text-xs rounded-lg ${currentPage === pageNum
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
                            className={`px-3 py-2 text-xs rounded-lg ${currentPage === totalPages
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
