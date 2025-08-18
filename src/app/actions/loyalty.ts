'use server'

import { prisma } from '@/lib/prisma'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { publicKey } from '@metaplex-foundation/umi'
import { VerxioContext, getProgramDetails } from '@verxioprotocol/core'

const RPC_ENDPOINT = `${process.env.RPC_URL}?api-key=${process.env.HELIUS_API_KEY}`;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDC_MINT = process.env.USDC_MINT;

export const getVerxioConfig = async () => {
  return {
    rpcEndpoint: RPC_ENDPOINT,
    privateKey: PRIVATE_KEY,
    usdcMint: USDC_MINT
  };
}

export interface CreateLoyaltyProgramData {
  creator: string
  programPublicKey: string
  programSecretKey: string
  signature: string
  authorityPublicKey: string
  authoritySecretKey: string
}

export const saveLoyaltyProgram = async (data: CreateLoyaltyProgramData) => {
  try {
    const loyaltyProgram = await prisma.loyaltyProgram.create({
      data: {
        creator: data.creator,
        programPublicKey: data.programPublicKey,
        programSecretKey: data.programSecretKey,
        signature: data.signature,
        authorityPublicKey: data.authorityPublicKey,
        authoritySecretKey: data.authoritySecretKey,
      }
    })

    return { success: true, data: loyaltyProgram }
  } catch (error) {
    console.error('Error saving loyalty program:', error)
    return { success: false, error: 'Failed to save loyalty program' }
  }
}

export const getUserLoyaltyPrograms = async (userWallet: string) => {
  try {
    const programs = await prisma.loyaltyProgram.findMany({
      where: {
        creator: userWallet
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return { success: true, programs }
  } catch (error) {
    console.error('Error fetching loyalty programs:', error)
    return { success: false, error: 'Failed to fetch loyalty programs' }
  }
}

export const getLoyaltyProgramDetails = async (creator: string, programPublicKey: string) => {
  try {
    const umi = createUmi(RPC_ENDPOINT)
    const context: VerxioContext = {
      umi,
      programAuthority: publicKey(creator),
      collectionAddress: publicKey(programPublicKey),
    }

    const programDetails = await getProgramDetails(context)

    return { success: true, programDetails }
  } catch (error) {
    console.error('Error fetching loyalty program details:', error)
    return { success: false, error: 'Failed to fetch program details' }
  }
}

export const getCollectionAuthoritySecretKey = async (collectionAddress: string) => {
  try {
    const loyaltyProgram = await prisma.loyaltyProgram.findFirst({
      where: {
        programPublicKey: collectionAddress
      },
      select: {
        authoritySecretKey: true,
        authorityPublicKey: true
      }
    })

    if (!loyaltyProgram) {
      return { success: false, error: 'Loyalty program not found for this collection address' }
    }

    return { 
      success: true, 
      authoritySecretKey: loyaltyProgram.authoritySecretKey,
      authorityPublicKey: loyaltyProgram.authorityPublicKey
    }
  } catch (error) {
    console.error('Error fetching collection authority secret key:', error)
    return { success: false, error: 'Failed to fetch authority secret key' }
  }
}

export const getLoyaltyProgramUsers = async (collectionAddress: string) => {
  try {
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        "jsonrpc": "2.0",
        "id": "1",
        "method": "getAssetsByGroup",
        "params": {
          "groupKey": "collection",
          "groupValue": collectionAddress
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, users: data.result || [] };
  } catch (error) {
    console.error('Error fetching loyalty program users:', error);
    return { success: false, error: 'Failed to fetch loyalty program users' };
  }
}

export const getTotalMembersAcrossPrograms = async (programAddresses: string[]) => {
  try {
    let totalMembers = 0;
    
    for (const programAddress of programAddresses) {
      const result = await getLoyaltyProgramUsers(programAddress);
      if (result.success && result.users) {
        totalMembers += result.users.total;
      }
    }
    
    return { success: true, totalMembers };
  } catch (error) {
    console.error('Error counting total members:', error);
    return { success: false, error: 'Failed to count total members' };
  }
}

export const getUserLoyaltyPasses = async (userWallet: string) => {
  try {
    // Fetch all NFTs owned by the user
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        "jsonrpc": "2.0",
        "id": "1",
        "method": "getAssetsByOwner",
        "params": {
          "ownerAddress": userWallet,
          "page": 1,
          "limit": 1000,
          "sortBy": {
            "sortBy": "created",
            "sortDirection": "asc"
          },
          "options": {
            "showUnverifiedCollections": false,
            "showCollectionMetadata": false,
            "showGrandTotal": false,
            "showFungible": false,
            "showNativeBalance": false,
            "showInscription": false,
            "showZeroBalance": false
          }
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const userAssets = data.result?.items;
    
    // Filter assets that belong to loyalty programs in our database
    const loyaltyPasses = [];
    
    for (const asset of userAssets) {
      // Check if this asset belongs to a collection (loyalty program)
      if (asset.grouping && asset.grouping.length > 0) {
        const collectionGroup = asset.grouping.find((group: any) => group.group_key === 'collection');
        if (collectionGroup) {
          const collectionAddress = collectionGroup.group_value;
          
          // Check if this collection exists in our database
          const loyaltyProgram = await prisma.loyaltyProgram.findFirst({
            where: {
              programPublicKey: collectionAddress
            },
            select: {
              creator: true,
              programPublicKey: true
            }
          });
          
          if (loyaltyProgram) {
            // Extract loyalty pass data from the asset
            const loyaltyData = asset.external_plugins?.[0]?.data;
            if (loyaltyData) {
              loyaltyPasses.push({
                assetId: asset.id,
                collectionAddress: collectionAddress,
                programCreator: loyaltyProgram.creator,
                nftName: asset.content?.metadata?.name,
                organizationName: loyaltyData.organization_name,
                xp: loyaltyData.xp || 0,
                currentTier: loyaltyData.current_tier,
                lastAction: loyaltyData.last_action,
                tierUpdatedAt: loyaltyData.tier_updated_at,
                rewards: loyaltyData.rewards,
                owner: asset.ownership?.owner
              });
            }
          }
        }
      }
    }

    return { success: true, loyaltyPasses };
  } catch (error) {
    console.error('Error fetching user loyalty passes:', error);
    return { success: false, error: 'Failed to fetch user loyalty passes' };
  }
}

export const checkUserLoyaltyProgramMembership = async (userWallet: string, loyaltyProgramAddress: string) => {
  try {
    // First, get the loyalty program details from our database to access tiers
    const loyaltyProgram = await prisma.loyaltyProgram.findFirst({
      where: {
        programPublicKey: loyaltyProgramAddress
      },
      select: {
        creator: true,
        programPublicKey: true
      }
    });

    if (!loyaltyProgram) {
      return { success: false, error: 'Loyalty program not found in database' };
    }

    // Fetch all NFTs owned by the user
    const url = RPC_ENDPOINT;
    const options = {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        "jsonrpc": "2.0",
        "id": "1",
        "method": "getAssetsByOwner",
        "params": {
          "ownerAddress": userWallet,
          "page": 1,
          "limit": 1000,
          "sortBy": {
            "sortBy": "created",
            "sortDirection": "asc"
          },
          "options": {
            "showUnverifiedCollections": false,
            "showCollectionMetadata": false,
            "showGrandTotal": false,
            "showFungible": false,
            "showNativeBalance": false,
            "showInscription": false,
            "showZeroBalance": false
          }
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const userAssets = data.result?.items || [];
    
    // Check if user has any assets in the specified loyalty program
    for (const asset of userAssets) {
      if (asset.grouping && asset.grouping.length > 0) {
        const collectionGroup = asset.grouping.find((group: any) => group.group_key === 'collection');
        if (collectionGroup && collectionGroup.group_value === loyaltyProgramAddress) {
          // User belongs to this loyalty program
          const loyaltyData = asset.external_plugins?.[0]?.data;
          if (loyaltyData) {
            // Get program details including tiers
            const programDetails = await getLoyaltyProgramDetails(
              loyaltyProgram.creator,
              loyaltyProgramAddress
            );

            return {
              success: true,
              isMember: true,
              membershipData: {
                assetId: asset.id,
                xp: loyaltyData.xp || 0,
                currentTier: loyaltyData.current_tier,
                rewards: loyaltyData.rewards,
                loyaltyProgram: {
                  address: loyaltyProgramAddress,
                  tiers: programDetails.programDetails?.tiers,
                  name: programDetails.programDetails?.name 
                }
              }
            };
          }
        }
      }
    }

    // User is not a member of this loyalty program
    // Still return program details for potential future use
    const programDetails = await getLoyaltyProgramDetails(
      loyaltyProgram.creator,
      loyaltyProgramAddress
    );

    return {
      success: true,
      isMember: false,
      membershipData: null,
      programDetails: programDetails.success ? {
        address: loyaltyProgramAddress,
        creator: loyaltyProgram.creator,
        tiers: programDetails.programDetails?.tiers || [],
        pointsPerAction: programDetails.programDetails?.pointsPerAction || {},
        name: programDetails.programDetails?.name || 'Unknown Program'
      } : null
    };

  } catch (error) {
    console.error('Error checking loyalty program membership:', error);
    return { success: false, error: 'Failed to check loyalty program membership' };
  }
}
