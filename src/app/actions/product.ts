'use server'

import { prisma } from '@/lib/prisma';
import { getUserVerxioCreditBalance, awardOrRevokeLoyaltyPoints } from './verxio-credit';

export interface CreateProductData {
  creatorAddress: string;
  productName: string;
  amount: number;
  pointsPerPurchase: number;
  isProduct: boolean;
  quantity: number;
  redirectUrl: string;
  image?: string;
  enableReferral: boolean;
  referralPercentage: number;
}

export interface CreateProductResult {
  success: boolean;
  product?: {
    id: string;
    productName: string;
    status: string;
  };
  error?: string;
  requiredCredits?: number;
  currentBalance?: number;
}

export const createProduct = async (data: CreateProductData): Promise<CreateProductResult> => {
  try {
    const {
      creatorAddress,
      productName,
      amount,
      pointsPerPurchase,
      isProduct,
      quantity,
      redirectUrl,
      image,
      enableReferral,
      referralPercentage
    } = data;

    // Validate required fields
    if (!creatorAddress || !productName || !redirectUrl) {
      return {
        success: false,
        error: 'Missing required fields'
      };
    }

    // Validate quantity
    if (quantity <= 0) {
      return {
        success: false,
        error: 'Quantity must be greater than 0'
      };
    }

    // For services, limit quantity to 50
    if (!isProduct && quantity > 50) {
      return {
        success: false,
        error: 'Service quantity cannot exceed 50'
      };
    }

    // Calculate required credits
    const requiredCredits = pointsPerPurchase * quantity;

    // Get user's current Verxio credit balance
    const userCredits = await getUserVerxioCreditBalance(creatorAddress);
    
    if (!userCredits.success) {
      return {
        success: false,
        error: 'Failed to fetch user credits',
        requiredCredits,
        currentBalance: 0
      };
    }

    const currentBalance = userCredits.balance || 0;

    // Check if user has enough credits
    if (currentBalance < requiredCredits) {
      return {
        success: false,
        error: `Insufficient Verxio credits. Required: ${requiredCredits}, Available: ${currentBalance}`,
        requiredCredits,
        currentBalance: currentBalance
      };
    }

    // Create the product in database
    const product = await prisma.product.create({
      data: {
        creatorAddress,
        productName,
        amount,
        pointsPerPurchase,
        isProduct,
        quantity,
        maxQuantity: 50,
        redirectUrl,
        image,
        enableReferral,
        referralPercentage,
        status: 'ACTIVE'
      }
    });

    // Deduct the required credits from user's balance
    const deductionResult = await awardOrRevokeLoyaltyPoints({
      creatorAddress,
      points: requiredCredits,
      assetAddress: product.id,
      assetOwner: creatorAddress,
      action: 'REVOKE' // REVOKE = deduct credits
    });

    if (!deductionResult.success) {
      // If credit deduction fails, delete the product and return error
      await prisma.product.delete({
        where: { id: product.id }
      });
      
      return {
        success: false,
        error: 'Failed to deduct credits. Product creation cancelled.',
        requiredCredits,
        currentBalance: currentBalance
      };
    }

    return {
      success: true,
      product: {
        id: product.id,
        productName: product.productName,
        status: product.status
      }
    };

  } catch (error: any) {
    console.error('Error creating product:', error);
    return {
      success: false,
      error: error.message || 'Failed to create product'
    };
  }
};

export const getUserProducts = async (creatorAddress: string, page: number = 1, limit: number = 10) => {
  try {
    const skip = (page - 1) * limit;

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: {
          creatorAddress
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
        select: {
          id: true,
          productName: true,
          amount: true,
          pointsPerPurchase: true,
          isProduct: true,
          quantity: true,
          totalSold: true,
          status: true,
          enableReferral: true,
          referralPercentage: true,
          createdAt: true
        }
      }),
      prisma.product.count({
        where: {
          creatorAddress
        }
      })
    ]);

    return {
      success: true,
      products,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error: any) {
    console.error('Error fetching user products:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch products'
    };
  }
};

export const getProductById = async (productId: string) => {
  try {
    const product = await prisma.product.findUnique({
      where: {
        id: productId
      },
      include: {
        purchases: {
          orderBy: {
            purchasedAt: 'desc'
          }
        }
      }
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found'
      };
    }

    // Fetch user emails for each purchase
    const purchasesWithUsers = await Promise.all(
      product.purchases.map(async (purchase: any) => {
        const user = await prisma.user.findUnique({
          where: { walletAddress: purchase.buyerAddress },
          select: { email: true, name: true }
        });
        return { ...purchase, user };
      })
    );

    return {
      success: true,
      product: {
        ...product,
        purchases: purchasesWithUsers
      }
    };
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch product'
    };
  }
};

// Purchase product
export interface PurchaseProductData {
  productId: string;
  buyerAddress: string;
  quantity: number;
  referralCode?: string;
}

export interface PurchaseProductResult {
  success: boolean;
  purchase?: {
    id: string;
    status: string;
  };
  error?: string;
}

export const purchaseProduct = async (data: PurchaseProductData): Promise<PurchaseProductResult> => {
  try {
    const { productId, buyerAddress, quantity, referralCode } = data;

    // Validate required fields
    if (!productId || !buyerAddress || !quantity) {
      return {
        success: false,
        error: 'Product ID, buyer address, and quantity are required'
      };
    }

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return {
        success: false,
        error: 'Product not found'
      };
    }

    if (product.status !== 'ACTIVE') {
      return {
        success: false,
        error: 'Product is not available for purchase'
      };
    }

    // Check if product has enough quantity
    if (product.quantity < quantity) {
      return {
        success: false,
        error: 'Insufficient quantity available'
      };
    }

    // Calculate total amount and points
    const totalAmount = product.amount * quantity;
    const pointsAwarded = product.pointsPerPurchase * quantity;

    // Create purchase record
    const purchase = await prisma.productPurchase.create({
      data: {
        productId,
        buyerAddress,
        quantity,
        totalAmount,
        pointsAwarded,
        referralCode,
        status: 'COMPLETED'
      }
    });

    // Update product quantity and total sold
    await prisma.product.update({
      where: { id: productId },
      data: {
        quantity: { decrement: quantity },
        totalSold: { increment: quantity }
      }
    });

    // Award points to buyer
    try {
      await awardOrRevokeLoyaltyPoints({
        creatorAddress: product.creatorAddress,
        points: pointsAwarded,
        assetAddress: productId,
        assetOwner: buyerAddress,
        action: 'AWARD'
      });
    } catch (creditError) {
      console.error('Error awarding credits for purchase:', creditError);
      // We do not fail purchase if awarding fails
    }

    // Handle referral if enabled and code provided
    if (product.enableReferral && referralCode) {
      // TODO: Implement referral logic here
      // This will be implemented later when we work on referral links
    }

    return {
      success: true,
      purchase: {
        id: purchase.id,
        status: purchase.status
      }
    };

  } catch (error: any) {
    console.error('Error purchasing product:', error);
    return {
      success: false,
      error: error.message || 'Failed to purchase product'
    };
  }
};

// Get all products (for browsing)
export const getAllProducts = async (limit: number = 20, offset: number = 0) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        productName: true,
        amount: true,
        pointsPerPurchase: true,
        isProduct: true,
        quantity: true,
        totalSold: true,
        image: true,
        enableReferral: true,
        referralPercentage: true,
        createdAt: true
      }
    });

    return {
      success: true,
      products
    };
  } catch (error: any) {
    console.error('Error fetching all products:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch products'
    };
  }
};
