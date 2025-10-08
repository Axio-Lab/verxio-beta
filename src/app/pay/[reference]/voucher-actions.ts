'use server';

import { prisma } from '@/lib/prisma';
import { getVoucherDetails } from '@/lib/voucher/getVoucherDetails';
import { getVerxioConfig } from '@/app/actions/loyalty';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';

export interface VoucherResult {
  success: boolean;
  message?: string;
  error?: string;
  vouchers?: Array<{
    id: string;
    voucherPublicKey: string;
    name: string;
    balance: number;
    collectionName?: string;
  }>;
  transaction?: any;
}

/**
 * Get USDC balance of a voucher address
 */
const getVoucherUSDCBalance = async (voucherAddress: string): Promise<number> => {
  try {
    // Use Verxio config for consistent RPC and USDC mint
    const config = await getVerxioConfig();
    const connection = new Connection(config.rpcEndpoint, 'confirmed');
    
    const USDC_MINT = new PublicKey(config.usdcMint!);
    
    const voucherPubkey = new PublicKey(voucherAddress);
    const voucherATA = await getAssociatedTokenAddress(USDC_MINT, voucherPubkey, true);
    
    // console.log(`Checking USDC balance for voucher ${voucherAddress}`);
    
    try {
      const tokenAccount = await getAccount(connection, voucherATA);
      const balance = Number(tokenAccount.amount) / 1_000_000; // USDC has 6 decimals
    //   console.log(`Found USDC balance: ${balance}`);
      return balance;
    } catch (ataError) {
      // ATA doesn't exist, balance is 0
    //   console.log(`No ATA found for voucher ${voucherAddress}`);
      return 0;
    }
  } catch (error) {
    console.error('Error getting voucher USDC balance:', error);
    return 0;
  }
};

/**
 * Get user's vouchers with USDC balance
 */
export const getUserVouchers = async (
  userAddress: string
): Promise<VoucherResult> => {
  try {
    if (!userAddress) {
      return {
        success: false,
        error: 'User address is required'
      };
    }

    // Get all vouchers owned by the user from database
    const vouchers = await prisma.voucher.findMany({
      where: {
        recipient: userAddress
      },
      include: {
        collection: {
          select: {
            collectionPublicKey: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${vouchers.length} vouchers in database for user ${userAddress}`);

    // Fetch details and balance for each voucher
    const vouchersWithDetails = await Promise.all(
      vouchers.map(async (voucher: any) => {
        try {
          // Get voucher details from blockchain
          const details = await getVoucherDetails(voucher.voucherPublicKey);
          
          // Get USDC balance
          const balance = await getVoucherUSDCBalance(voucher.voucherPublicKey);
          
          console.log(`Voucher ${voucher.voucherPublicKey}: Balance=${balance} USDC`);
          
          return {
            id: voucher.id,
            voucherPublicKey: voucher.voucherPublicKey,
            name: details.success && details.data?.name 
              ? details.data.name 
              : `Voucher ${voucher.voucherPublicKey.slice(0, 8)}...`,
            balance: balance,
            collectionName: `Collection ${voucher.collection.collectionPublicKey.slice(0, 8)}...`
          };
        } catch (error) {
          console.error('Error fetching voucher details:', error);
          return {
            id: voucher.id,
            voucherPublicKey: voucher.voucherPublicKey,
            name: `Voucher ${voucher.voucherPublicKey.slice(0, 8)}...`,
            balance: 0,
            collectionName: `Collection ${voucher.collection.collectionPublicKey.slice(0, 8)}...`
          };
        }
      })
    );

    // Filter out vouchers with 0 balance
    const activeVouchers = vouchersWithDetails.filter((v: any) => v.balance > 0);

    console.log(`Active vouchers with balance: ${activeVouchers.length}`);

    return {
      success: true,
      vouchers: activeVouchers,
      message: `Found ${activeVouchers.length} active vouchers`
    };

  } catch (error) {
    console.error('Error getting user vouchers:', error);
    return {
      success: false,
      error: 'Failed to get user vouchers'
    };
  }
};

/**
 * Process payment using voucher balance (withdraw from voucher to merchant)
 */
export const payWithVoucher = async (
  voucherPublicKey: string,
  paymentAmount: number,
  recipientAddress: string,
  userWalletAddress: string,
  voucherId: string,
  creatorAddress: string
): Promise<VoucherResult> => {
  try {
    if (!voucherPublicKey || paymentAmount <= 0 || !recipientAddress) {
      return {
        success: false,
        error: 'Invalid payment parameters'
      };
    }

    // Get voucher USDC balance
    const voucherBalance = await getVoucherUSDCBalance(voucherPublicKey);

    // Check if voucher has any balance
    if (voucherBalance <= 0) {
      return {
        success: false,
        error: 'Voucher has no USDC balance'
      };
    }

    // Determine how much to withdraw from voucher
    const amountFromVoucher = Math.min(voucherBalance, paymentAmount);
    const amountFromWallet = paymentAmount - amountFromVoucher;

    // Build withdraw transaction from voucher to merchant
    const { buildWithdrawTransaction } = await import('@/app/actions/withdraw');
    
    const buildResult = await buildWithdrawTransaction({
      voucherAddress: voucherPublicKey,
      recipientWallet: recipientAddress,
      amount: amountFromVoucher,
      voucherId: voucherId,
      creatorAddress: creatorAddress,
    });

    if (!buildResult.success || !buildResult.transaction) {
      return {
        success: false,
        error: buildResult.error || 'Failed to build voucher payment transaction'
      };
    }

    return {
      success: true,
      message: `Payment successful! ${amountFromVoucher} USDC withdrawn from voucher${amountFromWallet > 0 ? `, ${amountFromWallet} USDC from wallet` : ''}`,
      transaction: {
        signature: buildResult.transaction,
        voucherPublicKey,
        amountFromVoucher,
        amountFromWallet,
        totalAmount: paymentAmount,
        recipient: recipientAddress
      }
    };

  } catch (error) {
    console.error('Error processing voucher payment:', error);
    return {
      success: false,
      error: 'Failed to process voucher payment'
    };
  }
};

/**
 * Get voucher balance by public key
 */
export const getVoucherBalance = async (
  voucherPublicKey: string
): Promise<VoucherResult> => {
  try {
    if (!voucherPublicKey) {
      return {
        success: false,
        error: 'Voucher public key is required'
      };
    }

    const voucher = await prisma.voucher.findFirst({
      where: {
        voucherPublicKey
      },
      select: {
        worth: true,
        voucherPublicKey: true
      }
    });

    if (!voucher) {
      return {
        success: false,
        error: 'Voucher not found'
      };
    }

    const balance = voucher.worth || 0;

    return {
      success: true,
      message: `Voucher balance: ${balance} USDC`,
      vouchers: [{
        id: voucher.voucherPublicKey,
        voucherPublicKey: voucher.voucherPublicKey,
        name: `Voucher ${voucher.voucherPublicKey.slice(0, 8)}...`,
        balance
      }]
    };

  } catch (error) {
    console.error('Error getting voucher balance:', error);
    return {
      success: false,
      error: 'Failed to get voucher balance'
    };
  }
};

