'use server'

import { prisma } from '@/lib/prisma'
import { createSignerFromKeypair, generateSigner } from '@metaplex-foundation/umi'
import { publicKey } from '@metaplex-foundation/umi'
import { convertSecretKeyToKeypair, uint8ArrayToBase58String } from '@/lib/utils'
import { 
  initializeVerxio, 
  createVoucherCollectionCore,
  mintVoucherCore,
  validateVoucherCore,
  redeemVoucherCore,
  cancelVoucherCore,
  extendVoucherExpiryCore,
  getUserVouchersCore
} from './verxio'
import { getVerxioConfig } from './loyalty'
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from './verxio-credit'
import { getVoucherCollectionDetails } from '@/lib/voucher/getVoucherCollectionDetails'
import { getVoucherDetails } from '@/lib/voucher/getVoucherDetails'
import { getUserByWallet } from './user'

// Create Voucher Collection
export interface CreateVoucherCollectionData {
  creatorAddress: string
  voucherCollectionName: string
  merchantName: string
  merchantAddress: string
  contactInfo?: string
  voucherTypes: string[]
  description?: string
  imageUri?: string
  metadataUri?: string
}

export interface CreateVoucherCollectionResult {
  success: boolean
  collection?: {
    id: string
    collectionPublicKey: string
    signature: string
  }
  error?: string
}

export const createVoucherCollection = async (data: CreateVoucherCollectionData): Promise<CreateVoucherCollectionResult> => {
  try {
    const { creatorAddress, voucherCollectionName, merchantName, merchantAddress, contactInfo, voucherTypes, description, imageUri, metadataUri } = data

    // Check if user has sufficient Verxio credits (minimum 5000 required)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    if (!creditCheck.success || (creditCheck.balance || 0) < 5000) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least 5000 credits to create a voucher collection. Current balance: ${creditCheck.balance || 0} credits.`
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Create voucher collection
    const createResult = await createVoucherCollectionCore(initializeContext.context, {
      voucherCollectionName,
      programAuthority: publicKey(creatorAddress),
      updateAuthority: generateSigner(initializeContext.context.umi),
      metadata: {
        merchantName,
        merchantAddress,
        contactInfo,
        voucherTypes
      },
      description,
      metadataUri: metadataUri || undefined
    })

    if (!createResult.success || !createResult.result) {
      return {
        success: false,
        error: createResult.error || 'Failed to create voucher collection'
      }
    }

    const { collection, signature, updateAuthority } = createResult.result

    // Save to database
    const savedCollection = await prisma.voucherCollection.create({
      data: {
        creator: creatorAddress,
        collectionPublicKey: collection.publicKey,
        collectionSecretKey: uint8ArrayToBase58String(collection.secretKey),
        signature,
        authorityPublicKey: updateAuthority?.publicKey || collection.publicKey,
        authoritySecretKey: updateAuthority ? uint8ArrayToBase58String(updateAuthority.secretKey) : uint8ArrayToBase58String(collection.secretKey)
      }
    })

    // Deduct 1000 Verxio credits for collection creation
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: 1000,
      assetAddress: collection.publicKey,
      assetOwner: creatorAddress,
      action: 'REVOKE'
    })

    if (!deductionResult.success) {
      console.error('Failed to deduct Verxio credits:', deductionResult.error)
    }

    return {
      success: true,
      collection: {
        id: savedCollection.id,
        collectionPublicKey: collection.publicKey,
        signature
      }
    }
  } catch (error: any) {
    console.error('Error creating voucher collection:', error)
    return {
      success: false,
      error: error.message || 'Failed to create voucher collection'
    }
  }
}

// Get User Voucher Collections
export const getUserVoucherCollections = async (creatorAddress: string, page: number = 1, limit: number = 10) => {
  try {
    const skip = (page - 1) * limit;
    const take = limit;

    const [collections, totalCount, worthAgg] = await Promise.all([
      prisma.voucherCollection.findMany({
        where: {
          creator: creatorAddress
        },
        include: {
          vouchers: {
            select: {
              id: true,
              voucherPublicKey: true,
              recipient: true,
              signature: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take
      }),
      prisma.voucherCollection.count({
        where: {
          creator: creatorAddress
        }
      }),
      prisma.voucher.aggregate({
        _sum: { worth: true },
        where: { collection: { creator: creatorAddress } }
      })
    ])

    // Fetch collection details from blockchain for each collection
    const collectionsWithDetails = await Promise.all(
      collections.map(async (collection: any) => {
        try {
          const details = await getVoucherCollectionDetails(collection.collectionPublicKey);
          return {
            ...collection,
            collectionName: details.success ? details.data?.name : 'Unknown Collection',
            collectionImage: details.success ? details.data?.image : null,
            voucherStats: details.success ? details.data?.voucherStats : null
          };
        } catch (error) {
          console.error('Error fetching collection details:', error);
          return {
            ...collection,
            collectionName: 'Unknown Collection',
            collectionImage: null,
            voucherStats: null
          };
        }
      })
    );

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      collections: collectionsWithDetails,
      pagination: {
        currentPage: page,
        totalPages,
        total: totalCount,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      totals: {
        totalWorth: worthAgg._sum.worth || 0
      }
    }
  } catch (error: any) {
    console.error('Error fetching user voucher collections:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher collections'
    }
  }
}

// Get Voucher Collection by ID
export const getVoucherCollectionById = async (collectionId: string, creatorAddress: string) => {
  try {
    const collection = await prisma.voucherCollection.findFirst({
      where: {
        id: collectionId,
        creator: creatorAddress
      },
      include: {
        vouchers: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!collection) {
      return {
        success: false,
        error: 'Voucher collection not found'
      }
    }

    return {
      success: true,
      collection
    }
  } catch (error: any) {
    console.error('Error fetching voucher collection:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher collection'
    }
  }
}

// Get Voucher Authority Secret Key
export const getVoucherAuthoritySecretKey = async (collectionAddress: string) => {
  try {
    const voucherCollection = await prisma.voucherCollection.findFirst({
      where: {
        collectionPublicKey: collectionAddress
      },
      select: {
        authoritySecretKey: true,
        authorityPublicKey: true
      }
    })

    if (!voucherCollection) {
      return { success: false, error: 'Voucher collection not found for this collection address' }
    }

    return { 
      success: true, 
      authoritySecretKey: voucherCollection.authoritySecretKey,
      authorityPublicKey: voucherCollection.authorityPublicKey
    }
  } catch (error) {
    console.error('Error fetching voucher collection authority secret key:', error)
    return { success: false, error: 'Failed to fetch authority secret key' }
  }
}

// Get Voucher Secret Key
export const getVoucherSecretKey = async (voucherId: string, creatorAddress: string) => {
  try {
    const voucher = await prisma.voucher.findFirst({
      where: {
        id: voucherId,
        collection: {
          creator: creatorAddress
        }
      },
      select: {
        voucherPrivateKey: true,
        voucherPublicKey: true
      }
    })

    if (!voucher) {
      return { success: false, error: 'Voucher not found' }
    }

    return { 
      success: true, 
      voucherSecretKey: voucher.voucherPrivateKey,
      voucherPublicKey: voucher.voucherPublicKey
    }
  } catch (error) {
    console.error('Error fetching voucher secret key:', error)
    return { success: false, error: 'Failed to fetch voucher secret key' }
  }
}

// Get Voucher Collection by Public Key
export const getVoucherCollectionByPublicKey = async (collectionPublicKey: string, creatorAddress: string) => {
  try {
    const collection = await prisma.voucherCollection.findFirst({
      where: {
        collectionPublicKey: collectionPublicKey,
        creator: creatorAddress
      },
      include: {
        vouchers: {
          select: {
            id: true,
            voucherPublicKey: true,
            recipient: true,
            signature: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!collection) {
      return {
        success: false,
        error: 'Voucher collection not found'
      }
    }

    // Fetch collection details from blockchain
    const details = await getVoucherCollectionDetails(collectionPublicKey);
    
    // Fetch detailed voucher information for each voucher
    const vouchersWithDetails = await Promise.all(
      collection.vouchers.map(async (voucher: any) => {
        try {
          const [voucherDetails, userResult] = await Promise.all([
            getVoucherDetails(voucher.voucherPublicKey),
            getUserByWallet(voucher.recipient)
          ]);
          
          // Get email address or fallback to wallet address
          const recipientEmail = userResult.success && userResult.user?.email 
            ? userResult.user.email 
            : userResult.success && userResult.user?.name
            ? userResult.user.name
            : voucher.recipient;

          return {
            ...voucher,
            recipient: recipientEmail,
            voucherName: voucherDetails.success ? voucherDetails.data?.name : 'Unknown Voucher',
            voucherType: voucherDetails.success ? voucherDetails.data?.attributes?.voucherType : 'Unknown',
            value: voucherDetails.success ? voucherDetails.data?.voucherData?.value : 0,
            description: voucherDetails.success ? voucherDetails.data?.description : '',
            expiryDate: voucherDetails.success ? new Date(voucherDetails.data?.voucherData?.expiryDate || 0).toISOString() : '',
            maxUses: voucherDetails.success ? voucherDetails.data?.voucherData?.maxUses : 1,
            currentUses: voucherDetails.success ? voucherDetails.data?.voucherData?.currentUses : 0,
            transferable: voucherDetails.success ? voucherDetails.data?.voucherData?.transferable : true,
            status: voucherDetails.success ? voucherDetails.data?.voucherData?.status : 'active',
            merchantId: voucherDetails.success ? voucherDetails.data?.voucherData?.merchantId : '',
            conditions: voucherDetails.success ? voucherDetails.data?.attributes?.conditions : '',
            image: voucherDetails.success ? voucherDetails.data?.image : null,
            isExpired: voucherDetails.success ? (voucherDetails.data?.voucherData?.expiryDate || 0) < Date.now() : false,
            canRedeem: voucherDetails.success ? (voucherDetails.data?.voucherData?.currentUses || 0) < (voucherDetails.data?.voucherData?.maxUses || 1) : false
          };
        } catch (error) {
          console.error('Error fetching voucher details:', error);
          return {
            ...voucher,
            voucherName: 'Unknown Voucher',
            voucherType: 'Unknown',
            value: 0,
            description: '',
            expiryDate: '',
            maxUses: 1,
            currentUses: 0,
            transferable: true,
            status: 'active',
            merchantId: '',
            conditions: '',
            image: null,
            isExpired: false,
            canRedeem: false
          };
        }
      })
    );
    
    return {
      success: true,
      collection: {
        ...collection,
        collectionName: details.success ? details.data?.name : 'Unknown Collection',
        collectionImage: details.success ? details.data?.image : null,
        voucherStats: details.success ? details.data?.voucherStats : null,
        blockchainDetails: details.success ? details.data : null,
        vouchers: vouchersWithDetails
      }
    }
  } catch (error: any) {
    console.error('Error fetching voucher collection by public key:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch voucher collection'
    }
  }
}

// Mint Voucher
export interface MintVoucherData {
  collectionId: string
  recipient: string
  voucherName: string
  voucherType: 'PERCENTAGE_OFF' | 'FIXED_VERXIO_CREDITS' | 'FREE_ITEM' | 'BUY_ONE_GET_ONE' | 'CUSTOM_REWARD'
  value: number
  description: string
  expiryDate: Date
  maxUses: number
  transferable?: boolean
  merchantId: string
  conditions?: string
  voucherMetadataUri?: string
}

export interface MintVoucherResult {
  success: boolean
  voucher?: {
    id: string
    voucherPublicKey: string
    signature: string
  }
  error?: string
}

export const mintVoucher = async (data: MintVoucherData, creatorAddress: string): Promise<MintVoucherResult> => {
  try {
    const { collectionId, recipient, voucherName, voucherType, value, description, expiryDate, maxUses, transferable = true, merchantId, voucherMetadataUri } = data

    // Check if user has sufficient Verxio credits (minimum 1000 required for minting vouchers)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    if (!creditCheck.success || (creditCheck.balance || 0) < 1000) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least 1000 credits to mint vouchers`
      }
    }

    // Get collection and verify ownership
    const collection = await prisma.voucherCollection.findFirst({
      where: {
        id: collectionId,
        creator: creatorAddress
      }
    })

    if (!collection) {
      return {
        success: false,
        error: 'Voucher collection not found'
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Create asset keypair using authority secret key
    const voucherKeypair = createSignerFromKeypair(initializeContext.context.umi, convertSecretKeyToKeypair(collection.authoritySecretKey));

    // Create keypair for voucher
    const assetSigner = generateSigner(initializeContext.context.umi)
    const updateAuthority = voucherKeypair

    // Prepare mint data
    const mintConfig = {
      collectionAddress: publicKey(collection.collectionPublicKey),
      recipient: publicKey(recipient),
      voucherName: voucherName.substring(0, 32), // Limit voucher name length
      voucherData: {
        type: voucherType.toLowerCase().replace('_', '_') as any,
        value,
        description: description, // Limit description length
        expiryDate: expiryDate.getTime(),
        maxUses,
        transferable,
        merchantId: merchantId, // Limit merchant ID length
        conditions: [] // Remove conditions from voucherData to avoid type conflicts
      },
      assetSigner,
      updateAuthority,
      voucherMetadataUri: voucherMetadataUri
    };

    // Mint voucher
    const mintResult = await mintVoucherCore(initializeContext.context, mintConfig)
    if (!mintResult.success || !mintResult.result) {
      return {
        success: false,
        error: mintResult.error || 'Failed to mint voucher'
      }
    }

    const { asset, signature } = mintResult.result

    // Save to database (simplified schema - details come from blockchain)
    const savedVoucher = await prisma.voucher.create({
      data: {
        collectionId,
        recipient,
        voucherPublicKey: asset.publicKey,
        voucherPrivateKey: uint8ArrayToBase58String(asset.secretKey),
        signature,
        worth: value
      }
    })

    // Deduct 500 Verxio credits for voucher minting
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: 500,
      assetAddress: asset.publicKey,
      assetOwner: recipient,
      action: 'REVOKE'
    })

    if (!deductionResult.success) {
      console.error('Failed to deduct Verxio credits:', deductionResult.error)
    }

    return {
      success: true,
      voucher: {
        id: savedVoucher.id,
        voucherPublicKey: asset.publicKey,
        signature
      }
    }
  } catch (error: any) {
    console.error('Error minting voucher:', error)
    return {
      success: false,
      error: error.message || 'Failed to mint voucher'
    }
  }
}

// Validate Voucher
export const validateVoucher = async (voucherId: string, creatorAddress: string) => {
  try {
    const voucher = await prisma.voucher.findFirst({
      where: {
        id: voucherId,
        collection: {
          creator: creatorAddress
        }
      },
      select: {
        voucherPublicKey: true
      }
    })

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found'
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Validate voucher
    const validateResult = await validateVoucherCore(initializeContext.context, {
      voucherAddress: publicKey(voucher.voucherPublicKey)
    })

    return validateResult
  } catch (error: any) {
    console.error('Error validating voucher:', error)
    return {
      success: false,
      error: error.message || 'Failed to validate voucher'
    }
  }
}

// Redeem Voucher
export const redeemVoucher = async (voucherId: string, merchantId: string, creatorAddress: string, redemptionAmount?: number) => {
  try {
    // Get voucher details
    const voucher = await prisma.voucher.findFirst({
      where: {
        id: voucherId,
        collection: {
          creator: creatorAddress
        }
      },
      select: {
        voucherPublicKey: true,
        collection: {
          select: {
            collectionPublicKey: true
          }
        }
      }
    })

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found'
      }
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey)
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(initializeContext.context.umi, convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey))

    // Redeem voucher
    const redeemResult = await redeemVoucherCore(initializeContext.context, {
      voucherAddress: publicKey(voucher.voucherPublicKey),
      updateAuthority,
      merchantId,
      redemptionAmount,
      redemptionDetails: {
        transactionId: `redeem_${voucherId}_${Date.now()}`,
        totalAmount: redemptionAmount || 100 // Default redemption amount
      }
    })
 
    // Note: Voucher status and usage details are now managed on-chain

    return redeemResult
  } catch (error: any) {
    console.error('Error redeeming voucher:', error)
    return {
      success: false,
      error: error.message || 'Failed to redeem voucher'
    }
  }
}

// Cancel Voucher
export const cancelVoucher = async (voucherId: string, reason: string, creatorAddress: string) => {
  try {
    // Get voucher details
    const voucher = await prisma.voucher.findFirst({
      where: {
        id: voucherId,
        collection: {
          creator: creatorAddress
        }
      },
      select: {
        voucherPublicKey: true,
        collection: {
          select: {
            collectionPublicKey: true
          }
        }
      }
    })

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found'
      }
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey)
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(initializeContext.context.umi, convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey))

    // Cancel voucher
    const cancelResult = await cancelVoucherCore(initializeContext.context, {
      voucherAddress: publicKey(voucher.voucherPublicKey),
      updateAuthority,
      reason
    })

    // Note: Voucher status is now managed on-chain

    return cancelResult
  } catch (error: any) {
    console.error('Error cancelling voucher:', error)
    return {
      success: false,
      error: error.message || 'Failed to cancel voucher'
    }
  }
}

// Extend Voucher Expiry
export const extendVoucherExpiry = async (voucherId: string, newExpiryDate: Date, creatorAddress: string) => {
  try {
    // Get voucher details
    const voucher = await prisma.voucher.findFirst({
      where: {
        id: voucherId,
        collection: {
          creator: creatorAddress
        }
      },
      select: {
        voucherPublicKey: true,
        collection: {
          select: {
            collectionPublicKey: true
          }
        }
      }
    })

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found'
      }
    }

    // Get voucher collection authority secret key
    const collectionKeyResult = await getVoucherAuthoritySecretKey(voucher.collection.collectionPublicKey)
    if (!collectionKeyResult.success) {
      return {
        success: false,
        error: collectionKeyResult.error
      }
    }

    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(creatorAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Create update authority signer using collection's authority secret key
    const updateAuthority = createSignerFromKeypair(initializeContext.context.umi, convertSecretKeyToKeypair(collectionKeyResult.authoritySecretKey))

    // Extend voucher expiry
    const extendResult = await extendVoucherExpiryCore(initializeContext.context, {
      voucherAddress: publicKey(voucher.voucherPublicKey),
      updateAuthority,
      newExpiryDate: newExpiryDate.getTime() // Keep in milliseconds to match mint voucher logic
    })

    // Note: Voucher expiry is now managed on-chain

    return extendResult
  } catch (error: any) {
    console.error('Error extending voucher expiry:', error)
    return {
      success: false,
      error: error.message || 'Failed to extend voucher expiry'
    }
  }
}

// Get User Vouchers (for recipients) - using blockchain data
export const getUserVouchers = async (userAddress: string, collectionAddress?: string) => {
  try {
    // Get Verxio configuration
    const config = await getVerxioConfig()
    const initializeContext = await initializeVerxio(userAddress, config.rpcEndpoint, config.privateKey!)
    
    if (!initializeContext.success || !initializeContext.context) {
      return {
        success: false,
        error: `Initialization failed: ${initializeContext.error}`
      }
    }

    // Get vouchers from blockchain using core function
    const vouchersResult = await getUserVouchersCore(initializeContext.context, {
      userAddress: publicKey(userAddress),
      ...(collectionAddress && { collectionAddress: publicKey(collectionAddress) })
    })

    if (!vouchersResult.success || !vouchersResult.result) {
      return {
        success: false,
        error: vouchersResult.error || 'Failed to fetch user vouchers from blockchain'
      }
    }

    return {
      success: true,
      vouchers: vouchersResult.result.vouchers || []
    }
  } catch (error: any) {
    console.error('Error fetching user vouchers:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch user vouchers'
    }
  }
}
