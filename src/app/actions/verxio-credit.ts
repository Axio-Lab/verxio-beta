'use server';

import { prisma } from '@/lib/prisma';

export interface VerxioCreditResult {
  success: boolean;
  message?: string;
  error?: string;
  balance?: number;
  history?: any[];
}

export interface AwardPointsParams {
  creatorAddress: string;
  points: number;
  assetAddress: string;
  assetOwner: string;
  action: 'AWARD' | 'REVOKE'; // AWARD = add credits back, REVOKE = deduct credits
}

/**
 * Give Verxio credits to a user (for merchants/sellers)
 */
export const giveVerxioCredits = async (
  userAddress: string,
  amount: number
): Promise<VerxioCreditResult> => {
  try {
    if (!userAddress || amount <= 0) {
      return {
        success: false,
        error: 'Invalid user address or amount'
      };
    }

    // Upsert: create if doesn't exist, update if exists
    const result = await prisma.verxioCredit.upsert({
      where: { userAddress },
      update: {
        balance: { increment: amount },
        updatedAt: new Date()
      },
      create: {
        userAddress,
        balance: amount
      }
    });

    return {
      success: true,
      message: `Successfully added ${amount} Verxio credits to ${userAddress}`,
      balance: result.balance
    };

  } catch (error) {
    console.error('Error giving Verxio credits:', error);
    return {
      success: false,
      error: 'Failed to give Verxio credits'
    };
  }
};

/**
 * Get user's Verxio credit balance
 */
export const getUserVerxioCreditBalance = async (
  userAddress: string
): Promise<VerxioCreditResult> => {
  try {
    if (!userAddress) {
      return {
        success: false,
        error: 'User address is required'
      };
    }

    const creditRecord = await prisma.verxioCredit.findUnique({
      where: { userAddress }
    });

    const balance = creditRecord?.balance || 0;

    return {
      success: true,
      balance,
      message: `Balance: ${balance} Verxio credits`
    };

  } catch (error) {
    console.error('Error getting Verxio credit balance:', error);
    return {
      success: false,
      error: 'Failed to get Verxio credit balance'
    };
  }
};

/**
 * - REVOKE: Deduct credits from creator (spending credits to award points to users)
 * - AWARD: Add credits back to creator (reversing a previous deduction)
 */
export const awardOrRevokeLoyaltyPoints = async (
  params: AwardPointsParams
): Promise<VerxioCreditResult> => {
  try {
    const { creatorAddress, points, assetAddress, assetOwner, action } = params;

    if (!creatorAddress || points <= 0 || !assetAddress || !assetOwner) {
      return {
        success: false,
        error: 'Invalid parameters for awarding/revoking points'
      };
    }

    // Get current credit balance
    const currentBalance = await getUserVerxioCreditBalance(creatorAddress);
    if (!currentBalance.success) {
      return {
        success: false,
        error: 'Failed to get current credit balance'
      };
    }

    const balance = currentBalance.balance || 0;

    // Check if user has enough credits for awarding
    if (action === 'AWARD' && balance < points) {
      return {
        success: false,
        error: `Insufficient Verxio credits. Required: ${points}, Available: ${balance}`
      };
    }

    // Calculate new balance
    let newBalance: number;
    if (action === 'AWARD') {
      newBalance = balance + points; // Add credits back (reversing a previous deduction)
    } else {
      newBalance = balance - points; // Deduct credits (spending credits to award points to users)
    }

    // Update credit balance
    await prisma.verxioCredit.upsert({
      where: { userAddress: creatorAddress },
      update: {
        balance: newBalance,
        updatedAt: new Date()
      },
      create: {
        userAddress: creatorAddress,
        balance: newBalance
      }
    });

    // Record the action in history
    await prisma.verxioCreditHistory.create({
      data: {
        creator: creatorAddress,
        points,
        action,
        assetAddress,
        assetOwner,
        createdAt: new Date()
      }
    });

    const actionText = action === 'AWARD' ? 'awarded' : 'revoked';
    return {
      success: true,
      message: `Successfully ${actionText} ${points} points. New balance: ${newBalance} Verxio credits`,
      balance: newBalance
    };

  } catch (error) {
    console.error('Error awarding/revoking loyalty points:', error);
    return {
      success: false,
      error: 'Failed to award/revoke loyalty points'
    };
  }
};

/**
 * Get user's Verxio credit history
 */
export const getUserVerxioCreditHistory = async (
  userAddress: string,
  limit: number = 50
): Promise<VerxioCreditResult> => {
  try {
    if (!userAddress) {
      return {
        success: false,
        error: 'User address is required'
      };
    }

    const history = await prisma.verxioCreditHistory.findMany({
      where: { creator: userAddress },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return {
      success: true,
      history,
      message: `Found ${history.length} credit history records`
    };

  } catch (error) {
    console.error('Error getting Verxio credit history:', error);
    return {
      success: false,
      error: 'Failed to get Verxio credit history'
    };
  }
};

/**
 * Get all Verxio credit history (for admin purposes)
 */
export const getAllVerxioCreditHistory = async (
  limit: number = 100
): Promise<VerxioCreditResult> => {
  try {
    const history = await prisma.verxioCreditHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return {
      success: true,
      history,
      message: `Found ${history.length} credit history records`
    };

  } catch (error) {
    console.error('Error getting all Verxio credit history:', error);
    return {
      success: false,
      error: 'Failed to get Verxio credit history'
    };
  }
};

/**
 * Initialize Verxio credits for a user (set initial balance)
 */
export const initializeVerxioCredits = async (
  userAddress: string,
  initialBalance: number = 0
): Promise<VerxioCreditResult> => {
  try {
    if (!userAddress) {
      return {
        success: false,
        error: 'User address is required'
      };
    }

    if (initialBalance < 0) {
      return {
        success: false,
        error: 'Initial balance cannot be negative'
      };
    }

    // Check if user already has credits
    const existing = await prisma.verxioCredit.findUnique({
      where: { userAddress }
    });

    if (existing) {
      return {
        success: false,
        error: 'User already has Verxio credits initialized'
      };
    }

    // Create new credit record
    const result = await prisma.verxioCredit.create({
      data: {
        userAddress,
        balance: initialBalance
      }
    });

    return {
      success: true,
      message: `Initialized Verxio credits for ${userAddress} with ${initialBalance} credits`,
      balance: result.balance
    };

  } catch (error) {
    console.error('Error initializing Verxio credits:', error);
    return {
      success: false,
      error: 'Failed to initialize Verxio credits'
    };
  }
};
