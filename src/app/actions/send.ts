'use server'

import { getUserByEmail } from './user'
import prisma from '@/lib/prisma'
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
