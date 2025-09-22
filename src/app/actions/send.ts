'use server'

import { getUserByEmail } from './user'
import { prisma } from '@/lib/prisma'
import { giveVerxioCredits } from './verxio-credit';

export interface SendTokensData {
    sendType: 'verxio' | 'external'
    recipient: string // email for verxio, wallet address for external
    amount: number
    senderWalletAddress: string
}

export const sendTokens = async (data: SendTokensData) => {
    let transferRecord: any = null;

    try {
        let recipientWalletAddress: string

        if (data.sendType === 'verxio') {
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

        // Create transfer record with PENDING status
        transferRecord = await prisma.transferRecord.create({
            data: {
                senderWalletAddress: data.senderWalletAddress,
                recipientWalletAddress,
                amount: data.amount,
                sendType: data.sendType === 'verxio' ? 'VERXIO' : 'EXTERNAL',
                status: 'PENDING'
            }
        })

        return {
            success: true,
            message: `Transfer validated successfully!`,
            recipientWalletAddress,
            transferId: transferRecord.id
        }

    } catch (error) {
        console.error('Error sending tokens:', error)

        // If we created a transfer record, update it to FAILED
        if (transferRecord) {
            try {
                await prisma.transferRecord.update({
                    where: { id: transferRecord.id },
                    data: {
                        status: 'FAILED',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    }
                })
            } catch (updateError) {
                console.error('Failed to update transfer record status:', updateError)
            }
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send tokens'
        }
    }
}

// New function to update transfer status after successful transaction
export const updateTransferStatus = async (transferId: string, signature: string) => {
  try {
    // Get transfer details to calculate credit reward
    const transferRecord = await prisma.transferRecord.findUnique({
      where: { id: transferId },
      select: {
        senderWalletAddress: true,
        amount: true
      }
    });

    if (!transferRecord) {
      throw new Error('Transfer record not found');
    }

    // Update transfer status to SUCCESS
    await prisma.transferRecord.update({
      where: { id: transferId },
      data: { 
        status: 'SUCCESS',
        transactionHash: signature
      }
    });

    // Award 10% worth of Verxio credits to sender
    // $1 = 500 credits, so 10% of transfer amount = (amount * 0.1) * 500 credits
    const creditReward = Math.floor(transferRecord.amount * 0.1 * 500);
    
    if (creditReward > 0) {
      const creditResult = await giveVerxioCredits(transferRecord.senderWalletAddress, creditReward);
      
      if (!creditResult.success) {
        console.error('Failed to award Verxio credits to sender:', creditResult.error);
        // Don't fail the transfer update if credit award fails
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating transfer status:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update transfer status' 
    }
  }
}

// Sponsor transfer transaction (no payment record needed)
export interface SponsorTransferTransactionData {
  transaction: string;
  transferId: string;
}

export const sponsorTransferTransaction = async (
  data: SponsorTransferTransactionData
): Promise<{ success: boolean; signature?: string; error?: string }> => {
  try {
    const { transaction: serializedTransaction, transferId } = data;

    if (!serializedTransaction || !transferId) {
      return { success: false, error: 'Missing transaction data or transfer ID' }
    }

    // Import Solana dependencies
    const { Connection, VersionedTransaction, Keypair } = await import('@solana/web3.js');
    const bs58 = await import('bs58');

    // Fee payer configuration
    const FEE_PAYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
    const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;

    if (!FEE_PAYER_PRIVATE_KEY || !FEE_PAYER_ADDRESS) {
      return { success: false, error: 'Fee payer not configured' }
    }

    // Initialize fee payer keypair
    const feePayerWallet = Keypair.fromSecretKey(bs58.default.decode(FEE_PAYER_PRIVATE_KEY));

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const configResult = await getVerxioConfig();
    
    if (!configResult.rpcEndpoint) {
      return { success: false, error: 'RPC endpoint not configured' }
    }

    const connection = new Connection(configResult.rpcEndpoint, 'confirmed');

    // Get transfer details from database
    const transferRecord = await prisma.transferRecord.findUnique({
      where: { id: transferId },
      select: { 
        id: true,
        senderWalletAddress: true,
        recipientWalletAddress: true,
        amount: true,
        status: true 
      }
    });

    if (!transferRecord) {
      return { success: false, error: 'Transfer record not found' }
    }

    if (transferRecord.status !== 'PENDING') {
      return { success: false, error: 'Transfer is no longer pending' }
    }

    // Deserialize the partially signed transaction
    const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    // Verify the transaction
    // 1. Check that it's using the correct fee payer
    const message = transaction.message;
    const accountKeys = message.getAccountKeys();
    const feePayerIndex = 0; // Fee payer is always the first account
    const feePayer = accountKeys.get(feePayerIndex);

    if (!feePayer || feePayer.toBase58() !== FEE_PAYER_ADDRESS) {
      return { success: false, error: 'Invalid fee payer in transaction' }
    }

    // 2. Check for any unauthorized fund transfers from fee payer
    for (const instruction of message.compiledInstructions) {
      const programId = accountKeys.get(instruction.programIdIndex);

      // Check if instruction is for System Program (transfers)
      if (programId && programId.toBase58() === '11111111111111111111111111111111') {
        // Check if it's a transfer (command 2)
        if (instruction.data[0] === 2) {
          const senderIndex = instruction.accountKeyIndexes[0];
          const senderAddress = accountKeys.get(senderIndex);

          // Don't allow transactions that transfer tokens from fee payer
          if (senderAddress && senderAddress.toBase58() === FEE_PAYER_ADDRESS) {
            return { success: false, error: 'Transaction attempts to transfer funds from fee payer' }
          }
        }
      }
    }

    // 3. Sign with fee payer
    transaction.sign([feePayerWallet]);

    // 4. Send transaction
    const signature = await connection.sendTransaction(transaction);

    // Update transfer status
    await updateTransferStatus(transferId, signature);

    return {
      success: true,
      signature: signature
    };

  } catch (error) {
    console.error('Error sponsoring transfer transaction:', error);
    return { 
      success: false, 
      error: 'Failed to sponsor transfer transaction' 
    };
  }
};
