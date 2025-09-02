'use server'

import { initializeSDK, createOrder, observeOrder as pajObserveOrder, getRate, RateType } from 'paj_ramp';
import { getVerxioConfig } from './loyalty';

// Initialize PAJ Ramp SDK with staging environment (can be changed to production)
initializeSDK(process.env.NODE_ENV === 'production' ? 'production' : 'staging');

export interface CreateFundingOrderData {
  fiatAmount: number;
  currency: string;
  recipient: string; // wallet address
  token: string; // verification token
}

export interface FundingOrderResult {
  success: boolean;
  order?: {
    id: string;
    accountNumber: string;
    accountName: string;
    fiatAmount: number;
    bank: string;
  };
  error?: string;
}

export const createFundingOrder = async (data: CreateFundingOrderData): Promise<FundingOrderResult> => {
  try {
    const { fiatAmount, currency, recipient, token } = data;

    // Validate required fields
    if (!fiatAmount || !currency || !recipient || !token) {
      return {
        success: false,
        error: 'Missing required fields'
      };
    }

    // Validate currency (currently only Nigeria is supported)
    if (currency !== 'NGN') {
      return {
        success: false,
        error: 'Currently only Nigerian Naira (NGN) is supported'
      };
    }

    // Get USDC mint from Verxio config
    const config = await getVerxioConfig();
    if (!config.usdcMint) {
      return {
        success: false,
        error: 'USDC mint not configured'
      };
    }

    // Create the funding order using PAJ Ramp SDK
    const order = await createOrder({
      fiatAmount,
      currency,
      recipient,
      mint: config.usdcMint,
      chain: 'SOLANA',
      token
    });

    return {
      success: true,
      order: {
        id: (order as any).id,
        accountNumber: (order as any).accountNumber,
        accountName: (order as any).accountName,
        fiatAmount: (order as any).fiatAmount,
        bank: (order as any).bank
      }
    };

  } catch (error: any) {
    console.error('Error creating funding order:', error);
    return {
      success: false,
      error: error.message || 'Failed to create funding order'
    };
  }
};

// Types for order status updates
export interface OrderUpdate {
  id: string;
  fiatAmount: string;
  currency: string;
  recipient: string;
  mint: string;
  chain: 'solana';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

// Observe order status updates
export const observeOrder = async (orderId: string) => {
  try {
    if (!orderId) {
      return {
        success: false,
        error: 'Order ID is required'
      };
    }

    // Use PAJ Ramp's observeOrder function to track status
    const observer = await pajObserveOrder({ orderId });
    
    return {
      success: true,
      observer
    };
  } catch (error: any) {
    console.error('Error observing order:', error);
    return {
      success: false,
      error: error.message || 'Failed to observe order'
    };
  }
};

// Get exchange rates from PAJ Ramp
export const getExchangeRate = async () => {
  try {
    // Get rates for onramp using the RateType enum
    const rates = await getRate(RateType.offRamp);
    return {
      success: true,
      data: rates
    };
  } catch (error: any) {
    console.error('Error fetching exchange rates:', error);
    return {
      success: false,
      error: error.message 
    };
  }
};

// Helper function to validate Solana wallet address format
export const validateSolanaWalletAddress = async (address: string): Promise<boolean> => {
  try {
    // Basic Solana address validation (base58, 32-44 chars)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  } catch {
    return false;
  }
};

// Helper function to get USDC token info for Solana
export const getUSDCTokenInfo = async () => {
  const config = await getVerxioConfig();
  return {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: config.usdcMint,
    chain: 'SOLANA',
    decimals: 6
  };
};
