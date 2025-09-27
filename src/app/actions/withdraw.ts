'use server'

import { getUserByEmail } from './user'
import { prisma } from '@/lib/prisma'

export interface WithdrawTokenData {
  voucherAddress: string
  withdrawType: 'verxio' | 'external'
  recipient: string // email for verxio, wallet address for external
  amount: number
  senderWalletAddress: string
}

export const withdrawTokens = async (data: WithdrawTokenData) => {
  try {
    let recipientWalletAddress: string

    if (data.withdrawType === 'verxio') {
      // Get the recipient user by email
      const userResult = await getUserByEmail(data.recipient)

      if (!userResult.success || !userResult.user) {
        return { success: false, error: 'User not found with this email address' }
      }

      recipientWalletAddress = userResult.user.walletAddress
    } else {
      // External wallet - validate address format
      if (!data.recipient.trim() || data.recipient.length < 32) {
        return { success: false, error: 'Invalid wallet address format' }
      }

      recipientWalletAddress = data.recipient
    }

    // Get voucher details from database to verify ownership and get token info
    const voucher = await prisma.voucher.findFirst({
      where: {
        voucherPublicKey: data.voucherAddress,
        recipient: data.senderWalletAddress // Verify the sender owns this voucher
      },
      select: {
        id: true,
        voucherPublicKey: true,
        worth: true,
        collection: {
          select: {
            creator: true
          }
        }
      }
    })

    if (!voucher) {
      return { success: false, error: 'Voucher not found or you do not own this voucher' }
    }

    // Verify the withdrawal amount doesn't exceed voucher value
    if (data.amount > (voucher.worth || 0)) {
      return { success: false, error: 'Withdrawal amount exceeds voucher value' }
    }

    // Create withdraw record with PENDING status
    const withdrawRecord = await prisma.transferRecord.create({
      data: {
        senderWalletAddress: data.senderWalletAddress,
        recipientWalletAddress,
        amount: data.amount,
        sendType: data.withdrawType === 'verxio' ? 'VERXIO' : 'EXTERNAL',
        status: 'PENDING'
      }
    })

    return {
      success: true,
      message: `Withdrawal validated successfully!`,
      recipientWalletAddress,
      withdrawId: withdrawRecord.id,
      voucherId: voucher.id,
      voucherPublicKey: voucher.voucherPublicKey
    }

  } catch (error) {
    console.error('Error withdrawing tokens:', error)

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to withdraw tokens'
    }
  }
}

// Simple token transfer from voucher to recipient
export const buildWithdrawTransaction = async (
  data: {
    voucherAddress: string
    recipientWallet: string
    amount: number
    voucherId: string
    creatorAddress: string
  }
): Promise<{ success: boolean; transaction?: string; instructions?: number; connection?: any; sponsored?: boolean; error?: string }> => {
  try {
    const { voucherAddress, recipientWallet, amount, voucherId, creatorAddress } = data;
    
    if (!voucherAddress || !amount || !recipientWallet || !voucherId || !creatorAddress) {
      return { success: false, error: 'Missing required fields' }
    }

    // Import Solana dependencies
    const { Connection, PublicKey, Transaction, Keypair } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');

    // Get voucher secret key for signing and paying fees
    const { getVoucherSecretKey } = await import('./voucher');
    const voucherKeyResult = await getVoucherSecretKey(voucherId, creatorAddress);
    if (!voucherKeyResult.success) {
      return { success: false, error: voucherKeyResult.error }
    }

    // Get voucher details to determine token mint
    const { getVoucherDetails } = await import('@/lib/voucher/getVoucherDetails');
    const voucherDetails = await getVoucherDetails(voucherAddress);
    
    if (!voucherDetails.success || !voucherDetails.data) {
      return { success: false, error: 'Failed to fetch voucher details' }
    }

    // Get token mint from voucher metadata (Token Address attribute)
    const tokenAddress = voucherDetails.data.attributes?.['Token Address'];
    if (!tokenAddress) {
      return { success: false, error: 'Token address not found in voucher metadata' }
    }

    // Get Verxio config for RPC endpoint and fee payer
    const { getVerxioConfig } = await import('./loyalty');
    const configResult = await getVerxioConfig();
    if (!configResult.rpcEndpoint || !configResult.privateKey) {
      return { success: false, error: 'RPC endpoint or fee payer not configured' }
    }

    // Create connection
    const connection = new Connection(configResult.rpcEndpoint, 'confirmed');

    // Create voucher keypair from secret key
    const bs58 = await import('bs58');
    const voucherKeypair = Keypair.fromSecretKey(bs58.default.decode(voucherKeyResult.voucherSecretKey));

    // Create fee payer keypair
    const feePayerKeypair = Keypair.fromSecretKey(bs58.default.decode(configResult.privateKey));

    // Get token mint info for decimals
    const tokenMint = new PublicKey(tokenAddress);
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    // Calculate amount in smallest units
    const withdrawalAmountSmallest = Math.round(amount * Math.pow(10, decimals));

    // Get associated token accounts
    const voucherATA = await getAssociatedTokenAddress(
      tokenMint,
      voucherKeypair.publicKey, // Voucher owns the tokens
    );

    const recipientATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(recipientWallet),
    );

    // Create transaction
    const transaction = new Transaction();

    // Check if recipient ATA exists, create if not
    const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
    if (!recipientAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          feePayerKeypair.publicKey, // Fee payer pays for ATA creation
          recipientATA,
          new PublicKey(recipientWallet),
          tokenMint
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        voucherATA,
        recipientATA,
        voucherKeypair.publicKey, // Voucher signs the transfer
        withdrawalAmountSmallest
      )
    );

    // Get recent blockhash and set fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = feePayerKeypair.publicKey; // Fee payer pays gas fees

    // Sign with both voucher (authority) and fee payer
    transaction.sign(voucherKeypair, feePayerKeypair);
    const signature = await connection.sendRawTransaction(transaction.serialize());

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    console.log('Withdraw transaction successful:', signature);

    return {
      success: true,
      transaction: signature,
      instructions: transaction.instructions.length,
      sponsored: false,
      connection: {
        endpoint: configResult.rpcEndpoint,
        commitment: "confirmed"
      }
    };

  } catch (error) {
    console.error('Error executing withdraw transaction:', error);
    return { 
      success: false, 
      error: `Failed to execute withdraw transaction: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Get token balance for a voucher
export const getVoucherTokenBalance = async (voucherAddress: string, tokenAddress: string) => {
  try {
    // Import Solana dependencies
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const { getAssociatedTokenAddress, getAccount, getMint } = await import('@solana/spl-token');

    // Get Verxio config for RPC endpoint
    const { getVerxioConfig } = await import('./loyalty');
    const configResult = await getVerxioConfig();
    if (!configResult.rpcEndpoint) {
      return { success: false, error: 'RPC endpoint not configured' }
    }

    // Create connection
    const connection = new Connection(configResult.rpcEndpoint, 'confirmed');

    // Get voucher's associated token account
    const voucherATA = await getAssociatedTokenAddress(
      new PublicKey(tokenAddress),
      new PublicKey(voucherAddress)
    );

    // Get the token account info
    const tokenAccount = await getAccount(connection, voucherATA);
    
    // Get token mint info for decimals
    const mintInfo = await getMint(connection, new PublicKey(tokenAddress));
    
    // Convert to human-readable amount
    const balance = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals);

    return {
      success: true,
      balance: balance,
      decimals: mintInfo.decimals
    };

  } catch (error) {
    console.error('Error fetching voucher token balance:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch token balance' 
    };
  }
}

// Update withdraw status after successful transaction
export const updateWithdrawStatus = async (withdrawId: string, signature: string) => {
  try {
    // Update withdraw status to SUCCESS
    await prisma.transferRecord.update({
      where: { id: withdrawId },
      data: { 
        status: 'SUCCESS',
        transactionHash: signature
      }
    });

    return { success: true }
  } catch (error) {
    console.error('Error updating withdraw status:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update withdraw status' 
    }
  }
}

// Update withdraw status to FAILED
export const updateWithdrawStatusFailed = async (withdrawId: string, errorMessage?: string) => {
  try {
    // Update withdraw status to FAILED
    await prisma.transferRecord.update({
      where: { id: withdrawId },
      data: { 
        status: 'FAILED',
        error: errorMessage || 'Transaction failed'
      }
    });

    return { success: true }
  } catch (error) {
    console.error('Error updating withdraw status to failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update withdraw status' 
    }
  }
}

// Get withdraw records for debugging
export const getWithdrawRecords = async (senderWalletAddress: string, limit: number = 10) => {
  try {
    const records = await prisma.transferRecord.findMany({
      where: { senderWalletAddress },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return { success: true, records }
  } catch (error) {
    console.error('Error fetching withdraw records:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch withdraw records' 
    }
  }
}


