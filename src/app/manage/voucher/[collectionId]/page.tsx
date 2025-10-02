'use client';

import { useEffect, useState } from 'react';
import type { MintVoucherData } from '@/app/actions/voucher';

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
import { useSolanaWallets, useSendTransaction } from '@privy-io/react-auth/solana';
import { Transaction, VersionedTransaction, PublicKey, Connection } from '@solana/web3.js';
import { getVoucherCollectionByPublicKey, mintVoucher, redeemVoucher, cancelVoucher, extendVoucherExpiry } from '@/app/actions/voucher';
import { getUserByEmail } from '@/app/actions/user';
import { createRewardLink, getRewardLinksForCollection, duplicateRewardLinks, bulkCreateRewardLinks, sponsorTokenTransfer, sponsorEscrowTransfer } from '@/app/actions/reward';
import { generateImageUri } from '@/lib/metadata/generateImageURI';
import { storeMetadata } from '@/app/actions/metadata';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Check, X, Gift, Users, ExternalLink, Upload, Link, Copy } from 'lucide-react';
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
    voucherName: string;
    voucherType: string;
    value: number;
    symbol: string;
    description: string;
    expiryDate: string;
    maxUses: number;
    currentUses: number;
    transferable: boolean;
    status: string;
    merchantId: string;
    conditions: string;
    image: string | null;
    isExpired: boolean;
    canRedeem: boolean;
    voucherData?: {
      remainingWorth: number;
      [key: string]: any;
    };
  }>;
}

export default function VoucherCollectionDetailPage() {
  const { user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();
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
    voucherType: '',
    value: '',
    valueSymbol: 'USDC',
    assetName: '',
    assetSymbol: '',
    expiryDate: '',
    maxUses: '1',
    transferable: false,
    conditions: ''
  });
  const [tokenSelection, setTokenSelection] = useState('usdc');
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [rewardTokenSelection, setRewardTokenSelection] = useState('usdc');
  const [rewardCustomTokenAddress, setRewardCustomTokenAddress] = useState('');
  const [recipientWalletAddress, setRecipientWalletAddress] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Operation states
  const [operatingVoucherId, setOperatingVoucherId] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<string | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'redeem' | 'cancel' | 'extend' | null>(null);
  const [modalVoucherId, setModalVoucherId] = useState<string | null>(null);

  // Success screen states
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [operationLoading, setOperationLoading] = useState(false);

  // Modal error state
  const [modalError, setModalError] = useState<string | null>(null);

  // Separate minting error from critical errors
  const [mintingError, setMintingError] = useState<string | null>(null);

  // Reward link states
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardData, setRewardData] = useState({
    voucherType: '',
    customVoucherType: '',
    voucherWorth: '',
    valueSymbol: 'USDC',
    assetName: '',
    assetSymbol: '',
    maxUses: '1',
    expiryDate: '',
    transferable: false,
    conditions: '',
    quantity: '1'
  });
  const [rewardImageFile, setRewardImageFile] = useState<File | null>(null);
  const [rewardImagePreview, setRewardImagePreview] = useState<string | null>(null);
  const [isCreatingReward, setIsCreatingReward] = useState(false);
  const [createdRewardLink, setCreatedRewardLink] = useState<string | null>(null);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const [rewardLinks, setRewardLinks] = useState<Array<any>>([]);
  const [rewardCurrentPage, setRewardCurrentPage] = useState(1);
  const [rewardPageSize] = useState(5);
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [selectedRewardToDuplicate, setSelectedRewardToDuplicate] = useState<any>(null);
  const [duplicateQuantity, setDuplicateQuantity] = useState('1');
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Vouchers pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5); // Max 10 items per page

  // Dropdown states
  const [showRewardLinks, setShowRewardLinks] = useState(false);
  const [showVouchers, setShowVouchers] = useState(false);
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false);

  // Fetch USDC mint address from config
  const [usdcMintAddress, setUsdcMintAddress] = useState<string>('');

  // Fetch USDC config on component mount
  useEffect(() => {
    const fetchUsdcConfig = async () => {
      try {
        const { getVerxioConfig } = await import('@/app/actions/loyalty');
        const config = await getVerxioConfig();
        if (config.usdcMint) {
          setUsdcMintAddress(config.usdcMint);
        }
      } catch (error) {
        console.error('Error fetching USDC config:', error);
      }
    };
    fetchUsdcConfig();
  }, []);

  // Calculate pagination for vouchers
  const totalVouchers = collection?.vouchers.length || 0;
  const totalPages = Math.ceil(totalVouchers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  // Sort vouchers by most recent first (createdAt descending)
  const sortedVouchers = collection?.vouchers.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) || [];
  const currentVouchers = sortedVouchers.slice(startIndex, endIndex);


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
      // Check file size (2MB = 2 * 1024 * 1024 bytes)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        setMintingError(`File size too large. Maximum size is 2MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        return;
      }
      
      setUploadedImageFile(file);
      setMintingError(null); // Clear any previous errors
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
          // load reward links
          const linksRes = await getRewardLinksForCollection((res.collection as any).id, user.wallet.address);
          if (linksRes.success && linksRes.links) setRewardLinks(linksRes.links);
        } else {
          setError(res.error || 'Failed to load voucher collection');
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.wallet?.address, collectionPublicKey]);

  // Reward links pagination calculations
  const totalRewardLinks = rewardLinks.length;
  const totalRewardPages = Math.ceil(totalRewardLinks / rewardPageSize) || 1;
  const rewardStartIndex = (rewardCurrentPage - 1) * rewardPageSize;
  const rewardEndIndex = rewardStartIndex + rewardPageSize;
  const currentRewardLinks = rewardLinks.slice(rewardStartIndex, rewardEndIndex);

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
              trait_type: 'Conditions',
              value: formatConditionString(mintData.conditions),
            },
            ...(mintData.assetName ? [{
              trait_type: 'Asset Name',
              value: mintData.assetName,
            }] : []),
            ...(mintData.assetSymbol ? [{
              trait_type: 'Asset Symbol',
              value: mintData.assetSymbol,
            }] : []),
            ...((mintData.voucherType === 'TOKEN' && tokenSelection === 'custom_token' && customTokenAddress) ? [{
              trait_type: 'Token Address',
              value: customTokenAddress,
            }] : []),
            ...((mintData.voucherType === 'TOKEN' && tokenSelection === 'usdc' && usdcMintAddress) ? [{
              trait_type: 'Token Address',
              value: usdcMintAddress,
            }] : []),
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
        voucherType: mintData.voucherType as MintVoucherData['voucherType'],
        value: parseFloat(mintData.value),
        valueSymbol: mintData.valueSymbol,
        assetName: mintData.assetName,
        assetSymbol: mintData.assetSymbol,
        tokenAddress: mintData.voucherType === 'TOKEN' && tokenSelection === 'custom_token' ? customTokenAddress : (mintData.voucherType === 'TOKEN' && tokenSelection === 'usdc' ? usdcMintAddress : undefined),
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
        // Handle token transfer if required - Follow exact same pattern as send page
        if (result.requiresTokenTransfer && result.tokenTransferTransaction) {
          try {
            // Since FEE_ADDRESS is in env, this will always be a sponsored transaction
            const transaction = Transaction.from(Buffer.from(result.tokenTransferTransaction, 'base64'));

            if (!wallets || wallets.length === 0) {
              throw new Error('No Solana wallets available');
            }

            // For sponsored transactions, user signs their part, then backend adds fee payer signature
            // Convert to VersionedTransaction and get the message
            const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
            
            // Serialize the message for signing
            const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
            
            // Sign the message with the user's wallet
            const { signMessage } = wallets[0];
            const serializedUserSignature = await signMessage(serializedMessage);
            
            // Add user signature to transaction
            versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
            
            // Serialize the partially signed transaction
            const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

            // Send to backend for fee payer signature and broadcasting
            const sponsorResult = await sponsorTokenTransfer({
              voucherId: result.voucher!.id,
              transaction: serializedUserSignedTx
            });

            if (!sponsorResult.success) {
              throw new Error(sponsorResult.error || 'Failed to sponsor token transfer');
            }

            console.log('Token transfer successful (sponsored):', sponsorResult.signature);
          } catch (tokenError) {
            console.error('Token transfer failed:', tokenError);
            setMintingError(`Voucher minted but token transfer failed: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
            // Don't fail the entire operation, just show warning
          }
        }

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
        setTokenSelection('usdc');
        setCustomTokenAddress('');
        setMintData({
          recipient: '',
          voucherType: '',
          value: '',
          valueSymbol: 'USDC',
          assetName: '',
          assetSymbol: '',
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

  const handleRedeemVoucher = async (voucherId: string) => {
    if (!user?.wallet?.address || !redeemAmount) return;

    // Clear any previous modal errors when starting the operation
    setModalError(null);
    setOperationLoading(true);
    setOperationType('redeem');
    try {
      const result = await redeemVoucher(voucherId, user.wallet.address, user.wallet.address, parseFloat(redeemAmount));
      if (result.success && 'result' in result && result.result?.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        // Show success screen
        setSuccessMessage('Voucher redeemed successfully!');
        setShowSuccessScreen(true);
        // Close modal and reset state
        setShowModal(false);
        setModalType(null);
        setModalVoucherId(null);
        setOperatingVoucherId(null);
        setOperationType(null);
        setRedeemAmount('');
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to redeem voucher';
        setModalError(errorMessage);
      }
    } catch (error) {
      setModalError('Failed to redeem voucher');
    } finally {
      setOperationLoading(false);
      setOperationType(null);
    }
  };

  const handleCancelVoucher = async (voucherId: string) => {
    if (!user?.wallet?.address) return;

    // Clear any previous modal errors when starting the operation
    setModalError(null);
    setOperationLoading(true);
    setOperationType('cancel');
    try {
      const result = await cancelVoucher(voucherId, cancelReason, user.wallet.address);
      if (result.success && 'result' in result && result.result?.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        // Show success screen
        setSuccessMessage('Voucher cancelled successfully!');
        setShowSuccessScreen(true);
        // Close modal and reset state
        setShowModal(false);
        setModalType(null);
        setModalVoucherId(null);
        setOperatingVoucherId(null);
        setOperationType(null);
        setCancelReason('');
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to cancel voucher';
        setModalError(errorMessage);
      }
    } catch (error) {
      setModalError('Failed to cancel voucher');
    } finally {
      setOperationLoading(false);
      setOperationType(null);
    }
  };

  const handleExtendExpiry = async (voucherId: string) => {
    if (!user?.wallet?.address || !newExpiryDate) return;

    // Clear any previous modal errors when starting the operation
    setModalError(null);
    setOperationLoading(true);
    setOperationType('extend');
    try {
      // Set the expiry date to the end of the selected day to ensure it's in the future
      const updatedExpiryDate = new Date(new Date(newExpiryDate).setHours(23, 59, 59, 999) + 24 * 60 * 60 * 1000);
      const result = await extendVoucherExpiry(voucherId, updatedExpiryDate, user.wallet.address);
      if (result.success && 'result' in result && result.result?.success) {
        // Refresh collection data
        const res = await getVoucherCollectionByPublicKey(collectionPublicKey, user.wallet.address);
        if (res.success && res.collection) {
          setCollection(res.collection as VoucherCollection);
        }
        // Show success screen
        setSuccessMessage('Voucher expiry extended successfully!');
        setShowSuccessScreen(true);
        // Close modal and reset state
        setShowModal(false);
        setModalType(null);
        setModalVoucherId(null);
        setOperatingVoucherId(null);
        setOperationType(null);
        setNewExpiryDate('');
      } else {
        const errorMessage = ('result' in result && result.result?.errors?.[0]) || result.error || 'Failed to extend voucher expiry';
        setModalError(errorMessage);
      }
    } catch (error) {
      setModalError('Failed to extend voucher expiry');
    } finally {
      setOperationLoading(false);
      setOperationType(null);
    }
  };


  const handleCreateRewardLink = async () => {
    if (!user?.wallet?.address || !collection || !rewardImageFile) return;

    setRewardError(null);
    setIsCreatingReward(true);
    try {
      const quantity = parseInt(rewardData.quantity) || 1;
      
      if (quantity === 1) {
        // Single creation - use existing createRewardLink function
        const imageUri = await generateImageUri(rewardImageFile);
        
        const result = await createRewardLink({
          creatorAddress: user.wallet.address,
          collectionId: collection.id,
          voucherType: rewardData.voucherType === 'CUSTOM_REWARD' ? rewardData.customVoucherType : rewardData.voucherType,
          voucherWorth: parseFloat(rewardData.voucherWorth),
          valueSymbol: rewardData.valueSymbol,
          assetName: rewardData.assetName,
          assetSymbol: rewardData.assetSymbol,
          tokenAddress: rewardData.voucherType === 'TOKEN' && rewardTokenSelection === 'custom_token' ? rewardCustomTokenAddress : (rewardData.voucherType === 'TOKEN' && rewardTokenSelection === 'usdc' ? usdcMintAddress : undefined),
          maxUses: parseInt(rewardData.maxUses),
          expiryDate: rewardData.expiryDate ? new Date(rewardData.expiryDate) : undefined,
          transferable: rewardData.transferable,
          conditions: rewardData.conditions,
          imageUri
        });

        if (result.success && result.reward) {
          // Handle escrow transfer if required
          if (result.requiresEscrowTransfer && result.escrowTransaction && result.reward) {
            try {
              // Since FEE_ADDRESS is in env, this will always be a sponsored transaction
              const transaction = Transaction.from(Buffer.from((result as any).escrowTransaction, 'base64'));

              if (!wallets || wallets.length === 0) {
                throw new Error('No Solana wallets available');
              }

              // For sponsored transactions, user signs their part, then backend adds fee payer signature
              const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
              
              // Serialize the message for signing
              const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
              
              // Sign the message with the user's wallet
              const { signMessage } = wallets[0];
              const serializedUserSignature = await signMessage(serializedMessage);
              
              // Add user signature to transaction
              versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
              
              // Serialize the partially signed transaction
              const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

              // Send to backend for fee payer signature and broadcasting
              const sponsorResult = await sponsorEscrowTransfer({
                rewardId: (result as any).reward.id,
                transaction: serializedUserSignedTx
              });

              if (!sponsorResult.success) {
                throw new Error(sponsorResult.error || 'Failed to sponsor escrow transfer');
              }

              console.log('Escrow transfer successful (sponsored):', sponsorResult.signature);
            } catch (escrowError) {
              console.error('Escrow transfer failed:', escrowError);
              setRewardError(`Reward link created but escrow transfer failed: ${escrowError instanceof Error ? escrowError.message : 'Unknown error'}`);
              // Don't fail the entire operation, just show warning
            }
          }

          setCreatedRewardLink(`${window.location.origin}/reward/${result.reward.slug}`);
          // Refresh reward links list
          const linksRes = await getRewardLinksForCollection(collection.id, user.wallet.address);
          if (linksRes.success && linksRes.links) setRewardLinks(linksRes.links);
          // Reset form and close
          setRewardData({
            voucherType: '',
            customVoucherType: '',
            voucherWorth: '',
            valueSymbol: 'USDC',
            assetName: '',
            assetSymbol: '',
            maxUses: '1',
            expiryDate: '',
            transferable: false,
            conditions: '',
            quantity: '1'
          });
          setRewardImageFile(null);
          setRewardImagePreview(null);
          setRewardTokenSelection('usdc');
          setRewardCustomTokenAddress('');
          setShowRewardForm(false);
          setRewardError(null);
        } else {
          setRewardError(result.error || 'Failed to create reward link');
        }
      } else {
        // Bulk creation - upload image once, create metadata once, then duplicate records
        const imageUri = await generateImageUri(rewardImageFile);
        
        // Use bulk creation server action
        const result = await bulkCreateRewardLinks({
          creatorAddress: user.wallet.address,
          collectionId: collection.id,
          voucherType: rewardData.voucherType === 'CUSTOM_REWARD' ? rewardData.customVoucherType : rewardData.voucherType,
          voucherWorth: parseFloat(rewardData.voucherWorth),
          valueSymbol: rewardData.valueSymbol,
          assetName: rewardData.assetName,
          assetSymbol: rewardData.assetSymbol,
          tokenAddress: rewardData.voucherType === 'TOKEN' && rewardTokenSelection === 'custom_token' ? rewardCustomTokenAddress : (rewardData.voucherType === 'TOKEN' && rewardTokenSelection === 'usdc' ? usdcMintAddress : undefined),
          maxUses: parseInt(rewardData.maxUses),
          expiryDate: rewardData.expiryDate ? new Date(rewardData.expiryDate) : undefined,
          transferable: rewardData.transferable,
          conditions: rewardData.conditions,
          imageUri,
          quantity
        });

        if (result.success && result.rewards) {
          // Handle escrow transfer if required
          if (result.requiresEscrowTransfer && result.escrowTransaction) {
            try {
              // Since FEE_ADDRESS is in env, this will always be a sponsored transaction
              const transaction = Transaction.from(Buffer.from(result.escrowTransaction, 'base64'));

              if (!wallets || wallets.length === 0) {
                throw new Error('No Solana wallets available');
              }

              // For sponsored transactions, user signs their part, then backend adds fee payer signature
              const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
              
              // Serialize the message for signing
              const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
              
              // Sign the message with the user's wallet
              const { signMessage } = wallets[0];
              const serializedUserSignature = await signMessage(serializedMessage);
              
              // Add user signature to transaction
              versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
              
              // Serialize the partially signed transaction
              const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

              // Send to backend for fee payer signature and broadcasting
              const sponsorResult = await sponsorEscrowTransfer({
                rewardId: result.rewards[0].id, // Use first reward ID for bulk transfers
                transaction: serializedUserSignedTx,
                totalTokenAmount: result.totalTokenAmount // Pass total amount for bulk transfers
              });

              if (!sponsorResult.success) {
                throw new Error(sponsorResult.error || 'Failed to sponsor escrow transfer');
              }

              console.log('Escrow transfer successful (sponsored):', sponsorResult.signature);
            } catch (escrowError) {
              console.error('Escrow transfer failed:', escrowError);
              setRewardError(`Reward links created but escrow transfer failed: ${escrowError instanceof Error ? escrowError.message : 'Unknown error'}`);
              // Don't fail the entire operation, just show warning
            }
          }

          // Show all created links
          const createdLinks = result.rewards.map(reward => `${window.location.origin}/reward/${reward.slug}`);
          setCreatedRewardLink(createdLinks.join('\n'));
          
          // Refresh reward links list
          const linksRes = await getRewardLinksForCollection(collection.id, user.wallet.address);
          if (linksRes.success && linksRes.links) setRewardLinks(linksRes.links);
          
          // Reset form and close
          setRewardData({
            voucherType: '',
            customVoucherType: '',
            voucherWorth: '',
            valueSymbol: 'USDC',
            assetName: '',
            assetSymbol: '',
            maxUses: '1',
            expiryDate: '',
            transferable: false,
            conditions: '',
            quantity: '1'
          });
          setRewardImageFile(null);
          setRewardImagePreview(null);
          setRewardTokenSelection('usdc');
          setRewardCustomTokenAddress('');
          setShowRewardForm(false);
          setRewardError(null);
        } else {
          setRewardError(result.error || 'Failed to create reward links');
        }
      }
    } catch (error) {
      console.error('Error creating reward link:', error);
      setRewardError('Failed to create reward link');
    } finally {
      setIsCreatingReward(false);
    }
  };

  const copyRewardLink = async () => {
    if (createdRewardLink) {
      try {
        await navigator.clipboard.writeText(createdRewardLink);
        // You could add a toast notification here
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  };

  const handleDuplicateRewardLink = async () => {
    if (!user?.wallet?.address || !collection || !selectedRewardToDuplicate) return;

    setRewardError(null);
    setIsDuplicating(true);
    try {
      const quantity = parseInt(duplicateQuantity) || 1;
      
      // Use server-side duplication for better performance
      const result = await duplicateRewardLinks({
        creatorAddress: user.wallet.address,
        collectionId: collection.id,
        originalRewardId: selectedRewardToDuplicate.id,
        quantity
      });

      if (result.success && result.rewards) {
        // Handle escrow transfer if required
        if (result.requiresEscrowTransfer && result.escrowTransaction && result.rewards) {
          try {
            // Since FEE_ADDRESS is in env, this will always be a sponsored transaction
            const transaction = Transaction.from(Buffer.from(result.escrowTransaction, 'base64'));

            if (!wallets || wallets.length === 0) {
              throw new Error('No Solana wallets available');
            }

            // For sponsored transactions, user signs their part, then backend adds fee payer signature
            const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
            
            // Serialize the message for signing
            const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
            
            // Sign the message with the user's wallet
            const { signMessage } = wallets[0];
            const serializedUserSignature = await signMessage(serializedMessage);
            
            // Add user signature to transaction
            versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
            
            // Serialize the partially signed transaction
            const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

            // Send to backend for fee payer signature and broadcasting
            const sponsorResult = await sponsorEscrowTransfer({
              rewardId: result.rewards[0].id, // Use first reward ID for sponsorship
              transaction: serializedUserSignedTx
            });

            if (!sponsorResult.success) {
              throw new Error(sponsorResult.error || 'Failed to sponsor escrow transfer');
            }

            console.log('Escrow transfer successful (sponsored):', sponsorResult.signature);
          } catch (escrowError) {
            console.error('Escrow transfer failed:', escrowError);
            setRewardError(`Reward links duplicated but escrow transfer failed: ${escrowError instanceof Error ? escrowError.message : 'Unknown error'}`);
            // Don't fail the entire operation, just show warning
          }
        }

        const createdLinks = result.rewards.map(reward => `${window.location.origin}/reward/${reward.slug}`);
        setCreatedRewardLink(createdLinks.join('\n'));
        // Refresh reward links list
        const linksRes = await getRewardLinksForCollection(collection.id, user.wallet.address);
        if (linksRes.success && linksRes.links) setRewardLinks(linksRes.links);
        // Reset form and close
        setShowDuplicateForm(false);
        setSelectedRewardToDuplicate(null);
        setDuplicateQuantity('1');
        setRewardError(null);
      } else {
        setRewardError(result.error || 'Failed to duplicate reward links');
      }
    } catch (error) {
      console.error('Error duplicating reward link:', error);
      setRewardError('Failed to duplicate reward link');
    } finally {
      setIsDuplicating(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = (status).toString().toUpperCase();
    switch (s) {
      case 'ACTIVE': return 'text-green-400';
      case 'USED': return 'text-blue-400';
      case 'EXPIRED': return 'text-red-400';
      case 'CANCELLED': return 'text-gray-400';
      case 'CLAIMED': return 'text-purple-400';
      default: return 'text-white/60';
    }
  };

  const getRewardStatusClasses = (status: string) => {
    const s = (status || '').toString().toUpperCase();
    switch (s) {
      case 'ACTIVE':
        return 'text-green-400 border-green-500/40 bg-green-500/10';
      case 'CLAIMED':
        return 'text-purple-400 border-purple-500/40 bg-purple-500/10';
      case 'EXPIRED':
        return 'text-red-400 border-red-500/40 bg-red-500/10';
      default:
        return 'text-white/60 border-white/20 bg-white/5';
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
            <div className="text-sm font-medium text-white">Vouchers Issued</div>
            <div className="text-xl font-bold text-green-400">{collection.vouchers.length}</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Active Vouchers</div>
            <div className="text-xl font-bold text-blue-400">
              {collection.vouchers.filter(v => v.status === 'active' && !v.isExpired).length}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Redeemed</div>
            <div className="text-xl font-bold text-purple-400">
              {collection.vouchers.filter(v => v.status === 'used').length}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <X className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Cancelled</div>
            <div className="text-xl font-bold text-red-400">
              {collection.vouchers.filter(v => v.status === 'cancelled').length}
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
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-2">Voucher Address</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs truncate text-white/80 border border-white/10 rounded-md px-3 py-2 bg-white/5">
                  {collection.collectionPublicKey}
                </div>
                <AppButton
                  onClick={() => window.open(`https://solscan.io/token/${collection.collectionPublicKey}`, '_blank')}
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
              Mint New Voucher
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showMintForm ? (
              <AppButton
                onClick={() => {
                  setShowMintForm(true);
                  setShowRewardForm(false); // Close reward form when opening mint form
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
                          <p className="text-white/40 text-xs">Max size: 2MB • Recommended: 500x500px</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-white text-sm mb-1 block">Voucher Type</Label>
                  <CustomSelect
                    value={mintData.voucherType}
                    onChange={(value: string) => {
                      const newVoucherType = value as any;
                      if (newVoucherType === 'TOKEN') {
                        // Set USDC as default for TOKEN
                        setMintData({ 
                          ...mintData, 
                          voucherType: newVoucherType,
                          assetName: 'USD Coin',
                          assetSymbol: 'USDC'
                        });
                        setTokenSelection('usdc');
                        setCustomTokenAddress('');
                      } else if (newVoucherType === 'FIAT') {
                        // Clear asset fields for FIAT (user will fill them)
                        setMintData({ 
                          ...mintData, 
                          voucherType: newVoucherType,
                          assetName: '',
                          assetSymbol: ''
                        });
                      } else {
                        // For other voucher types, use USDC as default
                        setMintData({ 
                          ...mintData, 
                          voucherType: newVoucherType,
                          assetName: 'USD Coin',
                          assetSymbol: 'USDC'
                        });
                      }
                    }}
                    options={[
                      ...(collection?.blockchainDetails?.metadata?.voucherTypes?.map((type: string) => ({
                        value: type.toUpperCase().replace(' ', '_'),
                        label: type
                      })) || []),
                      { value: 'TOKEN', label: 'Token' },
                      // { value: 'LOYALTY_COIN', label: 'Loyalty Coin' },
                      { value: 'FIAT', label: 'Fiat' }
                    ]}
                    className="bg-black/20 border-white/20 text-white text-sm"
                  />
                </div>

                {/* Token Selection for Token type */}
                {mintData.voucherType === 'TOKEN' && (
                  <>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Token Selection</Label>
                      <CustomSelect
                        value={tokenSelection}
                        onChange={(value: string) => {
                          setTokenSelection(value);
                          if (value === 'usdc') {
                            setMintData({ 
                              ...mintData, 
                              assetName: 'USD Coin',
                              assetSymbol: 'USDC'
                            });
                            setCustomTokenAddress('');
                          } else if (value === 'custom_token') {
                            // Clear the USDC values when switching to custom token
                            setMintData({ 
                              ...mintData, 
                              assetName: '',
                              assetSymbol: ''
                            });
                          }
                        }}
                        options={[
                          { value: 'usdc', label: 'USDC' },
                          { value: 'custom_token', label: 'Custom Token' }
                        ]}
                        className="bg-black/20 border-white/20 text-white text-sm"
                      />
                    </div>

                    {/* Custom Token fields */}
                    {tokenSelection === 'custom_token' && (
                      <>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Address</Label>
                          <Input
                            value={customTokenAddress}
                            onChange={(e) => setCustomTokenAddress(e.target.value)}
                            placeholder="Enter token contract address"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Name</Label>
                          <Input
                            value={mintData.assetName}
                            onChange={(e) => setMintData({ ...mintData, assetName: e.target.value })}
                            placeholder="e.g., Bitcoin, Ethereum, Custom Token"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Symbol</Label>
                          <Input
                            value={mintData.assetSymbol}
                            onChange={(e) => setMintData({ ...mintData, assetSymbol: e.target.value.toUpperCase() })}
                            placeholder="e.g., BTC, ETH, CUSTOM"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                      </>
                    )}

                    {/* Token Information */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 mt-0.5 text-blue-400">ℹ️</div>
                        <div className="text-xs text-blue-300">
                          Token amount will be debited from your account and transferred to the voucher.
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Asset Name and Symbol fields for Fiat */}
                {mintData.voucherType === 'FIAT' && (
                  <>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Asset Name</Label>
                      <Input
                        value={mintData.assetName}
                        onChange={(e) => setMintData({ ...mintData, assetName: e.target.value })}
                        placeholder="e.g., Bitcoin, Ethereum, Gold, Silver"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Asset Symbol</Label>
                      <Input
                        value={mintData.assetSymbol}
                        onChange={(e) => setMintData({ ...mintData, assetSymbol: e.target.value.toUpperCase() })}
                        placeholder="e.g., BTC, ETH, GOLD, SILVER"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                  </>
                )}
                {/* Value + Max Uses side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Voucher Worth</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={mintData.value}
                      onChange={(e) => setMintData({ ...mintData, value: e.target.value })}
                      placeholder="0.00"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
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
                    disabled={
                      isMinting ||
                      !recipientWalletAddress ||
                      !mintData.voucherType ||
                      !mintData.expiryDate ||
                      !uploadedImageFile ||
                      (mintData.voucherType === 'TOKEN' && tokenSelection === 'custom_token' && !customTokenAddress)
                    }
                    className="flex-1"
                  >
                    {isMinting ? (
                      <VerxioLoaderWhiteSmall size="sm" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Voucher
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

        {/* Create Reward Link */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              Create Shareable Reward Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showRewardForm ? (
              <AppButton
                onClick={() => {
                  setShowRewardForm(true);
                  setShowMintForm(false); // Close mint form when opening reward form
                  setRewardError(null);
                }}
                className="w-full"
              >
                <Link className="w-4 h-4 mr-2" />
                Create Reward Link
              </AppButton>
            ) : (
              <div className="space-y-4">
                {/* Image Upload - first */}
                <div>
                  <Label className="text-white text-sm mb-1 block">Reward Image</Label>
                  <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-white/30 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Check file size (2MB = 2 * 1024 * 1024 bytes)
                          const maxSize = 2 * 1024 * 1024; // 2MB
                          if (file.size > maxSize) {
                            setRewardError(`File size too large. Maximum size is 2MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
                            return;
                          }
                          
                          setRewardImageFile(file);
                          setRewardError(null); // Clear any previous errors
                          const reader = new FileReader();
                          reader.onload = (ev) => setRewardImagePreview(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="reward-image-upload"
                    />
                    <label htmlFor="reward-image-upload" className="cursor-pointer">
                      {rewardImagePreview ? (
                        <div className="space-y-2">
                          <div className="w-full h-32 overflow-hidden rounded-lg relative">
                            <img src={rewardImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                          <p className="text-white/60 text-sm text-center">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-2 flex flex-col items-center">
                          <Upload className="w-8 h-8 text-white/60" />
                          <span className="text-white/60 text-sm">Click to upload image</span>
                          <p className="text-white/40 text-xs">Max size: 2MB • Recommended: 500x500px</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Voucher Type from collection + Custom Reward */}
                <div>
                  <Label className="text-white text-sm mb-1 block">Voucher Type</Label>
                  <CustomSelect
                    value={rewardData.voucherType}
                    onChange={(value) => {
                      const newVoucherType = value;
                      if (newVoucherType === 'TOKEN') {
                        // Set USDC as default for TOKEN
                        setRewardData({ 
                          ...rewardData, 
                          voucherType: newVoucherType,
                          assetName: 'USD Coin',
                          assetSymbol: 'USDC'
                        });
                        setRewardTokenSelection('usdc');
                        setRewardCustomTokenAddress('');
                      } else if (newVoucherType === 'FIAT') {
                        // Clear asset fields for FIAT (user will fill them)
                        setRewardData({ 
                          ...rewardData, 
                          voucherType: newVoucherType,
                          assetName: '',
                          assetSymbol: ''
                        });
                      } else {
                        // For other voucher types, use USDC as default
                        setRewardData({ 
                          ...rewardData, 
                          voucherType: newVoucherType,
                          assetName: 'USD Coin',
                          assetSymbol: 'USDC'
                        });
                      }
                    }}
                    options={[
                      ...(collection?.blockchainDetails?.metadata?.voucherTypes?.map((type: string) => ({
                        value: type.toUpperCase().replace(' ', '_'),
                        label: type
                      })) || []),
                      { value: 'TOKEN', label: 'Token' },
                      // { value: 'LOYALTY_COIN', label: 'Loyalty Coin' },
                      { value: 'FIAT', label: 'Fiat' },
                      { value: 'CUSTOM_REWARD', label: 'Select Custom Reward' }
                    ]}
                    className="bg-black/20 border-white/20 text-white"
                  />
                </div>

                {/* Token Selection for Token type */}
                {rewardData.voucherType === 'TOKEN' && (
                  <>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Token Selection</Label>
                      <CustomSelect
                        value={rewardTokenSelection}
                        onChange={(value: string) => {
                          setRewardTokenSelection(value);
                          if (value === 'usdc') {
                            setRewardData({ 
                              ...rewardData, 
                              assetName: 'USD Coin',
                              assetSymbol: 'USDC'
                            });
                            setRewardCustomTokenAddress('');
                          } else if (value === 'custom_token') {
                            // Clear the USDC values when switching to custom token
                            setRewardData({ 
                              ...rewardData, 
                              assetName: '',
                              assetSymbol: ''
                            });
                          }
                        }}
                        options={[
                          { value: 'usdc', label: 'USDC' },
                          { value: 'custom_token', label: 'Custom Token' }
                        ]}
                        className="bg-black/20 border-white/20 text-white text-sm"
                      />
                    </div>

                    {/* Custom Token fields */}
                    {rewardTokenSelection === 'custom_token' && (
                      <>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Address</Label>
                          <Input
                            value={rewardCustomTokenAddress}
                            onChange={(e) => setRewardCustomTokenAddress(e.target.value)}
                            placeholder="Enter token contract address"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Name</Label>
                          <Input
                            value={rewardData.assetName}
                            onChange={(e) => setRewardData({ ...rewardData, assetName: e.target.value })}
                            placeholder="e.g., Bitcoin, Ethereum, Custom Token"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-white text-sm mb-1 block">Token Symbol</Label>
                          <Input
                            value={rewardData.assetSymbol}
                            onChange={(e) => setRewardData({ ...rewardData, assetSymbol: e.target.value.toUpperCase() })}
                            placeholder="e.g., BTC, ETH, CUSTOM"
                            className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                          />
                        </div>
                      </>
                    )}

                    {/* Token Information */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 mt-0.5 text-blue-400">ℹ️</div>
                        <div className="text-xs text-blue-300">
                          Token amount will be debited from your account and deposited into an escrow, then released upon reward claim.
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Asset Name and Symbol fields for Fiat */}
                {rewardData.voucherType === 'FIAT' && (
                  <>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Asset Name</Label>
                      <Input
                        value={rewardData.assetName}
                        onChange={(e) => setRewardData({ ...rewardData, assetName: e.target.value })}
                        placeholder="e.g., Bitcoin, Ethereum, Gold, Silver"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-white text-sm mb-1 block">Asset Symbol</Label>
                      <Input
                        value={rewardData.assetSymbol}
                        onChange={(e) => setRewardData({ ...rewardData, assetSymbol: e.target.value.toUpperCase() })}
                        placeholder="e.g., BTC, ETH, GOLD, SILVER"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Custom type input when Custom Reward selected */}
                {rewardData.voucherType === 'CUSTOM_REWARD' && (
                  <div>
                    <Label className="text-white text-sm mb-1 block">Custom Reward Type</Label>
                    <Input
                      value={rewardData.customVoucherType}
                      onChange={(e) => setRewardData({ ...rewardData, customVoucherType: e.target.value.substring(0, 10) })}
                      placeholder="e.g., T-Shirt"
                      maxLength={10}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                    <div className="text-xs text-white/60 mt-1 text-right">
                      {rewardData.customVoucherType.length}/10 characters
                    </div>
                  </div>
                )}

                {/* Value + Max Uses side by side */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white text-sm mb-1 block">Voucher Worth</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={rewardData.voucherWorth}
                        onChange={(e) => setRewardData({ ...rewardData, voucherWorth: e.target.value })}
                        placeholder="0.00"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white text-sm mb-1 block">Max Uses</Label>
                    <Input
                      type="number"
                      value={rewardData.maxUses}
                      onChange={(e) => setRewardData({ ...rewardData, maxUses: e.target.value })}
                      placeholder="1"
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                    />
                  </div>
                </div>

                {/* Expiry Date */}
                <div>
                  <Label className="text-white text-sm mb-1 block">Expiry Date</Label>
                  <Input
                    type="date"
                    value={rewardData.expiryDate}
                    onChange={(e) => setRewardData({ ...rewardData, expiryDate: e.target.value })}
                    className="bg-black/20 border-white/20 text-white text-sm"
                  />
                </div>

                {/* Conditions */}
                <div>
                  <Label className="text-white text-sm mb-1 block">Conditions</Label>
                  <CustomSelect
                    value={rewardData.conditions}
                    onChange={(value) => setRewardData({ ...rewardData, conditions: value })}
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
                    className="bg-black/20 border-white/20 text-white"
                  />
                </div>

                


                {/* Transferable */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="transferable"
                    checked={rewardData.transferable}
                    onChange={(e) => setRewardData({ ...rewardData, transferable: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="transferable" className="text-white text-sm">
                    Transferable
                  </Label>
                </div>

                {/* Quantity */}
                <div>
                  <Label className="text-white text-sm mb-1 block">Quantity</Label>
                  <Input
                    type="number"
                    value={rewardData.quantity}
                    onChange={(e) => setRewardData({ ...rewardData, quantity: e.target.value })}
                    placeholder="1"
                    min="1"
                    max="50"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                  />
                  <div className="text-xs text-white/60 mt-1">
                    Create multiple reward links with the same details (max 50)
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <AppButton
                    onClick={handleCreateRewardLink}
                    disabled={
                      !rewardData.voucherType ||
                      (rewardData.voucherType === 'CUSTOM_REWARD' && !rewardData.customVoucherType) ||
                      (rewardData.voucherType === 'TOKEN' && rewardTokenSelection === 'custom_token' && !rewardCustomTokenAddress) ||
                      !rewardImageFile ||
                      isCreatingReward
                    }
                    className="flex-1"
                  >
                    {isCreatingReward ? (
                      <VerxioLoaderWhiteSmall size="sm" />
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Create {parseInt(rewardData.quantity) > 1 ? `${rewardData.quantity} Reward Links` : 'Reward Link'}
                      </>
                    )}
                  </AppButton>
                  <AppButton
                    onClick={() => {
                      setShowRewardForm(false);
                      setRewardError(null);
                    }}
                    variant="secondary"
                    className="px-4"
                  >
                    <X className="w-4 h-4" />
                  </AppButton>
                </div>

                {/* Reward Error Display */}
                {rewardError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{rewardError}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Created Reward Link Display */}
            {/* {createdRewardLink && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Reward link created successfully!</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={createdRewardLink}
                    readOnly
                    className="bg-black/20 border-white/20 text-white text-sm"
                  />
                  <AppButton
                    onClick={copyRewardLink}
                    variant="secondary"
                    size="sm"
                    className="px-3"
                  >
                    <Copy className="w-4 h-4" />
                  </AppButton>
                </div>
              </div>
            )} */}
          </CardContent>
        </Card>

        {/* Reward Links */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowRewardLinks(!showRewardLinks)}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5" />
                Reward Links ({rewardLinks.length})
              </div>
              <span className="text-sm text-gray-400">
                {showRewardLinks ? '▼' : '▶'}
              </span>
            </CardTitle>
          </CardHeader>
          {showRewardLinks && (
            <CardContent>
            {rewardLinks.length === 0 ? (
              <div className="text-center py-8 text-white/60">No reward links yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentRewardLinks.map((rl) => (
                    <div key={rl.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-white font-medium text-sm truncate">{rl.voucherType}</div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-[10px] border ${getRewardStatusClasses(rl.status)}`}>
                            {String(rl.status).toUpperCase()}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedRewardToDuplicate(rl);
                              setShowDuplicateForm(true);
                              setRewardError(null);
                            }}
                            className="px-2 py-1 text-xs border border-blue-500/30 rounded hover:bg-blue-500/10 text-blue-400 transition-colors"
                            title="Duplicate this reward link"
                          >
                            Duplicate
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/reward/${rl.slug}`}
                          readOnly
                          className="bg-black/20 border-white/20 text-white text-xs"
                        />
                        <AppButton
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}/reward/${rl.slug}`);
                            } catch {}
                          }}
                          variant="secondary"
                          size="sm"
                          className="px-3"
                        >
                          <Copy className="w-4 h-4" />
                        </AppButton>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reward Links Pagination */}
                {totalRewardPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => setRewardCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={rewardCurrentPage === 1}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Previous
                    </button>
                    <div className="text-xs text-white/60">
                      Showing {rewardStartIndex + 1}-{Math.min(rewardEndIndex, totalRewardLinks)} of {totalRewardLinks} links
                    </div>
                    <button
                      onClick={() => setRewardCurrentPage((p) => Math.min(totalRewardPages, p + 1))}
                      disabled={rewardCurrentPage === totalRewardPages}
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

        {/* Vouchers List */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader
            className="cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setShowVouchers(!showVouchers)}
          >
            <CardTitle className="text-lg text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Vouchers ({collection.vouchers.length})
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSensitiveInfo(!showSensitiveInfo);
                  }}
                  className="ml-2 px-2 py-1 text-xs border border-white/20 rounded hover:bg-white/10 transition-colors"
                >
                  {showSensitiveInfo ? 'Hide' : 'Show'} Sensitive
                </button>
              </div>
              <span className="text-sm text-gray-400">
                {showVouchers ? '▼' : '▶'}
              </span>
            </CardTitle>
          </CardHeader>
          {showVouchers && (
            <CardContent>
            {collection.vouchers.length === 0 ? (
              <div className="text-center py-8 text-white/60">No vouchers minted yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {currentVouchers.map((voucher) => {
                    return (
                    <div key={voucher.id} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{voucher.voucherName}</span>
                        </div>
                        <div className={`text-xs font-medium ${getStatusColor(voucher.isExpired ? 'expired' : voucher.status)}`}>
                          {voucher.isExpired ? 'EXPIRED' : voucher.status.toUpperCase()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-white/60 mb-3">
                        <div>Type: {voucher.voucherType.replace(/_/g, ' ')}</div>
                        <div>Value: {(voucher.voucherData?.remainingWorth ?? voucher.value)?.toLocaleString()} {voucher.symbol || 'USDC'}</div>
                        <div>Uses: {voucher.currentUses}/{voucher.maxUses}</div>
                        <div>Expires: {new Date(voucher.expiryDate).toLocaleDateString()}</div>
                      </div>

                      <div className="text-xs text-white/40 mb-3">
                        <div className="flex items-center gap-1">
                          <span>Recipient:</span>
                          <span className="truncate max-w-[200px]" title={voucher.recipient}>
                            {showSensitiveInfo ? voucher.recipient : `${voucher.recipient.slice(0, 8)}...${voucher.recipient.slice(-8)}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-xs text-white/40">Voucher Address:</div>
                        <div className="flex items-center gap-1">
                          <div className="text-xs truncate text-white/80 border border-white/10 rounded-md px-2 py-1 bg-white/5 max-w-[120px]">
                            {voucher.voucherPublicKey.slice(0, 6)}...{voucher.voucherPublicKey.slice(-6)}
                          </div>
                          <AppButton
                            onClick={() => window.open(`https://solscan.io/token/${voucher.voucherPublicKey}?`, '_blank')}
                            variant="secondary"
                            className="text-xs px-1 py-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </AppButton>
                        </div>
                      </div>

                      {voucher.conditions && (
                        <div className="text-xs text-white/60 mb-3">
                          <span className="text-white/40">Conditions: </span>
                          {voucher.conditions}
                        </div>
                      )}


                      {/* Voucher Operations */}
                      <div className="flex flex-wrap gap-2">
                        {voucher.canRedeem && !voucher.isExpired && voucher.status === 'active' && (
                          <button
                            onClick={() => {
                              setModalVoucherId(voucher.id);
                              setModalType('redeem');
                              setShowModal(true);
                              setModalError(null);
                              // Set redeem amount after a small delay to ensure modal is rendered
                              setTimeout(() => {
                                setRedeemAmount((voucher.voucherData?.remainingWorth ?? voucher.value) ? (voucher.voucherData?.remainingWorth ?? voucher.value).toString() : '');
                              }, 100);
                            }}
                            disabled={operatingVoucherId === voucher.id}
                            className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded text-green-400 text-xs disabled:opacity-50"
                          >
                            Redeem
                          </button>
                        )}

                        {voucher.status === 'active' && (
                          <button
                            onClick={() => {
                              setModalVoucherId(voucher.id);
                              setModalType('cancel');
                              setShowModal(true);
                              setCancelReason('Voucher cancelled by creator'); // Set default reason
                              setModalError(null);
                            }}
                            disabled={operatingVoucherId === voucher.id}
                            className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded text-red-400 text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}


                        {(voucher.status === 'active' || voucher.isExpired) && (
                          <button
                            onClick={() => {
                              setModalVoucherId(voucher.id);
                              setModalType('extend');
                              setShowModal(true);
                              setNewExpiryDate('');
                              setModalError(null);
                            }}
                            disabled={operatingVoucherId === voucher.id}
                            className="px-3 py-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 rounded text-orange-400 text-xs disabled:opacity-50"
                          >
                            Extend Expiry
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
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
          )}
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

        {/* Modal */}
        {showModal && modalType && modalVoucherId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">
                  {modalType === 'redeem' && 'Confirm Voucher Redemption'}
                  {modalType === 'cancel' && 'Confirm Voucher Cancellation'}
                  {modalType === 'extend' && 'Extend Voucher Expiry'}
                </h3>
              </div>

              <div className="space-y-4">
                {modalType === 'redeem' && (
                  <>
                    <div className="text-center">
                      <div className="text-white/80 mb-4">
                        You're about to redeem{' '}
                        <span className="text-green-400 font-medium">
                          {collection?.vouchers.find(v => v.id === modalVoucherId)?.voucherType?.replace(/_/g, ' ').toLowerCase()}
                        </span>{' '}
                        voucher for{' '}
                        <span className="text-blue-400 font-medium break-all">
                          {collection?.vouchers.find(v => v.id === modalVoucherId)?.recipient}
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-white text-sm mb-2 block">Redemption Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={redeemAmount}
                        readOnly
                        placeholder="Redemption amount"
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm cursor-not-allowed"
                      />
                      <div className="text-xs text-white/60 mt-1">
                        Voucher value: {collection?.vouchers.find(v => v.id === modalVoucherId)?.value?.toLocaleString()} {collection?.vouchers.find(v => v.id === modalVoucherId)?.symbol || 'USDC'}
                      </div>
                    </div>
                  </>
                )}

                {modalType === 'cancel' && (
                  <>
                    <div className="text-center">
                      <div className="text-white/80 mb-4">
                        You're about to cancel the{' '}
                        <span className="text-red-400 font-medium">
                          {collection?.vouchers.find(v => v.id === modalVoucherId)?.voucherType?.replace(/_/g, ' ').toLowerCase()}
                        </span>{' '}
                        voucher for{' '}
                        <span className="text-blue-400 font-medium">
                          {collection?.vouchers.find(v => v.id === modalVoucherId)?.recipient}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {modalType === 'extend' && (
                  <>
                    <div>
                      <Label className="text-white text-sm mb-2 block">New Expiry Date</Label>
                      <Input
                        type="date"
                        value={newExpiryDate}
                        onChange={(e) => setNewExpiryDate(e.target.value)}
                        className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                      />
                    </div>
                  </>
                )}


                {/* Modal Error Display */}
                {modalError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{modalError}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <AppButton
                    onClick={() => {
                      setShowModal(false);
                      setModalType(null);
                      setModalVoucherId(null);
                      setRedeemAmount('');
                      setCancelReason('');
                      setNewExpiryDate('');
                      setModalError(null);
                    }}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    onClick={() => {
                      if (modalType === 'redeem') {
                        handleRedeemVoucher(modalVoucherId);
                      } else if (modalType === 'cancel') {
                        handleCancelVoucher(modalVoucherId);
                      } else if (modalType === 'extend') {
                        handleExtendExpiry(modalVoucherId);
                      }
                    }}
                    disabled={
                      (modalType === 'extend' && !newExpiryDate) ||
                      (modalType === 'redeem' && (!redeemAmount || parseFloat(redeemAmount) <= 0)) ||
                      operationLoading
                    }
                    className="flex-1"
                  >
                    {operationLoading ? (
                      <VerxioLoaderWhiteSmall size="sm" />
                    ) : (
                      <>
                        {modalType === 'redeem' && 'Confirm Redeem'}
                        {modalType === 'cancel' && 'Confirm Cancel'}
                        {modalType === 'extend' && 'Extend Expiry'}
                      </>
                    )}
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Reward Link Modal */}
        {showDuplicateForm && selectedRewardToDuplicate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">Duplicate Reward Link</h3>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-white text-sm mb-2">Duplicating:</div>
                  <div className="text-white font-medium">{selectedRewardToDuplicate.voucherType}</div>
                  <div className="text-white/60 text-xs">Value: {selectedRewardToDuplicate.voucherWorth?.toLocaleString()} {selectedRewardToDuplicate.symbol}</div>
                </div>

                <div>
                  <Label className="text-white text-sm mb-1 block">Quantity</Label>
                  <Input
                    type="number"
                    value={duplicateQuantity}
                    onChange={(e) => setDuplicateQuantity(e.target.value)}
                    placeholder="1"
                    min="1"
                    max="50"
                    className="bg-black/20 border-white/20 text-white placeholder:text-white/40 text-sm"
                  />
                  <div className="text-xs text-white/60 mt-1">
                    Create multiple copies of this reward link (max 50)
                  </div>
                </div>

                {/* Duplicate Error Display */}
                {rewardError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm font-medium">{rewardError}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <AppButton
                    onClick={() => {
                      setShowDuplicateForm(false);
                      setSelectedRewardToDuplicate(null);
                      setRewardError(null);
                    }}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    onClick={handleDuplicateRewardLink}
                    disabled={isDuplicating || !duplicateQuantity}
                    className="flex-1"
                  >
                    {isDuplicating ? (
                      <VerxioLoaderWhiteSmall size="sm" />
                    ) : (
                      <>
                        <Link className="w-4 h-4 mr-2" />
                        Duplicate {parseInt(duplicateQuantity) > 1 ? `${duplicateQuantity} Links` : 'Link'}
                      </>
                    )}
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {showSuccessScreen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 border border-white/20 rounded-lg p-8 w-full max-w-md mx-auto text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-white font-semibold text-xl mb-2">Success!</h3>
              <p className="text-white/80 mb-6">{successMessage}</p>
              <AppButton
                onClick={() => {
                  setShowSuccessScreen(false);
                  setSuccessMessage('');
                }}
                className="w-full"
              >
                Continue
              </AppButton>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
