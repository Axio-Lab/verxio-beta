'use server';

import { getLoyaltyProgramByAddress, checkUserLoyaltyProgramMembership } from '@/app/actions/loyalty';
import { saveLoyaltyPass } from '@/app/actions/loyalty-pass';
import { initializeVerxio, issueNewLoyaltyPass, giftPoints } from '@/app/actions/verxio';
import { getVerxioConfig } from '@/app/actions/loyalty';
import { createSignerFromKeypair, generateSigner, publicKey } from '@metaplex-foundation/umi';
import { convertSecretKeyToKeypair, uint8ArrayToBase58String } from '@/lib/utils';
import { getCollectionAuthoritySecretKey } from '@/app/actions/loyalty';

export interface LoyaltyPurchaseResult {
  success: boolean;
  message: string;
  passAddress?: string;
  pointsAwarded?: number;
  error?: string;
}

export interface LoyaltyMembershipResult {
  success: boolean;
  isMember: boolean;
  membershipData?: {
    assetId: string;
    xp: number;
    currentTier: string;
    rewards: string[];
    loyaltyProgram?: {
      address: string;
      name: string;
      tiers: Array<{
        name: string;
        xpRequired: number;
        rewards: string[];
      }>;
      pointsPerAction: Record<string, number>;
    };
  };
  error?: string;
}

export interface LoyaltyProgramDetailsResult {
  success: boolean;
  data?: {
    name: string;
    pointsPerAction: Record<string, number>;
  };
  error?: string;
}

/**
 * Check if a user has a loyalty pass for a specific program
 */
export const checkUserLoyaltyMembership = async (
  userWallet: string,
  loyaltyProgramAddress: string
): Promise<LoyaltyMembershipResult> => {
  try {
    const result = await checkUserLoyaltyProgramMembership(userWallet, loyaltyProgramAddress);
    
    if (result.success) {
      return {
        success: true,
        isMember: result.isMember || false,
        membershipData: result.membershipData ? {
          assetId: result.membershipData.assetId || '',
          xp: result.membershipData.xp || 0,
          currentTier: result.membershipData.currentTier || '',
          rewards: result.membershipData.rewards || [],
          loyaltyProgram: result.membershipData.loyaltyProgram ? {
            address: result.membershipData.loyaltyProgram.address || '',
            name: result.membershipData.loyaltyProgram.name || '',
            tiers: result.membershipData.loyaltyProgram.tiers || [],
            pointsPerAction: result.membershipData.loyaltyProgram.pointsPerAction || {}
          } : undefined
        } : undefined
      };
    } else {
      return {
        success: false,
        isMember: false,
        error: result.error || 'Failed to check membership'
      };
    }
  } catch (error) {
    console.error('Error checking loyalty membership:', error);
    return {
      success: false,
      isMember: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Fetch loyalty program details by address
 */
export const fetchLoyaltyProgramDetails = async (
  loyaltyProgramAddress: string
): Promise<LoyaltyProgramDetailsResult> => {
  try {
    const result = await getLoyaltyProgramByAddress(loyaltyProgramAddress);
    
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          name: result.data.name!,
          pointsPerAction: result.data.pointsPerAction || {}
        }
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to fetch program details'
      };
    }
  } catch (error) {
    console.error('Error fetching loyalty program details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Award loyalty points after a successful purchase
 * If customer is not a member, issues a new loyalty pass first
 */
export const awardLoyaltyPointsAfterPurchase = async (
  userWallet: string,
  loyaltyProgramAddress: string,
  purchaseAmount: number
): Promise<LoyaltyPurchaseResult> => {
  try {
    // Get loyalty program details to determine points per purchase
    const programResult = await getLoyaltyProgramByAddress(loyaltyProgramAddress);
    if (!programResult.success || !programResult.data) {
      return {
        success: false,
        message: 'Failed to fetch loyalty program details',
        error: 'Program not found'
      };
    }

    const programDetails = programResult.data;
    const pointsPerPurchase = programDetails.pointsPerAction.purchase || 0;

    if (pointsPerPurchase <= 0) {
      return {
        success: false,
        message: 'No points configured for purchases in this loyalty program',
        error: 'No purchase points configured'
      };
    }

    // Get Verxio configuration
    const config = await getVerxioConfig();
    if (!config.rpcEndpoint || !config.privateKey) {
      return {
        success: false,
        message: 'Failed to get Verxio configuration',
        error: 'Configuration error'
      };
    }

    // Initialize Verxio
    const initResult = await initializeVerxio(userWallet, config.rpcEndpoint, config.privateKey);
    if (!initResult.success || !initResult.context) {
      return {
        success: false,
        message: 'Failed to initialize Verxio program',
        error: 'Initialization failed'
      };
    }

    const context = initResult.context;
    context.collectionAddress = publicKey(loyaltyProgramAddress);

    // Get collection authority
    const authorityResult = await getCollectionAuthoritySecretKey(loyaltyProgramAddress);
    if (!authorityResult.success || !authorityResult.authoritySecretKey) {
      return {
        success: false,
        message: 'Failed to get collection authority',
        error: authorityResult.error || 'Authority not found'
      };
    }

    const authoritySecretKey = authorityResult.authoritySecretKey;

    // Check if user already has a loyalty pass
    const membershipResult = await checkUserLoyaltyProgramMembership(userWallet, loyaltyProgramAddress);
    
    if (membershipResult.success && membershipResult.isMember && membershipResult.membershipData?.assetId) {
      // User is already a member, award points directly
      return await awardPointsToExistingMember(
        context,
        membershipResult.membershipData.assetId,
        pointsPerPurchase,
        authoritySecretKey,
        'Purchase reward'
      );
    } else {
      // User is not a member, issue new pass and award points
      return await issuePassAndAwardPoints(
        context,
        userWallet,
        loyaltyProgramAddress,
        programDetails,
        pointsPerPurchase,
        authoritySecretKey,
        purchaseAmount
      );
    }

  } catch (error) {
    console.error('Error awarding loyalty points:', error);
    return {
      success: false,
      message: 'Failed to award loyalty points',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};


/**
 * Award points to an existing loyalty pass member
 */
async function awardPointsToExistingMember(
  context: any,
  assetId: string,
  points: number,
  authoritySecretKey: string,
  reason: string
): Promise<LoyaltyPurchaseResult> {
  try {
    // Create signer for gifting points
    const giftSigner = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
    
    const giftParams = {
      passAddress: assetId,
      pointsToGift: points,
      signer: giftSigner,
      action: reason
    };

    await giftPoints(context, giftParams);

    return {
      success: true,
      message: `Awarded ${points} points for your purchase!`,
      pointsAwarded: points
    };

  } catch (error) {
    console.error('Error awarding points to existing member:', error);
    return {
      success: false,
      message: 'Failed to award points',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Issue new loyalty pass and award initial points
 */
async function issuePassAndAwardPoints(
  context: any,
  userWallet: string,
  loyaltyProgramAddress: string,
  programDetails: any,
  points: number,
  authoritySecretKey: string,
  purchaseAmount: number
): Promise<LoyaltyPurchaseResult> {
  try {
    // Create asset keypair using authority secret key
    const assetKeypair = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
    
    const issueParams = {
      collectionAddress: loyaltyProgramAddress,
      recipient: userWallet,
      passName: `${programDetails.name} Pass`,
      passMetadataUri: programDetails.uri,
      assetSigner: generateSigner(context.umi),
      updateAuthority: assetKeypair,
      organizationName: programDetails.name
    };

    // Issue new loyalty pass
    const result = await issueNewLoyaltyPass(context, issueParams);
    
    // Save to database
    const passData = {
      programAddress: loyaltyProgramAddress,
      recipient: userWallet,
      passPublicKey: result.asset.publicKey,
      passPrivateKey: uint8ArrayToBase58String(result.asset.secretKey),
      signature: result.signature
    };
    
    const saveResult = await saveLoyaltyPass(passData);
    if (!saveResult.success) {
      console.warn('Failed to save loyalty pass to database:', saveResult.error);
    }


    // Wait a bit for the asset to be available on the blockchain
    await new Promise(resolve => setTimeout(resolve, 20000));
    // Award initial points for the purchase
    const giftSigner = createSignerFromKeypair(context.umi, convertSecretKeyToKeypair(authoritySecretKey));
    
    const giftParams = {
      passAddress: result.asset.publicKey,
      pointsToGift: points,
      signer: giftSigner,
      action: `Welcome bonus + Purchase reward (${purchaseAmount} USDC)`
    };

    // Try to gift points with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await giftPoints(context, giftParams);
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error; // Re-throw if all retries failed
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return {
      success: true,
      message: `Welcome! Issued loyalty pass and awarded ${points} points for your purchase!`,
      passAddress: result.asset.publicKey,
      pointsAwarded: points
    };

  } catch (error) {
    console.error('Error issuing pass and awarding points:', error);
    return {
      success: false,
      message: 'Failed to issue loyalty pass',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
