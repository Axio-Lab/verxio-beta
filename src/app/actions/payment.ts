'use server'

import prisma from '@/lib/prisma'

export interface UpdatePaymentStatusData {
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED'
  signature?: string
  loyaltyDiscount?: string
  amount?: string
}

export const updatePaymentStatus = async (
  reference: string, 
  data: UpdatePaymentStatusData
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    if (!reference) {
      return { success: false, error: 'Payment reference is required' }
    }

    // Update payment status
    const updatedPayment = await prisma.paymentRecord.update({
      where: { reference },
      data: {
        status: data.status,
        signature: data.signature || null,
        loyaltyDiscount: data.loyaltyDiscount || '0',
        amount: data.amount || undefined
      }
    })

    return { 
      success: true, 
      message: `Payment status updated to ${data.status}` 
    }

  } catch (error) {
    console.error('Error updating payment status:', error)
    return { 
      success: false, 
      error: 'Failed to update payment status' 
    }
  }
}

export const getPaymentByReference = async (
  reference: string
): Promise<{ success: boolean; payment?: any; error?: string }> => {
  try {
    if (!reference) {
      return { success: false, error: 'Payment reference is required' }
    }

    const payment = await prisma.paymentRecord.findUnique({
      where: { reference }
    })

    if (!payment) {
      return { success: false, error: 'Payment not found' }
    }

    return { success: true, payment }

  } catch (error) {
    console.error('Error fetching payment:', error)
    return { 
      success: false, 
      error: 'Failed to fetch payment' 
    }
  }
}

export interface CreatePaymentData {
  recipientAddress: string
  amount: string
  loyaltyDetails?: {
    loyaltyProgramAddress?: string
    loyaltyProgramName?: string
    loyaltyDiscount?: string
  }
}

export const createPayment = async (
  data: CreatePaymentData
): Promise<{ success: boolean; payment?: any; error?: string }> => {
  try {
    if (!data.recipientAddress || !data.amount) {
      return { success: false, error: 'Missing required fields' }
    }

    // Generate a unique reference 
    const ref = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)

    // Store payment record in Prisma database
    const paymentRecord = await prisma.paymentRecord.create({
      data: {
        reference: ref,
        amount: data.amount,
        recipient: data.recipientAddress,
        splToken: 'USDC',
        status: 'PENDING',
        loyaltyProgramAddress: data.loyaltyDetails?.loyaltyProgramAddress || null,
        loyaltyProgramName: data.loyaltyDetails?.loyaltyProgramName || null,
        loyaltyDiscount: data.loyaltyDetails?.loyaltyDiscount || '0',
      },
    })

    return { 
      success: true, 
      payment: {
        reference: ref,
        recipient: data.recipientAddress,
        amount: data.amount,
        createdAt: paymentRecord.createdAt.toISOString(),
        status: 'PENDING',
        url: `/pay/${ref}`,
        loyaltyProgramAddress: paymentRecord.loyaltyProgramAddress,
        loyaltyProgramName: paymentRecord.loyaltyProgramName,
        loyaltyDiscount: paymentRecord.loyaltyDiscount,
      }
    }

  } catch (error) {
    console.error('Payment creation error:', error)
    return { 
      success: false, 
      error: 'Internal server error' 
    }
  }
}

export interface BuildTransactionData {
  reference: string
  amount: string
  recipient: string
  userWallet: string
}

export const buildPaymentTransaction = async (
  data: BuildTransactionData
): Promise<{ success: boolean; transaction?: string; instructions?: number; connection?: any; error?: string }> => {
  try {
    const { reference, amount, recipient, userWallet } = data;
    
    if (!reference || !amount || !recipient || !userWallet) {
      return { success: false, error: 'Missing required fields' }
    }

    // Import Solana dependencies
    const { Connection, PublicKey, Transaction } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const { rpcEndpoint } = await getVerxioConfig();
    const { USDC_MINT } = await import('@/lib/utils');

    // Treasury wallet address (you can set this in environment variables)
    const TREASURY_WALLET = process.env.TREASURY_WALLET!;
    const TREASURY_FEE_PERCENTAGE = 0.005; // 0.5%

    const connection = new Connection(rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(USDC_MINT);

    const paymentAmount = parseFloat(amount);
    const treasuryFee = paymentAmount * TREASURY_FEE_PERCENTAGE;

    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    // Calculate amounts in smallest units
    const paymentAmountSmallest = Math.round(paymentAmount * Math.pow(10, decimals));
    const treasuryFeeSmallest = Math.round(treasuryFee * Math.pow(10, decimals));

    // Create transaction
    const transaction = new Transaction();

    // Get associated token accounts
    const userATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(userWallet),
    );

    const recipientATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(recipient),
    );

    const treasuryATA = await getAssociatedTokenAddress(
      tokenMint,
      new PublicKey(TREASURY_WALLET),
    );

    // Check if recipient ATA exists, create if not
    const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
    if (!recipientAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(userWallet),
          recipientATA,
          new PublicKey(recipient),
          tokenMint
        )
      );
    }

    // Check if treasury ATA exists, create if not
    const treasuryAccountInfo = await connection.getAccountInfo(treasuryATA);
    if (!treasuryAccountInfo) {
      return { success: false, error: 'Treasury ATA not found' };
    }

    // Add transfer to recipient (full amount)
    transaction.add(
      createTransferInstruction(
        userATA,
        recipientATA,
        new PublicKey(userWallet),
        paymentAmountSmallest
      )
    );

    // Add transfer to treasury (fee amount)
    transaction.add(
      createTransferInstruction(
        userATA,
        treasuryATA,
        new PublicKey(userWallet),
        treasuryFeeSmallest
      )
    );

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(userWallet);

    // Serialize transaction for frontend signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    return {
      success: true,
      transaction: serializedTransaction.toString('base64'),
      instructions: transaction.instructions.length,
      connection: {
        endpoint: rpcEndpoint,
        commitment: "confirmed"
      }
    };

  } catch (error) {
    console.error('Error building transaction:', error);
    return { 
      success: false, 
      error: 'Failed to build transaction' 
    };
  }
}

export interface VerifyPaymentResult {
  success: boolean
  verified: boolean
  reference?: string
  amount?: string
  status?: string
  signature?: string | null
  recipient?: string
  createdAt?: string
  updatedAt?: string
  message?: string
  error?: string
}

export const verifyPayment = async (
  reference: string
): Promise<VerifyPaymentResult> => {
  try {
    if (!reference) {
      return { 
        success: false, 
        verified: false,
        error: 'Reference parameter is required' 
      }
    }

    // Get payment record from database
    const paymentRecord = await prisma.paymentRecord.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        amount: true,
        recipient: true,
        status: true,
        signature: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!paymentRecord) {
      return {
        success: false,
        verified: false,
        error: 'Payment record not found'
      }
    }

    // Check if payment is successful
    if (paymentRecord.status === 'SUCCESS') {
      return {
        success: true,
        verified: true,
        reference: paymentRecord.reference,
        amount: paymentRecord.amount,
        status: paymentRecord.status,
        signature: paymentRecord.signature,
        recipient: paymentRecord.recipient,
        createdAt: paymentRecord.createdAt.toISOString(),
        updatedAt: paymentRecord.updatedAt.toISOString()
      }
    } else {
      return {
        success: false,
        verified: false,
        reference: paymentRecord.reference,
        status: paymentRecord.status,
        message: `Payment is in ${paymentRecord.status.toLowerCase()} status`
      }
    }

  } catch (error) {
    console.error('Payment verification error:', error);
    return { 
      success: false, 
      verified: false,
      error: 'Internal server error' 
    }
  }
}
