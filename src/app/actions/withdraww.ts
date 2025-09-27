// 'use server'

// import { getUserByEmail } from './user'
// import { prisma } from '@/lib/prisma'

// export interface WithdrawTokenData {
//   voucherAddress: string
//   withdrawType: 'verxio' | 'external'
//   recipient: string // email for verxio, wallet address for external
//   amount: number
//   senderWalletAddress: string
// }

// export const withdrawTokens = async (data: WithdrawTokenData) => {
//   try {
//     let recipientWalletAddress: string

//     if (data.withdrawType === 'verxio') {
//       // Get the recipient user by email
//       const userResult = await getUserByEmail(data.recipient)

//       if (!userResult.success || !userResult.user) {
//         return { success: false, error: 'User not found with this email address' }
//       }

//       recipientWalletAddress = userResult.user.walletAddress
//     } else {
//       // External wallet - validate address format
//       if (!data.recipient.trim() || data.recipient.length < 32) {
//         return { success: false, error: 'Invalid wallet address format' }
//       }

//       recipientWalletAddress = data.recipient
//     }

//     // Get voucher details from database to verify ownership and get token info
//     const voucher = await prisma.voucher.findFirst({
//       where: {
//         voucherPublicKey: data.voucherAddress,
//         recipient: data.senderWalletAddress // Verify the sender owns this voucher
//       },
//       select: {
//         id: true,
//         voucherPublicKey: true,
//         worth: true,
//         collection: {
//           select: {
//             creator: true
//           }
//         }
//       }
//     })

//     if (!voucher) {
//       return { success: false, error: 'Voucher not found or you do not own this voucher' }
//     }

//     // Verify the withdrawal amount doesn't exceed voucher value
//     if (data.amount > (voucher.worth || 0)) {
//       return { success: false, error: 'Withdrawal amount exceeds voucher value' }
//     }

//     // Create withdraw record with PENDING status
//     const withdrawRecord = await prisma.transferRecord.create({
//       data: {
//         senderWalletAddress: data.senderWalletAddress,
//         recipientWalletAddress,
//         amount: data.amount,
//         sendType: data.withdrawType === 'verxio' ? 'VERXIO' : 'EXTERNAL',
//         status: 'PENDING'
//       }
//     })

//     return {
//       success: true,
//       message: `Withdrawal validated successfully!`,
//       recipientWalletAddress,
//       withdrawId: withdrawRecord.id,
//       voucherId: voucher.id,
//       voucherPublicKey: voucher.voucherPublicKey
//     }

//   } catch (error) {
//     console.error('Error withdrawing tokens:', error)

//     return {
//       success: false,
//       error: error instanceof Error ? error.message : 'Failed to withdraw tokens'
//     }
//   }
// }

// // Build withdraw transaction using Metaplex Core (following the doc example)
// export const buildWithdrawTransaction = async (
//   data: {
//     voucherAddress: string
//     recipientWallet: string
//     amount: number
//     voucherId: string
//     creatorAddress: string
//   }
// ): Promise<{ success: boolean; transaction?: string; instructions?: number; connection?: any; sponsored?: boolean; error?: string }> => {
//   try {
//     const { voucherAddress, recipientWallet, amount, voucherId, creatorAddress } = data;
    
//     if (!voucherAddress || !amount || !recipientWallet || !voucherId || !creatorAddress) {
//       return { success: false, error: 'Missing required fields' }
//     }

//     // Import Metaplex dependencies
//     const { publicKey, createSignerFromKeypair } = await import('@metaplex-foundation/umi');
//     const { initializeVerxio } = await import('./verxio');
//     const { getVerxioConfig } = await import('./loyalty');
//     const { getVoucherSecretKey } = await import('./voucher');
//     const { execute, fetchAsset, findAssetSignerPda, fetchCollection } = await import('@metaplex-foundation/mpl-core');
//     const { transferTokens, findAssociatedTokenPda } = await import('@metaplex-foundation/mpl-toolbox');
//     const { mplTokenMetadata } = await import('@metaplex-foundation/mpl-token-metadata');
//     const { mplToolbox } = await import('@metaplex-foundation/mpl-toolbox');

//     // Get voucher details and collection authority
//     const voucher = await prisma.voucher.findFirst({
//       where: {
//         id: voucherId,
//         collection: {
//           creator: creatorAddress
//         }
//       },
//       select: {
//         voucherPublicKey: true,
//         collection: {
//           select: {
//             collectionPublicKey: true
//           }
//         }
//       }
//     });

//     if (!voucher) {
//       return { success: false, error: 'Voucher not found or you do not own this voucher' }
//     }

//     // Get voucher collection authority secret key
//     const { getVoucherAuthoritySecretKey } = await import('./voucher');
//     const collectionKeyResult = await getVoucherSecretKey(voucher.id, creatorAddress);
//     if (!collectionKeyResult.success) {
//       return { success: false, error: collectionKeyResult.error }
//     }

//     // Get voucher details to determine token mint
//     const { getVoucherDetails } = await import('@/lib/voucher/getVoucherDetails');
//     const voucherDetails = await getVoucherDetails(voucher.voucherPublicKey);
    
//     if (!voucherDetails.success || !voucherDetails.data) {
//       return { success: false, error: 'Failed to fetch voucher details' }
//     }

//     // Get token mint from voucher metadata (Token Address attribute)
//     const tokenAddress = voucherDetails.data.attributes?.['Token Address'];
//     if (!tokenAddress) {
//       return { success: false, error: 'Token address not found in voucher metadata' }
//     }

//     // Get Verxio config
//     const configResult = await getVerxioConfig();
//     if (!configResult.rpcEndpoint) {
//       return { success: false, error: 'RPC endpoint not configured' }
//     }

//     // Initialize Verxio context
//     const initializeContext = await initializeVerxio(creatorAddress, configResult.rpcEndpoint, configResult.privateKey!);
//     if (!initializeContext.success || !initializeContext.context) {
//       return { success: false, error: `Initialization failed: ${initializeContext.error}` }
//     }

//     // Get the base UMI instance and register required programs
//     let umi = initializeContext.context.umi;
    
//     // Register required programs for SPL token operations
//     umi = umi.use(mplTokenMetadata()).use(mplToolbox());

//     // Fetch the asset (voucher)
//     const asset = await fetchAsset(umi, publicKey(voucher.voucherPublicKey));

//     // Optional - If Asset is part of collection fetch the collection object (following the doc example)
//     const collection = asset.updateAuthority.type === 'Collection' && asset.updateAuthority.address
//       ? await fetchCollection(umi, asset.updateAuthority.address)
//       : undefined;

//     // Get token mint
//     const splTokenMint = publicKey(tokenAddress);
//     // Asset signer has a balance of tokens (following the doc example)
//     const assetSignerPda = findAssetSignerPda(umi, { asset: publicKey(voucher.voucherPublicKey) });
//     // Create update authority signer using collection's authority secret key
//     const { convertSecretKeyToKeypair } = await import('@/lib/utils');
//     const updateAuthority = createSignerFromKeypair(umi, convertSecretKeyToKeypair(collectionKeyResult.voucherSecretKey));

//     // Destination wallet we wish to transfer the tokens to
//     const destinationWallet = publicKey(recipientWallet);

//     // Calculate amount in smallest units (assuming 6 decimals for most tokens)
//     const withdrawalAmountSmallest = Math.round(amount * Math.pow(10, 6));

//     // A standard `transferTokens()` transactionBuilder (following the doc example)
//     const transferTokensIx = transferTokens(umi, {
//       // Source is the `assetSignerPda` derived Token Account
//       source: findAssociatedTokenPda(umi, {
//         mint: splTokenMint,
//         owner: assetSignerPda[0], // Get the PublicKey from the PDA
//       }),
//       // Destination is the `destinationWallet` derived Token Account
//       destination: findAssociatedTokenPda(umi, {
//         mint: splTokenMint,
//         owner: destinationWallet,
//       }),
//       // Amount to send in lamports
//       amount: withdrawalAmountSmallest,
//     });

//     const res = await execute(umi, {
//       // Execute instruction(s) with this asset
//       asset,
//       collection,
//       assetSigner: assetSignerPda[0],
//       authority: updateAuthority,
//       payer: updateAuthority,
//       instructions: transferTokensIx,
//     }).sendAndConfirm(umi);

//     console.log('Withdraw transaction successful:', res);

//     return {
//       success: true,
//       transaction: res.signature.toString(),
//       instructions: 1,
//       sponsored: false,
//       connection: {
//         endpoint: configResult.rpcEndpoint,
//         commitment: "confirmed"
//       }
//     };

//   } catch (error) {
//     console.error('Error building withdraw transaction:', error);
//     return { 
//       success: false, 
//       error: `Failed to build withdraw transaction: ${error instanceof Error ? error.message : 'Unknown error'}` 
//     };
//   }
// }

// // Update withdraw status after successful transaction
// export const updateWithdrawStatus = async (withdrawId: string, signature: string) => {
//   try {
//     // Update withdraw status to SUCCESS
//     await prisma.transferRecord.update({
//       where: { id: withdrawId },
//       data: { 
//         status: 'SUCCESS',
//         transactionHash: signature
//       }
//     });

//     return { success: true }
//   } catch (error) {
//     console.error('Error updating withdraw status:', error)
//     return { 
//       success: false, 
//       error: error instanceof Error ? error.message : 'Failed to update withdraw status' 
//     }
//   }
// }
