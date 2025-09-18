'use server'

import { prisma } from '@/lib/prisma';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { getVerxioConfig, getTotalMembersAcrossPrograms } from './loyalty';
import { getUserVerxioCreditBalance } from './verxio-credit';

export interface UserStats {
  usdcBalance: string;
  loyaltyProgramCount: number;
  totalMembers: number;
  totalRevenue: string;
  totalDiscounts: string;
  verxioCreditBalance: number;
  recentPayments: Array<{
    amount: string;
    loyaltyDiscount: string;
    createdAt: string;
    reference: string;
    type: 'payment' | 'transfer' | 'product';
    productName?: string;
    quantity?: number;
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
    const loyaltyProgramAddresses = loyaltyPrograms.map((p: any) => p.programPublicKey);

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

    // 4. Get Total Revenue Collected (Payments + Transfers + Products)
    const revenuePayments = await prisma.paymentRecord.findMany({
      where: {
        recipient: userAddress,
        status: 'SUCCESS'
      },
      select: {
        amount: true
      }
    });

    const revenueTransfers = await prisma.transferRecord.findMany({
      where: {
        recipientWalletAddress: userAddress,
        status: 'SUCCESS'
      },
      select: {
        amount: true
      }
    });

    const revenueProducts = await prisma.productPurchase.findMany({
      where: {
        product: {
          creatorAddress: userAddress
        },
        status: 'COMPLETED'
      },
      select: {
        totalAmount: true
      }
    });

    const totalRevenue = revenuePayments.reduce((sum: number, payment: any) => sum + parseFloat(payment.amount), 0) +
      revenueTransfers.reduce((sum: number, transfer: any) => sum + transfer.amount, 0) +
      revenueProducts.reduce((sum: number, product: any) => sum + product.totalAmount, 0);

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
        loyaltyDiscount: true
      }
    });

    // Simply sum up the actual discount amounts (already calculated)
    const totalDiscounts = discountPayments.reduce((sum: number, payment: any) => {
      const discountAmount = parseFloat(payment.loyaltyDiscount);
      return sum + (isNaN(discountAmount) ? 0 : discountAmount);
    }, 0);

    // 6. Get Verxio Credit Balance
    const verxioCreditResult = await getUserVerxioCreditBalance(userAddress);
    const verxioCreditBalance = verxioCreditResult.success ? (verxioCreditResult.balance || 0) : 0;

    // 7. Get Verxio Points (from loyalty passes) and add to credits
    // let verxioPoints = 0;
    // try {
    //   const loyaltyPassesResult = await getUserLoyaltyPasses(userAddress);
    //   if (loyaltyPassesResult.success && loyaltyPassesResult.loyaltyPasses) {
    //     verxioPoints = loyaltyPassesResult.loyaltyPasses.reduce((total, pass) => total + (pass.xp || 0), 0);
    //   }
    // } catch (error) {
    //   console.log('Verxio points fetch failed:', error);
    //   verxioPoints = 0;
    // }

    // 8. Combine Verxio Credits and Points
    // const totalVerxioBalance = verxioCreditBalance + verxioPoints;

    // 7. Get Recent Payment, Transfer & Product Activity
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

    const recentTransfers = await prisma.transferRecord.findMany({
      where: {
        recipientWalletAddress: userAddress,
        status: 'SUCCESS'
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        amount: true,
        createdAt: true,
        id: true
      }
    });

    const recentProducts = await prisma.productPurchase.findMany({
      where: {
        product: {
          creatorAddress: userAddress
        },
        status: 'COMPLETED'
      },
      orderBy: { purchasedAt: 'desc' },
      take: 5,
      select: {
        totalAmount: true,
        quantity: true,
        purchasedAt: true,
        id: true,
        product: {
          select: {
            productName: true
          }
        }
      }
    });

    // Combine and sort by creation date, take the most recent 5
    const allRecentActivity = [
      ...recentPayments.map((payment: any) => ({
        amount: payment.amount,
        loyaltyDiscount: payment.loyaltyDiscount,
        createdAt: payment.createdAt,
        reference: payment.reference,
        type: 'payment' as const
      })),
      ...recentTransfers.map((transfer: any) => ({
        amount: transfer.amount.toString(),
        loyaltyDiscount: '0',
        createdAt: transfer.createdAt,
        reference: `transfer_${transfer.id}`,
        type: 'transfer' as const
      })),
      ...recentProducts.map((product: any) => ({
        amount: product.totalAmount.toString(),
        loyaltyDiscount: '0',
        createdAt: product.purchasedAt,
        reference: `product_${product.id}`,
        type: 'product' as const,
        productName: product.product.productName,
        quantity: product.quantity
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

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
      verxioCreditBalance,
      recentPayments: allRecentActivity.map(activity => ({
        ...activity,
        createdAt: activity.createdAt.toISOString()
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
