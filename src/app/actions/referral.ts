'use server'

import prisma from '@/lib/prisma'
import { giveVerxioCredits } from './verxio-credit'
import { randomBytes } from 'crypto'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import { getVerxioConfig } from './loyalty'

export interface CreateReferralData {
  referrerWalletAddress: string
  referredUserWalletAddress: string
}

// Generate a unique referral code
const generateReferralCode = (): string => {
  return randomBytes(4).toString('hex').toUpperCase()
}

// Create or get user referral code
export const getOrCreateUserReferralCode = async (walletAddress: string) => {
  try {
    let user = await prisma.user.findUnique({
      where: { walletAddress }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Generate referral code if user doesn't have one
    if (!user.referralCode) {
      let referralCode: string | null = null
      let isUnique = false
      
      // Keep generating until we get a unique code
      while (!isUnique) {
        referralCode = generateReferralCode()
        const existingUser = await prisma.user.findUnique({
          where: { referralCode }
        })
        if (!existingUser) {
          isUnique = true
        }
      }

      user = await prisma.user.update({
        where: { walletAddress },
        data: { referralCode }
      })
    }

    return { success: true, referralCode: user.referralCode }
  } catch (error) {
    console.error('Error getting/creating referral code:', error)
    return { success: false, error: 'Failed to get referral code' }
  }
}

// Create a new referral
export const createReferral = async (data: CreateReferralData) => {
  try {
    // Check if referral already exists
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrer: { walletAddress: data.referrerWalletAddress },
        referredUser: { walletAddress: data.referredUserWalletAddress }
      }
    })

    if (existingReferral) {
      return { success: false, error: 'Referral already exists' }
    }

    // Check if referred user already has a SUCCESSFUL referral (allow retry for failed ones)
    const existingSuccessfulReferral = await prisma.referral.findFirst({
      where: {
        referredUser: { walletAddress: data.referredUserWalletAddress },
        status: 'SUCCESS'
      }
    })

    if (existingSuccessfulReferral) {
      return { success: false, error: 'User already has a successful referral relationship' }
    }

    // Check if there's a pending referral that we can update instead of creating new
    const existingPendingReferral = await prisma.referral.findFirst({
      where: {
        referredUser: { walletAddress: data.referredUserWalletAddress },
        status: 'PENDING'
      }
    })

    if (existingPendingReferral) {
      // Update the existing pending referral instead of creating a new one
      const updatedReferral = await prisma.referral.update({
        where: { id: existingPendingReferral.id },
        data: {
          referrerId: (await prisma.user.findUnique({
            where: { walletAddress: data.referrerWalletAddress }
          }))?.id
        }
      })
      return { success: true, referral: updatedReferral }
    }

    // Get user IDs
    const referrer = await prisma.user.findUnique({
      where: { walletAddress: data.referrerWalletAddress }
    })

    const referredUser = await prisma.user.findUnique({
      where: { walletAddress: data.referredUserWalletAddress }
    })

    if (!referrer || !referredUser) {
      return { success: false, error: 'User not found' }
    }

    // Create referral
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId: referredUser.id,
        status: 'PENDING'
      }
    })

    // Update referrer's pending referral count
    await prisma.user.update({
      where: { id: referrer.id },
      data: { pendingReferralCount: { increment: 1 } }
    })

    return { success: true, referral }
  } catch (error) {
    console.error('Error creating referral:', error)
    return { success: false, error: 'Failed to create referral' }
  }
}

// Get user's referral statistics
export const getUserReferralStats = async (walletAddress: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        referralCode: true,
        referralCount: true,
        pendingReferralCount: true,
        referralsGiven: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            referredUser: {
              select: {
                walletAddress: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    return { success: true, stats: user }
  } catch (error) {
    console.error('Error getting referral stats:', error)
    return { success: false, error: 'Failed to get referral stats' }
  }
}

// Get referral by referral code
export const getUserByReferralCode = async (referralCode: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { referralCode }
    })

    if (!user) {
      return { success: false, error: 'Invalid referral code' }
    }

    return { success: true, user }
  } catch (error) {
    console.error('Error getting user by referral code:', error)
    return { success: false, error: 'Failed to get user by referral code' }
  }
}

// Check if user can claim signup bonus (for display purposes only)
export const checkSignupBonusEligibility = async (walletAddress: string) => {
  try {
    // Simple check: has user already claimed their signup bonus?
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { signupBonusClaimed: true }
    });

    if (user?.signupBonusClaimed) {
      return { 
        success: true, 
        canClaim: false, 
        reason: 'You have already claimed your signup bonus',
        alreadyClaimed: true
      }
    }

    // Check if user has a pending referral
    const referral = await prisma.referral.findFirst({
      where: {
        referredUser: { walletAddress },
        status: 'PENDING'
      },
      include: {
        referrer: true
      }
    })

    // Get RPC endpoint and USDC mint from environment
    const { rpcEndpoint, usdcMint } = await getVerxioConfig();
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // Check actual USDC token balance
    let usdcBalance = 0;
    try {
      const tokenMint = new PublicKey(usdcMint!);
      const userATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(walletAddress));
      const accountInfo = await getAccount(connection, userATA);
      usdcBalance = Number(accountInfo.amount) / Math.pow(10, 6);
    } catch (error) {
      console.log('USDC balance fetch failed (likely no ATA):', error);
      usdcBalance = 0;
    }

    const minimumRequired = 5
    const canClaim = usdcBalance >= minimumRequired

    return {
      success: true,
      canClaim,
      totalUsdcDeposited: usdcBalance,
      minimumRequired,
      reason: canClaim 
        ? `Eligible for signup bonus!`
        : `Need atleast ${(minimumRequired - usdcBalance).toFixed(2)} USDC to claim bonus.`,
      referralId: referral?.id,
      referrerAddress: referral?.referrer?.walletAddress,
      hasReferral: !!referral
    }
  } catch (error) {
    console.error('Error checking signup bonus eligibility:', error)
    return { success: false, error: 'Failed to check signup bonus eligibility' }
  }
}

// Claim signup bonus (called when user clicks claim button)
export const claimSignupBonus = async (walletAddress: string) => {
  try {
    // Simple check: has user already claimed their signup bonus?
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      select: { signupBonusClaimed: true }
    });

    if (user?.signupBonusClaimed) {
      return { 
        success: false, 
        error: 'You have already claimed your signup bonus'
      }
    }

    // Check USDC balance first
    const { rpcEndpoint, usdcMint } = await getVerxioConfig();
    const connection = new Connection(rpcEndpoint, 'confirmed');

    let usdcBalance = 0;
    try {
      const tokenMint = new PublicKey(usdcMint!);
      const userATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(walletAddress));
      const accountInfo = await getAccount(connection, userATA);
      usdcBalance = Number(accountInfo.amount) / Math.pow(10, 6);
    } catch (error) {
      console.log('USDC balance fetch failed:', error);
      usdcBalance = 0;
    }

    const minimumRequired = 5
    if (usdcBalance < minimumRequired) {
      return { 
        success: false, 
        error: `Need at least ${minimumRequired} USDC to claim bonus. Current balance: ${usdcBalance.toFixed(2)} USDC`
      }
    }

    // Check if user has a pending referral
    const referral = await prisma.referral.findFirst({
      where: {
        referredUser: { walletAddress },
        status: 'PENDING'
      },
      include: {
        referrer: true
      }
    })

    if (referral) {
      // User was referred - update referral status
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'SUCCESS' }
      })

      // Award 250 credits to referrer
      const referrerCreditsResult = await giveVerxioCredits(referral.referrer.walletAddress, 250)
      if (!referrerCreditsResult.success) {
        console.error('Failed to award credits to referrer:', referrerCreditsResult.error)
      }
    }

    // Award 500 credits to user (regardless of referral status)
    const userCreditsResult = await giveVerxioCredits(walletAddress, 500)
    if (!userCreditsResult.success) {
      console.error('Failed to award credits to user:', userCreditsResult.error)
      return { success: false, error: 'Failed to award credits to user' }
    }

    // Mark user as having claimed their signup bonus
    await prisma.user.update({
      where: { walletAddress },
      data: { signupBonusClaimed: true }
    });

    // Handle referral credits if user was referred
    if (referral) {
      // Award 250 credits to referrer
      const referrerCreditsResult = await giveVerxioCredits(referral.referrer.walletAddress, 250)
      if (!referrerCreditsResult.success) {
        console.error('Failed to award credits to referrer:', referrerCreditsResult.error)
      } else {
        console.log(`Successfully awarded 250 credits to referrer: ${referral.referrer.walletAddress}`);
      }

      // Update referral status to SUCCESS
      await prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'SUCCESS' }
      });

      // Update referrer's counts
      await prisma.user.update({
        where: { id: referral.referrer.id },
        data: {
          pendingReferralCount: { decrement: 1 },
          referralCount: { increment: 1 }
        }
      });
    }

    return { 
      success: true, 
      message: 'Signup bonus claimed successfully!',
      userCreditsAwarded: 500,
      referrerCreditsAwarded: referral ? 250 : 0,
      totalUsdcDeposited: usdcBalance,
      wasReferred: !!referral
    }
  } catch (error) {
    console.error('Error claiming signup bonus:', error)
    return { success: false, error: 'Failed to claim signup bonus' }
  }
}
