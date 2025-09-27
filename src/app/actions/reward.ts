'use server'

import { prisma } from '@/lib/prisma'
import { storeMetadata } from '@/app/actions/metadata'
import { getVoucherCollectionDetails } from '@/lib/voucher/getVoucherCollectionDetails'
import { mintVoucher } from './voucher'
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from './verxio-credit'

// Record token transfer for proper record keeping
export const recordTokenTransfer = async (
  creatorAddress: string,
  tokenAddress: string,
  amount: number,
  transferType: 'TO_ESCROW' | 'TO_VOUCHER',
  signature: string,
  voucherId?: string,
  rewardId?: string,
  collectionId?: string
): Promise<{ success: boolean; recordId?: string; error?: string }> => {
  try {
    const record = await prisma.tokenTransferRecord.create({
      data: {
        creatorAddress,
        tokenAddress,
        amount,
        transferType,
        signature,
        voucherId: voucherId || null,
        rewardId: rewardId || null,
        collectionId: collectionId || null,
        status: 'COMPLETED'
      }
    });

    return {
      success: true,
      recordId: record.id
    };
  } catch (error) {
    console.error('Error recording token transfer:', error);
    return {
      success: false,
      error: 'Failed to record token transfer'
    };
  }
};

// Get token transfer records for a creator
export const getTokenTransferRecords = async (
  creatorAddress: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ success: boolean; records?: any[]; error?: string }> => {
  try {
    const records = await prisma.tokenTransferRecord.findMany({
      where: { creatorAddress },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        tokenAddress: true,
        amount: true,
        transferType: true,
        signature: true,
        voucherId: true,
        rewardId: true,
        collectionId: true,
        status: true,
        createdAt: true
      }
    });

    return {
      success: true,
      records
    };
  } catch (error) {
    console.error('Error fetching token transfer records:', error);
    return {
      success: false,
      error: 'Failed to fetch token transfer records'
    };
  }
};

// Check if user has enough token balance for the transfer
export const checkTokenBalance = async (userAddress: string, tokenAddress: string, requiredAmount: number): Promise<{ success: boolean; hasEnough: boolean; balance?: number; error?: string }> => {
  try {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const { getAssociatedTokenAddress, getAccount, getMint } = await import('@solana/spl-token');

    const { getVerxioConfig } = await import('./loyalty');
    const configResult = await getVerxioConfig();
    if (!configResult.rpcEndpoint) {
      return { success: false, hasEnough: false, error: 'RPC endpoint not configured' };
    }

    const connection = new Connection(configResult.rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(tokenAddress);
    
    // Get user's token account
    const userATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(userAddress));
    
    try {
      const accountInfo = await getAccount(connection, userATA);
      const tokenMintInfo = await getMint(connection, tokenMint);
      const balance = Number(accountInfo.amount) / Math.pow(10, tokenMintInfo.decimals);
      
      return {
        success: true,
        hasEnough: balance >= requiredAmount,
        balance: balance
      };
    } catch (error) {
      // No token account exists, balance is 0
      return {
        success: true,
        hasEnough: false,
        balance: 0
      };
    }
  } catch (error) {
    console.error('Error checking token balance:', error);
    return { success: false, hasEnough: false, error: 'Failed to check token balance' };
  }
};

export interface CreateRewardLinkData {
  creatorAddress: string
  collectionId: string
  voucherType: string
  name?: string
  description?: string
  voucherWorth?: number
  valueSymbol?: string
  assetName?: string
  assetSymbol?: string
  tokenAddress?: string
  maxUses?: number
  expiryDate?: Date
  transferable?: boolean
  conditions?: string
  imageUri?: string
  metadataUri?: string
}

// Escrow token transfer function
export const transferTokensToEscrow = async (creatorAddress: string, tokenAddress: string, amount: number) => {
  try {
    // Import Solana dependencies
    const { Connection, PublicKey, Transaction, VersionedTransaction } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');
    const bs58 = await import('bs58');

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const config = await getVerxioConfig();
    
    if (!config.rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }

    // Escrow configuration
    const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;
    const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;
    
    if (!ESCROW_PRIVATE_KEY || !ESCROW_ADDRESS) {
      throw new Error('Escrow not configured');
    }

    const connection = new Connection(config.rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(tokenAddress);
    
    // Get token mint info for decimals
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const amountSmallest = Math.round(amount * Math.pow(10, decimals));

    // Get associated token accounts
    const creatorATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(creatorAddress));
    const escrowATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(ESCROW_ADDRESS));

    // Create transaction
    const transaction = new Transaction();
    
    // Check if escrow ATA exists, create if not
    const escrowAccountInfo = await connection.getAccountInfo(escrowATA);
    if (!escrowAccountInfo) {
      // Fee payer covers ATA creation since we're charging creator's Verxio balance
      const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
      const payerAddress = FEE_PAYER_ADDRESS!;
      
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(payerAddress), // fee payer covers ATA creation
          escrowATA, // associatedToken
          new PublicKey(ESCROW_ADDRESS), // owner
          tokenMint // mint
        )
      );
    }
    
    // Add transfer instruction from creator to escrow
    transaction.add(
      createTransferInstruction(
        creatorATA,
        escrowATA,
        new PublicKey(creatorAddress),
        amountSmallest
      )
    );

    // Get recent blockhash and set fee payer to sponsored fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Use sponsored fee payer (FEE_ADDRESS) instead of creator
    const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
    if (FEE_PAYER_ADDRESS) {
      transaction.feePayer = new PublicKey(FEE_PAYER_ADDRESS);
    } else {
      transaction.feePayer = new PublicKey(creatorAddress);
    }

    // Convert to VersionedTransaction
    const versionedTransaction = new VersionedTransaction(transaction.compileMessage());

    return {
      success: true,
      transaction: Buffer.from(versionedTransaction.serialize()).toString('base64'),
      requiresSponsorship: !!FEE_PAYER_ADDRESS
    };

  } catch (error) {
    console.error('Error creating escrow transfer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create escrow transfer'
    };
  }
};

// Create token transfer transaction for manual mints (similar to send.ts)
export const createTokenTransferToVoucher = async (creatorAddress: string, voucherAddress: string, tokenAddress: string, amount: number) => {
  try {
    // Import Solana dependencies
    const { Connection, PublicKey, Transaction, VersionedTransaction } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const config = await getVerxioConfig();
    
    if (!config.rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }

    const connection = new Connection(config.rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(tokenAddress);
    
    // Get token mint info for decimals
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const amountSmallest = Math.round(amount * Math.pow(10, decimals));

    // Get associated token accounts
    const creatorATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(creatorAddress));
    const voucherATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(voucherAddress));

    // Create transaction
    const transaction = new Transaction();
    
    // Check if voucher ATA exists, create if not
    const voucherAccountInfo = await connection.getAccountInfo(voucherATA);
    if (!voucherAccountInfo) {
      // Fee payer covers ATA creation
      const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
      const payerAddress = FEE_PAYER_ADDRESS || creatorAddress;
      
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(payerAddress), // payer
          voucherATA, // associatedToken
          new PublicKey(voucherAddress), // owner
          tokenMint // mint
        )
      );
    }
    
    // Add transfer instruction from creator to voucher
    transaction.add(
      createTransferInstruction(
        creatorATA,
        voucherATA,
        new PublicKey(creatorAddress),
        amountSmallest
      )
    );

    // Get recent blockhash and set fee payer to sponsored fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Use sponsored fee payer (FEE_ADDRESS) for gas fees only
    const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
    if (FEE_PAYER_ADDRESS) {
      transaction.feePayer = new PublicKey(FEE_PAYER_ADDRESS);
    } else {
      transaction.feePayer = new PublicKey(creatorAddress);
    }

    // Convert to VersionedTransaction
    const versionedTransaction = new VersionedTransaction(transaction.compileMessage());

    return {
      success: true,
      transaction: Buffer.from(versionedTransaction.serialize()).toString('base64'),
      requiresSponsorship: !!FEE_PAYER_ADDRESS
    };

  } catch (error) {
    console.error('Error creating token transfer transaction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create token transfer transaction'
    };
  }
};

// Transfer tokens directly from creator to voucher address (for manual mints)
export const transferTokensToVoucher = async (creatorAddress: string, voucherAddress: string, tokenAddress: string, amount: number) => {
  try {
    // Import Solana dependencies
    const { Connection, PublicKey, Transaction, VersionedTransaction } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const config = await getVerxioConfig();
    
    if (!config.rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }

    const connection = new Connection(config.rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(tokenAddress);
    
    // Get token mint info for decimals
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const amountSmallest = Math.round(amount * Math.pow(10, decimals));

    // Get associated token accounts
    const creatorATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(creatorAddress));
    const voucherATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(voucherAddress));

    // Create transaction
    const transaction = new Transaction();
    
    // Check if voucher ATA exists, create if not
    const voucherAccountInfo = await connection.getAccountInfo(voucherATA);
    if (!voucherAccountInfo) {
      // Fee payer covers ATA creation since we're charging creator's Verxio balance
      const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
      const payerAddress = FEE_PAYER_ADDRESS!;
      
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(payerAddress), // fee payer covers ATA creation
          voucherATA, // associatedToken
          new PublicKey(voucherAddress), // owner
          tokenMint // mint
        )
      );
    }
    
    // Add transfer instruction from creator to voucher
    transaction.add(
      createTransferInstruction(
        creatorATA,
        voucherATA,
        new PublicKey(creatorAddress),
        amountSmallest
      )
    );

    // Get recent blockhash and set fee payer to sponsored fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Use sponsored fee payer (FEE_ADDRESS) for gas fees only
    const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
    if (FEE_PAYER_ADDRESS) {
      transaction.feePayer = new PublicKey(FEE_PAYER_ADDRESS);
    } else {
      transaction.feePayer = new PublicKey(creatorAddress);
    }

    // Convert to VersionedTransaction
    const versionedTransaction = new VersionedTransaction(transaction.compileMessage());

    return {
      success: true,
      transaction: Buffer.from(versionedTransaction.serialize()).toString('base64'),
      requiresSponsorship: !!FEE_PAYER_ADDRESS
    };

  } catch (error) {
    console.error('Error creating direct voucher transfer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create direct voucher transfer'
    };
  }
};

// Sponsor token transfer transaction (for manual mints) - same pattern as send.ts
export interface SponsorTokenTransferData {
  transaction: string
  voucherId: string
}

export interface SponsorEscrowTransferData {
  transaction: string
  rewardId: string
  totalTokenAmount?: number // For bulk transfers
}

export const sponsorTokenTransfer = async (
  data: SponsorTokenTransferData
): Promise<{ success: boolean; signature?: string; error?: string }> => {
  try {
    const { transaction: serializedTransaction, voucherId } = data;

    if (!serializedTransaction || !voucherId) {
      return { success: false, error: 'Missing transaction data or voucher ID' }
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

    // Verify voucher exists
    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId },
      select: { 
        id: true,
        recipient: true,
        voucherPublicKey: true
      }
    });

    if (!voucher) {
      return { success: false, error: 'Voucher not found' }
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

    // 5. Record the token transfer
    try {
      // Get voucher details for recording
      const voucher = await prisma.voucher.findUnique({
        where: { id: voucherId },
        select: {
          collectionId: true,
          voucherType: true,
          worth: true,
          collection: {
            select: {
              creator: true
            }
          }
        }
      });

      if (voucher && voucher.voucherType === 'TOKEN') {
        // Get token address from config
        const { getVerxioConfig } = await import('./loyalty');
        const configResult = await getVerxioConfig();
        
        if (configResult.usdcMint) {
          await recordTokenTransfer(
            voucher.collection.creator,
            configResult.usdcMint,
            voucher.worth || 0,
            'TO_VOUCHER',
            signature,
            voucherId,
            undefined,
            voucher.collectionId
          );
        }
      }
    } catch (recordError) {
      console.error('Failed to record token transfer:', recordError);
      // Don't fail the main operation if recording fails
    }

    return {
      success: true,
      signature: signature
    };

  } catch (error) {
    console.error('Error sponsoring token transfer:', error);
    return { 
      success: false, 
      error: 'Failed to sponsor token transfer' 
    };
  }
};

// Sponsor escrow transfer transaction (for reward links) - same pattern as sponsorTokenTransfer
export const sponsorEscrowTransfer = async (
  data: SponsorEscrowTransferData
): Promise<{ success: boolean; signature?: string; error?: string }> => {
  try {
    const { transaction: serializedTransaction, rewardId, totalTokenAmount } = data;

    if (!serializedTransaction || !rewardId) {
      return { success: false, error: 'Missing transaction data or reward ID' }
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

    // Verify reward link exists
    const rewardLink = await prisma.rewardLink.findUnique({
      where: { id: rewardId },
      select: { 
        id: true,
        creator: true,
        tokenAddress: true,
        voucherWorth: true
      }
    });

    if (!rewardLink) {
      return { success: false, error: 'Reward link not found' }
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

    // 5. Record the token transfer
    try {
      // Get reward link details for recording
      const reward = await prisma.rewardLink.findUnique({
        where: { id: rewardId },
        select: {
          collectionId: true,
          voucherType: true,
          voucherWorth: true,
          tokenAddress: true,
          symbol: true,
          creator: true
        }
      });

      if (reward && reward.voucherType === 'TOKEN' && reward.tokenAddress) {
        // For bulk transfers, record with the total amount, otherwise use individual reward amount
        const transferAmount = totalTokenAmount || reward.voucherWorth || 0;
        
        await recordTokenTransfer(
          reward.creator,
          reward.tokenAddress,
          transferAmount,
          'TO_ESCROW',
          signature,
          undefined,
          rewardId,
          reward.collectionId
        );
      }
    } catch (recordError) {
      console.error('Failed to record escrow transfer:', recordError);
      // Don't fail the main operation if recording fails
    }

    return {
      success: true,
      signature: signature
    };

  } catch (error) {
    console.error('Error sponsoring escrow transfer:', error);
    return { 
      success: false, 
      error: 'Failed to sponsor escrow transfer' 
    };
  }
};

// Transfer tokens from escrow to voucher address
export const transferTokensFromEscrow = async (voucherAddress: string, tokenAddress: string, amount: number) => {
  try {
    // Import Solana dependencies
    const { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddress,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
      getMint,
    } = await import('@solana/spl-token');
    const bs58 = await import('bs58');

    // Get Verxio config
    const { getVerxioConfig } = await import('@/app/actions/loyalty');
    const config = await getVerxioConfig();
    
    if (!config.rpcEndpoint) {
      throw new Error('RPC endpoint not configured');
    }

    // Escrow configuration
    const ESCROW_PRIVATE_KEY = process.env.ESCROW_PRIVATE_KEY;
    const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS;
    
    if (!ESCROW_PRIVATE_KEY || !ESCROW_ADDRESS) {
      throw new Error('Escrow not configured');
    }

    const connection = new Connection(config.rpcEndpoint, 'confirmed');
    const tokenMint = new PublicKey(tokenAddress);
    
    // Get token mint info for decimals
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;
    const amountSmallest = Math.round(amount * Math.pow(10, decimals));

    // Get associated token accounts
    const escrowATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(ESCROW_ADDRESS));
    const voucherATA = await getAssociatedTokenAddress(tokenMint, new PublicKey(voucherAddress));

    // Create transaction
    const transaction = new Transaction();
    
    // Check if voucher ATA exists, create if not
    const voucherAccountInfo = await connection.getAccountInfo(voucherATA);
    if (!voucherAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          new PublicKey(ESCROW_ADDRESS), // Escrow pays for ATA creation
          voucherATA,
          new PublicKey(voucherAddress),
          tokenMint
        )
      );
    }

    // Add transfer instruction from escrow to voucher
    transaction.add(
      createTransferInstruction(
        escrowATA,
        voucherATA,
        new PublicKey(ESCROW_ADDRESS),
        amountSmallest
      )
    );

    // Get recent blockhash and set fee payer to sponsored fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Use sponsored fee payer (FEE_ADDRESS) instead of escrow
    const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;
    const FEE_PAYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    let signature: string;
    
    if (FEE_PAYER_ADDRESS && FEE_PAYER_PRIVATE_KEY) {
      transaction.feePayer = new PublicKey(FEE_PAYER_ADDRESS);
      
      // Sign with both escrow and fee payer keys
      const escrowKeypair = Keypair.fromSecretKey(bs58.default.decode(ESCROW_PRIVATE_KEY));
      const feePayerKeypair = Keypair.fromSecretKey(bs58.default.decode(FEE_PAYER_PRIVATE_KEY));
      
      // Convert to VersionedTransaction
      const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
      versionedTransaction.sign([escrowKeypair, feePayerKeypair]);
      
      // Send transaction
      signature = await connection.sendTransaction(versionedTransaction);
    } else {
      // Fallback to escrow as fee payer
      transaction.feePayer = new PublicKey(ESCROW_ADDRESS);
      
      // Sign with escrow private key only
      const escrowKeypair = Keypair.fromSecretKey(bs58.default.decode(ESCROW_PRIVATE_KEY));
      
      // Convert to VersionedTransaction
      const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
      versionedTransaction.sign([escrowKeypair]);
      
      // Send transaction
      signature = await connection.sendTransaction(versionedTransaction);
    }

    return {
      success: true,
      signature: signature
    };

  } catch (error) {
    console.error('Error transferring from escrow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer from escrow'
    };
  }
};

export const createRewardLink = async (data: CreateRewardLinkData) => {
  try {
    const {
      creatorAddress,
      collectionId,
      voucherType,
      name,
      description,
      voucherWorth,
      valueSymbol,
      assetName,
      assetSymbol,
      tokenAddress,
      maxUses,
      expiryDate,
      transferable = false,
      conditions,
      imageUri,
      metadataUri
    } = data

    // Check if user has sufficient Verxio credits (minimum 1000 for regular, 3000 for TOKEN reward links)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    const requiredCredits = voucherType === 'TOKEN' ? 3000 : 1000
    if (!creditCheck.success || (creditCheck.balance || 0) < requiredCredits) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least ${requiredCredits} credits to create ${voucherType === 'TOKEN' ? 'TOKEN' : ''} reward links`
      }
    }

    // Ensure collection exists and belongs to creator
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Fetch collection details from blockchain for name/description
    let collectionName: string | null = null
    let collectionDescription: string | null = null
    if (collection.collectionPublicKey) {
      try {
        const details = await getVoucherCollectionDetails(collection.collectionPublicKey)
        if (details.success && details.data) {
          collectionName = details.data.name || null
          collectionDescription = details.data.description || null
        }
      } catch (e) {
        // Ignore and fallback below
      }
    }

    // Build metadata if not provided
    let finalMetadataUri = metadataUri || null
    if (!finalMetadataUri && imageUri) {
      const metadata = {
        name: name || collectionName || 'Reward Voucher',
        symbol: 'VERXIO-VOUCHER',
        description: `Voucher from ${collection.collectionName}`,
        image: imageUri,
        properties: {
          files: imageUri
            ? [{ uri: imageUri, type: 'image/png' }]
            : [],
          category: 'image',
          creators: [{ address: creatorAddress, share: 100 }]
        },
        attributes: [
          { trait_type: 'Voucher Type', value: voucherType },
          ...(typeof maxUses === 'number' ? [{ trait_type: 'Max Uses', value: String(maxUses) }] : []),
          ...(expiryDate ? [{ trait_type: 'Expiry Date', value: expiryDate.toISOString() }] : []),
          { trait_type: 'Status', value: 'Active' },
          { trait_type: 'Merchant ID',value: creatorAddress },
          ...(conditions ? [{ trait_type: 'Conditions', value: conditions }] : []),
          ...(assetName ? [{ trait_type: 'Asset Name', value: assetName }] : []),
          ...(assetSymbol ? [{ trait_type: 'Asset Symbol', value: assetSymbol }] : []),
          ...(tokenAddress ? [{ trait_type: 'Token Address', value: tokenAddress }] : [])
        ]
      }
      const stored = await storeMetadata(metadata as any)
      finalMetadataUri = stored
    }

    // Check token balance for TOKEN voucher types before processing
    if (voucherType === 'TOKEN' && tokenAddress && voucherWorth) {
      const balanceCheck = await checkTokenBalance(creatorAddress, tokenAddress, voucherWorth);
      
      if (!balanceCheck.success) {
        return {
          success: false,
          error: `Failed to check token balance: ${balanceCheck.error}`
        };
      }
      
      if (!balanceCheck.hasEnough) {
        return {
          success: false,
          error: `Insufficient token balance. Required: ${voucherWorth} tokens, Available: ${balanceCheck.balance || 0} tokens`
        };
      }
    }

    // Create a slug (simple cuid)
    const slug = `${Math.random().toString(36).slice(2, 12)}`

    // Create the reward link in database first
    const created = await prisma.rewardLink.create({
      data: {
        creator: creatorAddress,
        collectionId,
        slug,
        voucherType,
        name: (name || collectionName) || null,
        description: (description || collectionDescription) || null,
        voucherWorth: voucherWorth ?? null,
        maxUses: typeof maxUses === 'number' ? maxUses : null,
        expiryDate: expiryDate || null,
        transferable,
        conditions: conditions || null,
        imageUri: imageUri || null,
        metadataUri: finalMetadataUri || null,
        symbol: assetSymbol || valueSymbol || null,
        tokenAddress: tokenAddress || null
      }
    });

    // Deduct Verxio credits for creating reward link (2000 for TOKEN, 500 for others)
    const creditDeduction = voucherType === 'TOKEN' ? 2000 : 500
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: creditDeduction,
      assetAddress: collection.collectionPublicKey,
      assetOwner: creatorAddress,
      action: 'REVOKE'
    });

    if (!deductionResult.success) {
      console.error('Failed to deduct Verxio credits for reward link:', deductionResult.error)
    }

    // Handle token transfer to escrow for TOKEN voucher types
    if (voucherType === 'TOKEN' && tokenAddress && voucherWorth) {
      const escrowResult = await transferTokensToEscrow(
        creatorAddress,
        tokenAddress,
        voucherWorth
      );
      
      if (!escrowResult.success) {
        return {
          success: false,
          error: `Failed to transfer tokens to escrow: ${escrowResult.error}`
        };
      }
      
      // Return the transaction for frontend signing (sponsored)
      return {
        success: true,
        reward: created,
        requiresEscrowTransfer: true,
        escrowTransaction: escrowResult.transaction,
        requiresSponsorship: escrowResult.requiresSponsorship,
        message: 'Reward link created. Please sign the token transfer to escrow.'
      };
    }

    // For non-TOKEN voucher types, return success
    return { 
      success: true, 
      reward: created,
      message: 'Reward link created successfully'
    }
  } catch (error: any) {
    console.error('Error creating reward link:', error)
    return { success: false, error: error.message || 'Failed to create reward link' }
  }
}

export const getRewardLink = async (slugOrId: string) => {
  try {
    const reward = await prisma.rewardLink.findFirst({
      where: {
        OR: [{ id: slugOrId }, { slug: slugOrId }]
      }
    })
    if (!reward) return { success: false, error: 'Reward not found' }
    return { success: true, reward }
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch reward' }
  }
}

export const claimRewardLink = async (
  slugOrId: string,
  recipient: string,
  creatorAddress: string
): Promise<
  | { success: true; voucherAddress: string; voucherId: string }
  | { success: false; error: string }
> => {
  try {
    const rewardRes = await getRewardLink(slugOrId)
    if (!rewardRes.success || !rewardRes.reward) return { success: false, error: rewardRes.error || 'Reward not found' }
    const reward = rewardRes.reward as any

    // Check if already claimed
    if (reward.status === 'claimed') {
      return { success: false, error: 'This reward has already been claimed.' }
    }

    // Prepare mint data exactly like mintVoucher expects
    const mintData = {
      collectionId: reward.collectionId,
      recipient,
      voucherName: reward.name,
      voucherType: reward.voucherType,
      value: reward.voucherWorth,
      description: reward.description,
      expiryDate: reward.expiryDate,
      maxUses: reward.maxUses,
      transferable: !!reward.transferable,
      merchantId: creatorAddress,
      conditions: reward.conditions,
      voucherMetadataUri: reward.metadataUri
    }

    // If custom reward, replace type with custom value (label sent to chain)
    if (mintData.voucherType === 'CUSTOM_REWARD' && reward.customVoucherType) {
      mintData.voucherType = reward.customVoucherType
    }

    const minted = await mintVoucher(mintData, creatorAddress)
    if (!minted.success || !minted.voucher) {
      return { success: false, error: minted.error || 'Failed to mint voucher' }
    }

    // Handle token transfer from escrow for TOKEN voucher types
    if (reward.voucherType === 'TOKEN' && reward.tokenAddress && reward.voucherWorth) {
      const escrowTransferResult = await transferTokensFromEscrow(
        minted.voucher.voucherPublicKey,
        reward.tokenAddress,
        reward.voucherWorth
      );
      
      if (!escrowTransferResult.success) {
        console.error('Failed to transfer tokens from escrow:', escrowTransferResult.error);
        // Don't fail the claim if escrow transfer fails, but log the error
      }
    }

    // Mark reward link as claimed and store voucher address
    await prisma.rewardLink.update({
      where: { id: reward.id },
      data: { 
        status: 'claimed',
        voucherAddress: minted.voucher.voucherPublicKey
      }
    })

    // Bubble up identifiers saved by mintVoucher (voucher persisted in DB there)
    return {
      success: true,
      voucherAddress: minted.voucher.voucherPublicKey,
      voucherId: minted.voucher.id
    }
  } catch (error: any) {
    console.error('Error claiming reward link:', error)
    return { success: false, error: error.message || 'Failed to claim reward' }
  }
}

export const getRewardLinksForCollection = async (
  collectionId: string,
  creatorAddress: string
) => {
  try {
    const links = await prisma.rewardLink.findMany({
      where: { collectionId, creator: creatorAddress },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, links }
  } catch (error: any) {
    console.error('Error fetching reward links:', error)
    return { success: false, error: error.message || 'Failed to fetch reward links' }
  }
}

export interface BulkCreateRewardLinksData {
  creatorAddress: string
  collectionId: string
  voucherType: string
  name?: string
  description?: string
  voucherWorth?: number
  valueSymbol?: string
  assetName?: string
  assetSymbol?: string
  tokenAddress?: string
  maxUses?: number
  expiryDate?: Date
  transferable?: boolean
  conditions?: string
  imageUri?: string
  metadataUri?: string
  quantity: number
}

export const bulkCreateRewardLinks = async (data: BulkCreateRewardLinksData) => {
  try {
    const {
      creatorAddress,
      collectionId,
      voucherType,
      name,
      description,
      voucherWorth,
      valueSymbol,
      assetName,
      assetSymbol,
      tokenAddress,
      maxUses,
      expiryDate,
      transferable = false,
      conditions,
      imageUri,
      metadataUri,
      quantity
    } = data

    // Check if user has sufficient Verxio credits (2000 for TOKEN, 500 for others)
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    const creditPerReward = voucherType === 'TOKEN' ? 2000 : 500
    const totalCreditsNeeded = quantity * creditPerReward
    if (!creditCheck.success || (creditCheck.balance || 0) < totalCreditsNeeded) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least ${totalCreditsNeeded} credits to create ${quantity} ${voucherType === 'TOKEN' ? 'TOKEN' : ''} reward links.`
      }
    }

    // Check token balance for TOKEN voucher types
    if (voucherType === 'TOKEN' && tokenAddress && voucherWorth) {
      const totalTokensNeeded = voucherWorth * quantity;
      const balanceCheck = await checkTokenBalance(creatorAddress, tokenAddress, totalTokensNeeded);
      
      if (!balanceCheck.success) {
        return {
          success: false,
          error: `Failed to check token balance: ${balanceCheck.error}`
        };
      }
      
      if (!balanceCheck.hasEnough) {
        return {
          success: false,
          error: `Insufficient token balance. Required: ${totalTokensNeeded} tokens, Available: ${balanceCheck.balance || 0} tokens`
        };
      }
    }

    // Ensure collection exists and belongs to creator
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Fetch collection details from blockchain for name/description
    let collectionName: string | null = null
    let collectionDescription: string | null = null
    if (collection.collectionPublicKey) {
      try {
        const details = await getVoucherCollectionDetails(collection.collectionPublicKey)
        if (details.success && details.data) {
          collectionName = details.data.name || null
          collectionDescription = details.data.description || null
        }
      } catch (e) {
        // Ignore and fallback below
      }
    }

    // Build metadata if not provided
    let finalMetadataUri = metadataUri || null
    if (!finalMetadataUri && imageUri) {
      const metadata = {
        name: name || collectionName || 'Reward Voucher',
        symbol: 'VERXIO-VOUCHER',
        description: `Voucher from ${collection.collectionName}`,
        image: imageUri,
        properties: {
          files: imageUri
            ? [{ uri: imageUri, type: 'image/png' }]
            : [],
          category: 'image',
          creators: [{ address: creatorAddress, share: 100 }]
        },
        attributes: [
          { trait_type: 'Voucher Type', value: voucherType },
          ...(typeof maxUses === 'number' ? [{ trait_type: 'Max Uses', value: String(maxUses) }] : []),
          ...(expiryDate ? [{ trait_type: 'Expiry Date', value: expiryDate.toISOString() }] : []),
          { trait_type: 'Status', value: 'Active' },
          { trait_type: 'Merchant ID', value: creatorAddress },
          ...(conditions ? [{ trait_type: 'Conditions', value: conditions }] : []),
          ...(assetName ? [{ trait_type: 'Asset Name', value: assetName }] : []),
          ...(assetSymbol ? [{ trait_type: 'Asset Symbol', value: assetSymbol }] : []),
          ...(tokenAddress ? [{ trait_type: 'Token Address', value: tokenAddress }] : [])
        ]
      }
      const stored = await storeMetadata(metadata as any)
      finalMetadataUri = stored
    }

    // Create multiple reward links in a transaction
    const createdRewards = []
    for (let i = 0; i < quantity; i++) {
      // Create a unique slug for each reward link
      const slug = `${Math.random().toString(36).slice(2, 12)}${i}`

      const created = await prisma.rewardLink.create({
        data: {
          creator: creatorAddress,
          collectionId,
          slug,
          voucherType,
          name: (name || collectionName) || null,
          description: (description || collectionDescription) || null,
          voucherWorth: voucherWorth ?? null,
          maxUses: typeof maxUses === 'number' ? maxUses : null,
          expiryDate: expiryDate || null,
          transferable,
          conditions: conditions || null,
          imageUri: imageUri || null,
          metadataUri: finalMetadataUri || null,
          symbol: assetSymbol || valueSymbol || null,
          tokenAddress: tokenAddress || null
        }
      })

      createdRewards.push(created)

      // Deduct Verxio credits for each reward link created (2000 for TOKEN, 500 for others)
      const deductionResult = await awardOrRevokeLoyaltyPoints({
        creatorAddress,
        points: creditPerReward,
        assetAddress: collection.collectionPublicKey,
        assetOwner: creatorAddress,
        action: 'REVOKE'
      })

      if (!deductionResult.success) {
        console.error('Failed to deduct Verxio credits for reward link:', deductionResult.error)
      }
    }

    // Handle token transfer to escrow for TOKEN voucher types
    if (voucherType === 'TOKEN' && tokenAddress && voucherWorth) {
      const totalAmount = voucherWorth * quantity;
      const escrowResult = await transferTokensToEscrow(
        creatorAddress,
        tokenAddress,
        totalAmount
      );
      
      if (!escrowResult.success) {
        return {
          success: false,
          error: `Failed to transfer tokens to escrow: ${escrowResult.error}`
        };
      }
      
      // Return the transaction for frontend signing (sponsored)
      // Include all reward IDs for proper record keeping
      return {
        success: true,
        rewards: createdRewards,
        requiresEscrowTransfer: true,
        escrowTransaction: escrowResult.transaction,
        requiresSponsorship: escrowResult.requiresSponsorship,
        totalTokenAmount: totalAmount,
        message: `Reward links created. Please sign the token transfer to escrow (${totalAmount} tokens).`
      };
    }

    return { success: true, rewards: createdRewards }
  } catch (error: any) {
    console.error('Error bulk creating reward links:', error)
    return { success: false, error: error.message || 'Failed to bulk create reward links' }
  }
}

export interface DuplicateRewardLinksData {
  creatorAddress: string
  collectionId: string
  originalRewardId: string
  quantity: number
}

export const duplicateRewardLinks = async (data: DuplicateRewardLinksData) => {
  try {
    const { creatorAddress, collectionId, originalRewardId, quantity } = data

    // Check if user has sufficient Verxio credits
    const creditCheck = await getUserVerxioCreditBalance(creatorAddress)
    const totalCreditsNeeded = quantity * 500 // 500 credits per reward link
    if (!creditCheck.success || (creditCheck.balance || 0) < totalCreditsNeeded) {
      return {
        success: false,
        error: `Insufficient Verxio credits. You need at least ${totalCreditsNeeded} credits to duplicate ${quantity} reward links.`
      }
    }

    // Get the original reward link
    const originalReward = await prisma.rewardLink.findFirst({
      where: { 
        id: originalRewardId, 
        creator: creatorAddress,
        collectionId 
      }
    })

    if (!originalReward) {
      return { success: false, error: 'Original reward link not found' }
    }

    // Check token balance for TOKEN voucher types
    if (originalReward.voucherType === 'TOKEN' && originalReward.tokenAddress && originalReward.voucherWorth) {
      const totalTokensNeeded = originalReward.voucherWorth * quantity;
      const balanceCheck = await checkTokenBalance(creatorAddress, originalReward.tokenAddress, totalTokensNeeded);
      
      if (!balanceCheck.success) {
        return {
          success: false,
          error: `Failed to check token balance: ${balanceCheck.error}`
        };
      }
      
      if (!balanceCheck.hasEnough) {
        return {
          success: false,
          error: `Insufficient token balance. Required: ${totalTokensNeeded} tokens, Available: ${balanceCheck.balance || 0} tokens`
        };
      }
    }

    // Ensure collection exists
    const collection = await prisma.voucherCollection.findFirst({
      where: { id: collectionId, creator: creatorAddress },
      select: { id: true, collectionPublicKey: true }
    })
    if (!collection) {
      return { success: false, error: 'Collection not found' }
    }

    // Create multiple duplicate reward links
    const duplicatedRewards = []
    for (let i = 0; i < quantity; i++) {
      // Create a unique slug for each duplicate
      const slug = `${Math.random().toString(36).slice(2, 12)}${i}`

      const duplicated = await prisma.rewardLink.create({
        data: {
          creator: creatorAddress,
          collectionId,
          slug,
          voucherType: originalReward.voucherType,
          name: originalReward.name,
          description: originalReward.description,
          voucherWorth: originalReward.voucherWorth,
          maxUses: originalReward.maxUses,
          expiryDate: originalReward.expiryDate,
          transferable: originalReward.transferable,
          conditions: originalReward.conditions,
          imageUri: originalReward.imageUri,
          metadataUri: originalReward.metadataUri,
          symbol: originalReward.symbol,
          tokenAddress: originalReward.tokenAddress
        }
      })

      duplicatedRewards.push(duplicated)

      // Deduct Verxio credits for each duplicate created (2000 for TOKEN, 500 for others)
      const creditDeduction = originalReward.voucherType === 'TOKEN' ? 2000 : 500
      const deductionResult = await awardOrRevokeLoyaltyPoints({
        creatorAddress,
        points: creditDeduction,
        assetAddress: collection.collectionPublicKey,
        assetOwner: creatorAddress,
        action: 'REVOKE'
      })

      if (!deductionResult.success) {
        console.error('Failed to deduct Verxio credits for duplicate:', deductionResult.error)
      }
    }

    // Handle token transfer to escrow for TOKEN voucher types
    if (originalReward.voucherType === 'TOKEN' && originalReward.tokenAddress && originalReward.voucherWorth) {
      const totalTokensNeeded = originalReward.voucherWorth * quantity;
      const escrowResult = await transferTokensToEscrow(
        creatorAddress,
        originalReward.tokenAddress,
        totalTokensNeeded
      );
      
      if (!escrowResult.success) {
        return {
          success: false,
          error: `Failed to transfer tokens to escrow: ${escrowResult.error}`
        };
      }
      
      // Return the transaction for frontend signing (sponsored)
      return {
        success: true,
        rewards: duplicatedRewards,
        requiresEscrowTransfer: true,
        escrowTransaction: escrowResult.transaction,
        requiresSponsorship: escrowResult.requiresSponsorship,
        message: 'Reward links duplicated. Please sign the token transfer to escrow.'
      };
    }

    return { success: true, rewards: duplicatedRewards }
  } catch (error: any) {
    console.error('Error duplicating reward links:', error)
    return { success: false, error: error.message || 'Failed to duplicate reward links' }
  }
}


