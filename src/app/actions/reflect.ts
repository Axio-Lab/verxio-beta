'use server'

import { prisma } from '@/lib/prisma'
import { getVerxioConfig } from '@/app/actions/loyalty'
import { convertSecretKeyToKeypair } from '@/lib/utils'
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import BN from 'bn.js'
import bs58 from 'bs58'

// Reflect Money stablecoin SDK - dynamically imported to avoid bundling issues
type ActionResult = { success: true; signature: string } | { success: false; error: string }

async function getFeePayerKeypair(): Promise<Keypair> {
  const FEE_PAYER_PRIVATE_KEY = process.env.PRIVATE_KEY;
  const FEE_PAYER_ADDRESS = process.env.FEE_ADDRESS;

  if (!FEE_PAYER_PRIVATE_KEY || !FEE_PAYER_ADDRESS) {
    throw new Error('Fee payer not configured')
  }

  return Keypair.fromSecretKey(bs58.decode(FEE_PAYER_PRIVATE_KEY));
}

async function getVoucherKeypairByAddress(voucherAddress: string) {
  const voucher = await prisma.voucher.findFirst({
    where: { voucherPublicKey: voucherAddress },
    select: { voucherPrivateKey: true, voucherPublicKey: true },
  })
  if (!voucher?.voucherPrivateKey || !voucher?.voucherPublicKey) {
    throw new Error('Voucher not found or missing keys')
  }
  const keypair = convertSecretKeyToKeypair(voucher.voucherPrivateKey)
  return Keypair.fromSecretKey(keypair.secretKey)
}

export async function depositToEarnPool(params: { voucherAddress: string; amountUsdc: number }): Promise<ActionResult> {
  try {
    const { voucherAddress, amountUsdc } = params
    const config = await getVerxioConfig()
    const connection = new Connection(config.rpcEndpoint!, { commitment: 'confirmed' })

    // Get fee payer keypair
    const feePayerWallet = await getFeePayerKeypair();

    // Dynamic import here to keep bundling isolated to server only
    const { UsdcPlusStablecoin } = await import('@reflectmoney/stable.ts')
    const stablecoin = new UsdcPlusStablecoin(connection)
    await stablecoin.load()

    const userKeypair = await getVoucherKeypairByAddress(voucherAddress)

    const AMOUNT = new BN(Math.round(amountUsdc * 1e6))

    // 0.1% slippage protection
    const MIN_RECEIVED = AMOUNT.muln(999).divn(1000)

    const ix = await stablecoin.mint(userKeypair.publicKey, AMOUNT, MIN_RECEIVED)

    const { blockhash } = await connection.getLatestBlockhash()
    const { value: lookupTable } = await connection.getAddressLookupTable(stablecoin.lookupTable)

    const message = new TransactionMessage({
      instructions: ix,
      payerKey: feePayerWallet.publicKey, // Use fee payer as transaction payer
      recentBlockhash: blockhash,
    }).compileToV0Message(lookupTable ? [lookupTable] : [])

    const transaction = new VersionedTransaction(message)
    transaction.sign([feePayerWallet]) // Sign with fee payer

    const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false })
    return { success: true, signature }
  } catch (e: any) {
    // console.error('depositToEarnPool error:', {
    //   message: e?.message,
    //   stack: e?.stack,
    //   name: e?.name,
    //   error: e
    // });
    return { success: false, error: e?.message }
  }
}

export async function withdrawFromEarnPool(params: { voucherAddress: string; amountUsdcPlus: number }): Promise<ActionResult> {
  try {
    const { voucherAddress, amountUsdcPlus } = params
    const config = await getVerxioConfig()
    const connection = new Connection(config.rpcEndpoint!, { commitment: 'confirmed' })

    // Get fee payer keypair
    const feePayerWallet = await getFeePayerKeypair();

    // Dynamic import here to keep bundling isolated to server only
    const { UsdcPlusStablecoin } = await import('@reflectmoney/stable.ts')
    const stablecoin = new UsdcPlusStablecoin(connection)
    await stablecoin.load()

    const userKeypair = await getVoucherKeypairByAddress(voucherAddress)

    const AMOUNT = new BN(Math.round(amountUsdcPlus * 1e6))
    
    // USDC+ is yield bearing; expect slightly more USDC back
    const MIN_RECEIVED = AMOUNT.muln(1001).divn(1000)

    const ix = await stablecoin.redeem(userKeypair.publicKey, AMOUNT, MIN_RECEIVED)

    const { blockhash } = await connection.getLatestBlockhash()
    const { value: lookupTable } = await connection.getAddressLookupTable(stablecoin.lookupTable)

    const message = new TransactionMessage({
      instructions: ix,
      payerKey: feePayerWallet.publicKey, // Use fee payer as transaction payer
      recentBlockhash: blockhash,
    }).compileToV0Message(lookupTable ? [lookupTable] : [])

    const transaction = new VersionedTransaction(message)
    transaction.sign([feePayerWallet]) // Sign with fee payer

    const signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false })
    return { success: true, signature }
  } catch (e: any) {
    // console.error('withdrawFromEarnPool error:', {
    //   message: e?.message,
    //   stack: e?.stack,
    //   name: e?.name,
    //   error: e
    // });
    return { success: false, error: e?.message }
  }
}


