'use server'

import { prisma } from '@/lib/prisma'
import { storeMetadata } from '@/app/actions/metadata'
import { getVoucherCollectionDetails } from '@/lib/voucher/getVoucherCollectionDetails'
import { mintVoucher } from './voucher'
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from './verxio-credit'

export interface CreateRewardLinkData {
  creatorAddress: string
  collectionId: string
  voucherType: string
  name?: string
  description?: string
  value?: number
  maxUses?: number
  expiryDate?: Date
  transferable?: boolean
  conditions?: string
  imageUri?: string
  metadataUri?: string
}

export const createRewardLink = async (data: CreateRewardLinkData) => {
  try {
    const {
      creatorAddress,
      collectionId,
      voucherType,
      name,
      description,
      value,
      maxUses,
      expiryDate,
      transferable = false,
      conditions,
      imageUri,
      metadataUri
    } = data

    // Check if user has sufficient Verxio credits (minimum 1000 required for creating reward links)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    if (!creditCheck.success || (creditCheck.balance || 0) < 1000) {
      return {
        success: false,
          error: `Insufficient Verxio credits. You need at least 1000 credits to create reward links.`
        }
    }

    // Ensure collection exists and belongs to creator
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Fetch collection details from blockchain for name/description
    let collectionName: string | null = null
    let collectionDescription: string | null = null
    if (collection.collectionPublicKey) {
      try {
        const details = await getVoucherCollectionDetails(collection.collectionPublicKey)
        if (details.success && details.data) {
          collectionName = details.data.name || null
          collectionDescription = details.data.description || null
        }
      } catch (e) {
        // Ignore and fallback below
      }
    }

    // Build metadata if not provided
    let finalMetadataUri = metadataUri || null
    if (!finalMetadataUri && imageUri) {
      const metadata = {
        name: name || collectionName || 'Reward Voucher',
        symbol: 'VERXIO-VOUCHER',
        description: `Voucher from ${collection.collectionName}`,
        image: imageUri,
        properties: {
          files: imageUri
            ? [{ uri: imageUri, type: 'image/png' }]
            : [],
          category: 'image',
          creators: [{ address: creatorAddress, share: 100 }]
        },
        attributes: [
          { trait_type: 'Voucher Type', value: voucherType },
          ...(typeof maxUses === 'number' ? [{ trait_type: 'Max Uses', value: String(maxUses) }] : []),
          ...(expiryDate ? [{ trait_type: 'Expiry Date', value: expiryDate.toISOString() }] : []),
          { trait_type: 'Status', value: 'Active' },
          { trait_type: 'Merchant ID',value: creatorAddress },
          ...(conditions ? [{ trait_type: 'Conditions', value: conditions }] : [])
        ]
      }
      const stored = await storeMetadata(metadata as any)
      finalMetadataUri = stored
    }

    // Create a slug (simple cuid)
    const slug = `${Math.random().toString(36).slice(2, 12)}`

    const created = await prisma.rewardLink.create({
      data: {
        creator: creatorAddress,
        collectionId,
        slug,
        voucherType,
        name: (name || collectionName) || null,
        description: (description || collectionDescription) || null,
        value: value ?? null,
        maxUses: typeof maxUses === 'number' ? maxUses : null,
        expiryDate: expiryDate || null,
        transferable,
        conditions: conditions || null,
        imageUri: imageUri || null,
        metadataUri: finalMetadataUri || null
      }
    })

    // Deduct 500 Verxio credits for creating reward link
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: 500,
      assetAddress: collection.collectionPublicKey,
      assetOwner: creatorAddress,
      action: 'REVOKE'
    })

    if (!deductionResult.success) {
      console.error('Failed to deduct Verxio credits:', deductionResult.error)
    }

    return { success: true, reward: created }
  } catch (error: any) {
    console.error('Error creating reward link:', error)
    return { success: false, error: error.message || 'Failed to create reward link' }
  }
}

export const getRewardLink = async (slugOrId: string) => {
  try {
    const reward = await prisma.rewardLink.findFirst({
      where: {
        OR: [{ id: slugOrId }, { slug: slugOrId }]
      }
    })
    if (!reward) return { success: false, error: 'Reward not found' }
    return { success: true, reward }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch reward' }
  }
}

export const claimRewardLink = async (
  slugOrId: string,
  recipient: string,
  creatorAddress: string
): Promise<
  | { success: true; voucherAddress: string; voucherId: string }
  | { success: false; error: string }
> => {
  try {
    const rewardRes = await getRewardLink(slugOrId)
    if (!rewardRes.success || !rewardRes.reward) return { success: false, error: rewardRes.error || 'Reward not found' }
    const reward = rewardRes.reward as any

    // Check if already claimed
    if (reward.status === 'claimed') {
      return { success: false, error: 'This reward has already been claimed.' }
    }

    // Prepare mint data exactly like mintVoucher expects
    const mintData = {
      collectionId: reward.collectionId,
      recipient,
      voucherName: reward.name,
      voucherType: reward.voucherType,
      value: reward.value,
      description: reward.description,
      expiryDate: reward.expiryDate,
      maxUses: reward.maxUses,
      transferable: !!reward.transferable,
      merchantId: creatorAddress,
      conditions: reward.conditions,
      voucherMetadataUri: reward.metadataUri
    }

    // If custom reward, replace type with custom value (label sent to chain)
    if (mintData.voucherType === 'CUSTOM_REWARD' && reward.customVoucherType) {
      mintData.voucherType = reward.customVoucherType
    }

    const minted = await mintVoucher(mintData, creatorAddress)
    if (!minted.success || !minted.voucher) {
      return { success: false, error: minted.error || 'Failed to mint voucher' }
    }

    // Mark reward link as claimed and store voucher address
    await prisma.rewardLink.update({
      where: { id: reward.id },
      data: { 
        status: 'claimed',
        voucherAddress: minted.voucher.voucherPublicKey
      }
    })

    // Bubble up identifiers saved by mintVoucher (voucher persisted in DB there)
    return {
      success: true,
      voucherAddress: minted.voucher.voucherPublicKey,
      voucherId: minted.voucher.id
    }
  } catch (error: any) {
    console.error('Error claiming reward link:', error)
    return { success: false, error: error.message || 'Failed to claim reward' }
  }
}

export const getRewardLinksForCollection = async (
  collectionId: string,
  creatorAddress: string
) => {
  try {
    const links = await prisma.rewardLink.findMany({
      where: { collectionId, creator: creatorAddress },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, links }
  } catch (error: any) {
    console.error('Error fetching reward links:', error)
    return { success: false, error: error.message || 'Failed to fetch reward links' }
  }
}

export interface BulkCreateRewardLinksData {
  creatorAddress: string
  collectionId: string
  voucherType: string
  name?: string
  description?: string
  value?: number
  maxUses?: number
  expiryDate?: Date
  transferable?: boolean
  conditions?: string
  imageUri?: string
  metadataUri?: string
  quantity: number
}

export const bulkCreateRewardLinks = async (data: BulkCreateRewardLinksData) => {
  try {
    const {
      creatorAddress,
      collectionId,
      voucherType,
      name,
      description,
      value,
      maxUses,
      expiryDate,
      transferable = false,
      conditions,
      imageUri,
      metadataUri,
      quantity
    } = data

    // Check if user has sufficient Verxio credits (minimum 1000 required for creating reward links)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    const totalCreditsNeeded = quantity * 500 // 500 credits per reward link
    if (!creditCheck.success || (creditCheck.balance || 0) < totalCreditsNeeded) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least ${totalCreditsNeeded} credits to create ${quantity} reward links.`
      }
    }

    // Ensure collection exists and belongs to creator
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Fetch collection details from blockchain for name/description
    let collectionName: string | null = null
    let collectionDescription: string | null = null
    if (collection.collectionPublicKey) {
      try {
        const details = await getVoucherCollectionDetails(collection.collectionPublicKey)
        if (details.success && details.data) {
          collectionName = details.data.name || null
          collectionDescription = details.data.description || null
        }
      } catch (e) {
        // Ignore and fallback below
      }
    }

    // Build metadata if not provided
    let finalMetadataUri = metadataUri || null
    if (!finalMetadataUri && imageUri) {
      const metadata = {
        name: name || collectionName || 'Reward Voucher',
        symbol: 'VERXIO-VOUCHER',
        description: `Voucher from ${collection.collectionName}`,
        image: imageUri,
        properties: {
          files: imageUri
            ? [{ uri: imageUri, type: 'image/png' }]
            : [],
          category: 'image',
          creators: [{ address: creatorAddress, share: 100 }]
        },
        attributes: [
          { trait_type: 'Voucher Type', value: voucherType },
          ...(typeof maxUses === 'number' ? [{ trait_type: 'Max Uses', value: String(maxUses) }] : []),
          ...(expiryDate ? [{ trait_type: 'Expiry Date', value: expiryDate.toISOString() }] : []),
          { trait_type: 'Status', value: 'Active' },
          { trait_type: 'Merchant ID', value: creatorAddress },
          ...(conditions ? [{ trait_type: 'Conditions', value: conditions }] : [])
        ]
      }
      const stored = await storeMetadata(metadata as any)
      finalMetadataUri = stored
    }

    // Create multiple reward links in a transaction
    const createdRewards = []
    for (let i = 0; i < quantity; i++) {
      // Create a unique slug for each reward link
      const slug = `${Math.random().toString(36).slice(2, 12)}${i}`

      const created = await prisma.rewardLink.create({
        data: {
          creator: creatorAddress,
          collectionId,
          slug,
          voucherType,
          name: (name || collectionName) || null,
          description: (description || collectionDescription) || null,
          value: value ?? null,
          maxUses: typeof maxUses === 'number' ? maxUses : null,
          expiryDate: expiryDate || null,
          transferable,
          conditions: conditions || null,
          imageUri: imageUri || null,
          metadataUri: finalMetadataUri || null
        }
      })

      createdRewards.push(created)

      // Deduct 500 Verxio credits for each reward link created
      const deductionResult = await awardOrRevokeLoyaltyPoints({
        creatorAddress,
        points: 500,
        assetAddress: collection.collectionPublicKey,
        assetOwner: creatorAddress,
        action: 'REVOKE'
      })

      if (!deductionResult.success) {
        console.error('Failed to deduct Verxio credits for reward link:', deductionResult.error)
      }
    }

    return { success: true, rewards: createdRewards }
  } catch (error: any) {
    console.error('Error bulk creating reward links:', error)
    return { success: false, error: error.message || 'Failed to bulk create reward links' }
  }
}

export interface DuplicateRewardLinksData {
  creatorAddress: string
  collectionId: string
  originalRewardId: string
  quantity: number
}

export const duplicateRewardLinks = async (data: DuplicateRewardLinksData) => {
  try {
    const { creatorAddress, collectionId, originalRewardId, quantity } = data

    // Check if user has sufficient Verxio credits
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    const totalCreditsNeeded = quantity * 500 // 500 credits per reward link
    if (!creditCheck.success || (creditCheck.balance || 0) < totalCreditsNeeded) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least ${totalCreditsNeeded} credits to duplicate ${quantity} reward links.`
      }
    }

    // Get the original reward link
    const originalReward = await prisma.rewardLink.findFirst({
      where: { 
        id: originalRewardId, 
        creator: creatorAddress,
        collectionId 
      }
    })

    if (!originalReward) {
      return { success: false, error: 'Original reward link not found' }
    }

    // Ensure collection exists
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Create multiple duplicate reward links
    const duplicatedRewards = []
    for (let i = 0; i < quantity; i++) {
      // Create a unique slug for each duplicate
      const slug = `${Math.random().toString(36).slice(2, 12)}${i}`

      const duplicated = await prisma.rewardLink.create({
        data: {
          creator: creatorAddress,
          collectionId,
          slug,
          voucherType: originalReward.voucherType,
          name: originalReward.name,
          description: originalReward.description,
          value: originalReward.value,
          maxUses: originalReward.maxUses,
          expiryDate: originalReward.expiryDate,
          transferable: originalReward.transferable,
          conditions: originalReward.conditions,
          imageUri: originalReward.imageUri,
          metadataUri: originalReward.metadataUri
        }
      })

      duplicatedRewards.push(duplicated)

      // Deduct 500 Verxio credits for each duplicate created
      const deductionResult = await awardOrRevokeLoyaltyPoints({
        creatorAddress,
        points: 500,
        assetAddress: collection.collectionPublicKey,
        assetOwner: creatorAddress,
        action: 'REVOKE'
      })

      if (!deductionResult.success) {
        console.error('Failed to deduct Verxio credits for duplicate:', deductionResult.error)
      }
    }

    return { success: true, rewards: duplicatedRewards }
  } catch (error: any) {
    console.error('Error duplicating reward links:', error)
    return { success: false, error: error.message || 'Failed to duplicate reward links' }
  }
}


