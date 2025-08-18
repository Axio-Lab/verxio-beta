'use server'

import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { getVerxioConfig, getTotalMembersAcrossPrograms } from './loyalty';

export interface UserStats {
  usdcBalance: string;
  loyaltyProgramCount: number;
  totalMembers: number;
  totalRevenue: string;
  totalDiscounts: string;
  recentPayments: Array<{
    amount: string;
    loyaltyDiscount: string;
    createdAt: string;
    reference: string;
  }>;
}

export const getUserStats = async (userAddress: string): Promise<{ success: boolean; stats?: UserStats; error?: string }> => {
  try {
    if (!userAddress) {
      return { success: false, error: 'User address is required' };
    }

    // Get RPC endpoint from environment
    const { rpcEndpoint, usdcMint } = await getVerxioConfig();
    const connection = new Connection(rpcEndpoint, 'confirmed');

    // 1. Get USDC Balance
    let usdcBalance = 0;
    try {
      const tokenMint = new PublicKey(usdcMint!);
      const userATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(userAddress));
      const accountInfo = await getAccount(connection, userATA);
      usdcBalance = Number(accountInfo.amount) / Math.pow(10, 6);
    } catch (error) {
      console.log('USDC balance fetch failed (likely no ATA):', error);
      usdcBalance = 0;
    }

    // 2. Get Loyalty Programs Created by User
    const loyaltyPrograms = await prisma.loyaltyProgram.findMany({
      where: { creator: userAddress },
      select: { programPublicKey: true }
    });

    const loyaltyProgramCount = loyaltyPrograms.length;
    const loyaltyProgramAddresses = loyaltyPrograms.map(p => p.programPublicKey);

    // 3. Get Total Members in All Programs
    let totalMembers = 0;
    if (loyaltyProgramAddresses.length > 0) {
      try {
        // Get total members across all loyalty programs
        const membersResult = await getTotalMembersAcrossPrograms(loyaltyProgramAddresses);
        if (membersResult.success && membersResult.totalMembers !== undefined) {
          totalMembers = membersResult.totalMembers;
        } else {
          console.log('Failed to get member count:', membersResult.error);
          totalMembers = 0;
        }
      } catch (error) {
        console.log('Error counting members:', error);
        totalMembers = 0;
      }
    }

    // 4. Get Total Revenue Collected
    const revenuePayments = await prisma.paymentRecord.findMany({
      where: {
        recipient: userAddress,
        status: 'SUCCESS'
      },
      select: {
        amount: true
      }
    });

    const totalRevenue = revenuePayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    // 5. Get Total Discounts Given
    const discountPayments = await prisma.paymentRecord.findMany({
      where: {
        recipient: userAddress,
        status: 'SUCCESS',
        loyaltyDiscount: {
          not: '0'
        }
      },
      select: {
        amount: true,
        loyaltyDiscount: true
      }
    });

    let totalDiscounts = 0;
    discountPayments.forEach(payment => {
      const discountText = payment.loyaltyDiscount;
      const paymentAmount = parseFloat(payment.amount);
      
      if (discountText.includes('%')) {
        // Percentage discount
        const percentage = parseFloat(discountText.replace('%', ''));
        totalDiscounts += (paymentAmount * percentage) / 100;
      } else if (discountText.includes('$')) {
        // Dollar discount
        const dollarAmount = parseFloat(discountText.replace('$', ''));
        totalDiscounts += dollarAmount;
      }
    });

    // 6. Get Recent Payment Activity
    const recentPayments = await prisma.paymentRecord.findMany({
      where: {
        recipient: userAddress,
        status: 'SUCCESS'
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        amount: true,
        loyaltyDiscount: true,
        createdAt: true,
        reference: true
      }
    });

    const stats: UserStats = {
      usdcBalance: usdcBalance.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }),
      loyaltyProgramCount,
      totalMembers,
      totalRevenue: totalRevenue.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }),
      totalDiscounts: totalDiscounts.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }),
      recentPayments: recentPayments.map(payment => ({
        ...payment,
        createdAt: payment.createdAt.toISOString()
      }))
    };

    return { success: true, stats };

  } catch (error) {
    console.error('Error fetching user stats:', error);
    return { 
      success: false, 
      error: 'Failed to fetch user statistics'
    };
  }
};
