
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { Signer, Transaction, publicKey, signerIdentity, keypairIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi'
import { toWeb3JsTransaction, fromWeb3JsTransaction, fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import bs58 from 'bs58'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { Keypair as Web3JsKeypair } from '@solana/web3.js'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
} 

export const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const createPrivySigner = (wallet: any, walletPublicKey: string): Signer => ({
  publicKey: publicKey(walletPublicKey),

  signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
    try {
      // For Privy, we need to pass the account as an object with address
      const account = { address: walletPublicKey } as any
      
      const signatureResult = await wallet.signMessage({
        message: message,
        account: account
      })
      
      // Extract signature from array and convert to Uint8Array
      const signature = signatureResult[0]?.signature
      console.log("signature", signature);
      if (!signature) throw new Error('No signature returned')
      
      // Convert signature to Uint8Array if it's not already
      if (typeof signature === 'string') {
        return new Uint8Array(Buffer.from(signature, 'base64'))
      } else if (signature instanceof Uint8Array) {
        return signature
      } else {
        throw new Error('Unexpected signature format')
      }
    } catch (error) {
      console.error('Error signing message with Privy:', error)
      throw error
    }
  },

  signTransaction: async (
    transaction: Transaction
  ): Promise<Transaction> => {
    try {
      const web3Transaction = toWeb3JsTransaction(transaction)
      
      // For Privy, we need to pass the account as an object with address
      const account = { address: walletPublicKey } as any
      
      // // Serialize the transaction to Uint8Array
      // const serializedTransaction = web3Transaction.serialize()
      
      const signedWeb3Transaction = await wallet.signTransaction({
        account: account,
        transaction: web3Transaction
      })
      
      // Extract signed transaction from array
      const signedTx = signedWeb3Transaction[0]?.signedTransaction
      if (!signedTx) throw new Error('No signed transaction returned')
      
      // Convert the signed transaction data back to UMI format
      if (signedTx instanceof Uint8Array) {
        // If it's already a Uint8Array, we need to reconstruct the transaction
        // For now, return the original transaction as a fallback
        console.warn('Signed transaction is Uint8Array, returning original')
        return transaction
      } else {
        // If it's a proper transaction object, convert it
        return fromWeb3JsTransaction(signedTx)
      }
    } catch (error) {
      console.error('Error signing transaction with Privy:', error)
      throw error
    }
  },

  signAllTransactions: async (
    transactions: Transaction[]
  ): Promise<Transaction[]> => {
    try {
      // Sign each transaction individually
      const signedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          return await createPrivySigner(wallet, walletPublicKey).signTransaction(transaction)
        })
      )

      return signedTransactions
    } catch (error) {
      console.error(
        'Error signing multiple transactions with Privy:',
        error
      )
      throw error
    }
  },
})


export function convertSecretKeyToKeypair(secretKey: string) {
  try {
    const secretKeyBytes = bs58.decode(secretKey)
    const keypair = Web3JsKeypair.fromSecretKey(secretKeyBytes)
    return fromWeb3JsKeypair(keypair)
  } catch (error) {
    console.error('Error converting secret key:', error)
    throw new Error('Invalid secret key format')
  }
}

export function uint8ArrayToBase58String(uint8Array: Uint8Array): string {
  return bs58.encode(uint8Array);
}

export function initializeVerxioContext(walletPublicKey: string, config: { rpcEndpoint: string; privateKey: string }, collectionAddress?: string) {

  const umi = createUmi(config.rpcEndpoint);
  const programAuthority = publicKey(walletPublicKey);
  const PRIVATE_KEY = config.privateKey;
  const keypair = createSignerFromKeypair(umi, convertSecretKeyToKeypair(PRIVATE_KEY));
  
  umi.use(signerIdentity(keypair));
  umi.use(keypairIdentity(keypair));
  
  return {
    umi,
    programAuthority,
    collectionAddress: collectionAddress ? publicKey(collectionAddress) : undefined,
  };
}
