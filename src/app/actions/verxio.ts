import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { revokeLoyaltyPoints, giftLoyaltyPoints, issueLoyaltyPass } from '@verxioprotocol/core'
import { VerxioContext, createLoyaltyProgram as createLoyaltyProgramCore } from '@verxioprotocol/core'
import { publicKey, signerIdentity, Signer, KeypairSigner, keypairIdentity, createSignerFromKeypair } from '@metaplex-foundation/umi'
import { convertSecretKeyToKeypair } from '@/lib/utils';

export interface Tier {
  name: string
  xpRequired: number
  rewards: string[]
}

export interface CreateLoyaltyProgramParams {
  loyaltyProgramName: string
  metadataUri: string
  updateAuthority: KeypairSigner
  metadata: {
    organizationName: string
    brandColor?: string
    [key: string]: any
  }
  tiers: Tier[]
  pointsPerAction: Record<string, number>
}

export interface RevokePointsParams {
  passAddress: string
  pointsToRevoke: number
  signer: KeypairSigner
}

export interface GiftPointsParams {
  passAddress: string
  pointsToGift: number
  signer: KeypairSigner
  action: string
}

export interface PointsResult {
  points: number
  signature: string
}

export interface IssueLoyaltyPassParams {
  collectionAddress: string
  recipient: string
  passName: string
  passMetadataUri: string
  assetSigner: KeypairSigner
  updateAuthority: KeypairSigner
  organizationName: string
}

export interface IssueLoyaltyPassResult {
  asset: KeypairSigner
  signature: string
}

export const initializeVerxio = async (walletPublicKey: string, rpcEndpoint: string, privateKey: string) => {
  try {
    const umi = createUmi(rpcEndpoint)
    const programAuthority = publicKey(walletPublicKey)
    
    const keypair = createSignerFromKeypair(umi, convertSecretKeyToKeypair(privateKey))
    // Set the signer identity
    // umi.use(signerIdentity(wallet))

    umi.use(signerIdentity(keypair))
    umi.use(keypairIdentity(keypair))
    
    
    const context: VerxioContext = {
      umi,
      programAuthority,
      collectionAddress: undefined,
    }

    return { success: true, context }
  } catch (error) {
    console.error('Error initializing Verxio:', error)
    return { success: false, error: `Failed to initialize Verxio program` }
  }
}

export const createLoyaltyProgram = async (context: VerxioContext, params: CreateLoyaltyProgramParams) => {
  try {
    const result = await createLoyaltyProgramCore(context, {
      ...params,
      programAuthority: context.programAuthority,
    })
    return { success: true, result }
  } catch (error) {
    console.error('Loyalty program creation error:', error)
    return { success: false, error: `Loyalty program creation failed` }
  }
}

export const issueNewLoyaltyPass = async (
    context: VerxioContext,
    params: IssueLoyaltyPassParams,
): Promise<IssueLoyaltyPassResult> => {
    try {
        const result = await issueLoyaltyPass(context, {
            collectionAddress: publicKey(params.collectionAddress),
            recipient: publicKey(params.recipient),
            passName: params.passName,
            passMetadataUri: params.passMetadataUri,
            assetSigner: params.assetSigner,
            updateAuthority: params.updateAuthority,
            organizationName: params.organizationName,
        })

        return result
    } catch (error) {
        console.error('Error issuing loyalty pass:', error)
        throw error
    }
}

export const revokePoints = async (context: VerxioContext, params: RevokePointsParams): Promise<PointsResult> => {
    try {
        const result = await revokeLoyaltyPoints(context, {
            passAddress: publicKey(params.passAddress),
            pointsToRevoke: params.pointsToRevoke,
            signer: params.signer,
        })

        return result
    } catch (error) {
        console.error('Error revoking loyalty points:', error)
        throw error
    }
}

export const giftPoints = async (context: VerxioContext, params: GiftPointsParams): Promise<PointsResult> => {
    try {
        const result = await giftLoyaltyPoints(context, {
            passAddress: publicKey(params.passAddress),
            pointsToGift: params.pointsToGift,
            signer: params.signer,
            action: params.action,
        })

        return result
    } catch (error) {
        console.error('Error gifting loyalty points:', error)
        throw error
    }
}

