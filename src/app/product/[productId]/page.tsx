"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { getProductById, purchaseProduct } from '@/app/actions/product';
import { createOrUpdateUser } from '@/app/actions/user';
import { ArrowLeft, Check, ShoppingCart, ExternalLink, Loader2 } from 'lucide-react';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets, useSendTransaction } from '@privy-io/react-auth/solana';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';
import { Transaction, Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import { toast, ToastContainer } from 'react-toastify';
import { sponsorProductTransaction } from '@/app/actions/product';
import { getUserStats } from '@/app/actions/stats';
import 'react-toastify/dist/ReactToastify.css';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user, login, logout, authenticated, ready } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useSolanaWallets();
  const productId = useMemo(() => (params?.productId as string) || '', [params?.productId]);
  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState('1');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [transactionSignature, setTransactionSignature] = useState<string>('');
  const [isSponsored, setIsSponsored] = useState<boolean>(false);
  const [userBalance, setUserBalance] = useState<string>('0.00');
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      if (!productId) return;
      setIsLoading(true);
      try {
        const res = await getProductById(productId);
        if (res.success) setProduct(res.product);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [productId]);

  // Fetch user balance when user connects wallet
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.wallet?.address) return;

      try {
        setIsLoadingBalance(true);
        const result = await getUserStats(user.wallet.address);
        
        if (result.success && result.stats) {
          setUserBalance(result.stats.usdcBalance);
        }
      } catch (error) {
        console.error('Error fetching user balance:', error);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (authenticated && user?.wallet?.address) {
      fetchBalance();
    }
  }, [authenticated, user?.wallet?.address]);

  const handlePurchase = async () => {
    if (!user?.wallet?.address) {
      setError('Connect wallet to purchase');
      return;
    }
    if (!quantity || parseInt(quantity) <= 0) {
      setError('Enter a valid quantity');
      return;
    }
    if (product && !product.isProduct && parseInt(quantity) > 50) {
      setError('Maximum 50 units for services');
      return;
    }
    if (product && product.status !== 'ACTIVE') {
      setError('Product is not available for purchase');
      return;
    }

    setError(null);
    setPurchasing(true);
    setTransactionStatus('pending');

    try {
      // Ensure user account exists before purchasing
      await createOrUpdateUser({ walletAddress: user.wallet.address });

      // Calculate total amount in USDC
      const totalAmount = product.amount * parseInt(quantity);
      const fee = totalAmount * 0.005; // 0.5% fee
      const finalAmount = totalAmount + fee;

      // Create payment transaction
      const { buildPaymentTransaction } = await import('@/app/actions/payment');
      const buildResult = await buildPaymentTransaction({
        reference: `product-${productId}-${Date.now()}`,
        amount: finalAmount.toString(),
        recipient: product.creatorAddress,
        userWallet: user.wallet.address
      });

      if (!buildResult.success || !buildResult.transaction) {
        throw new Error(buildResult.error || 'Failed to build transaction');
      }

      const { transaction: serializedTx, connection: connectionConfig, sponsored } = buildResult;
      setIsSponsored(sponsored || false);
      let result;

      if (sponsored) {
        // For sponsored transactions, user signs their part, then backend adds fee payer signature
        const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

        if (!wallets || wallets.length === 0) {
          throw new Error('No Solana wallets available');
        }

        // For sponsored transactions, we need to sign the message, not the full transaction
        // First, convert to VersionedTransaction and get the message
        const versionedTransaction = new VersionedTransaction(transaction.compileMessage());
        
        // Serialize the message for signing
        const serializedMessage = Buffer.from(versionedTransaction.message.serialize());
        
        // Sign the message with the user's wallet
        const { signMessage } = wallets[0];
        const serializedUserSignature = await signMessage(serializedMessage);
        
        // Add user signature to transaction
        versionedTransaction.addSignature(new PublicKey(wallets[0].address), serializedUserSignature);
        
        // Serialize the partially signed transaction
        const serializedUserSignedTx = Buffer.from(versionedTransaction.serialize()).toString('base64');

        // Send to backend for fee payer signature and broadcasting
        const sponsorResult = await sponsorProductTransaction({
          transaction: serializedUserSignedTx
        });

        if (!sponsorResult.success) {
          throw new Error(sponsorResult.error || 'Failed to sponsor transaction');
        }

        result = { signature: sponsorResult.signature || '' };
      } else {
        // Regular transaction: User pays fees
        const transaction = Transaction.from(Buffer.from(serializedTx, 'base64'));

        if (!wallets || wallets.length === 0) {
          throw new Error('No Solana wallets available');
        }

        result = await sendTransaction({
          transaction: transaction,
          connection: new Connection(connectionConfig.endpoint, 'confirmed'),
          address: wallets[0].address
        });
      }

      // Update product after successful payment
      const res = await purchaseProduct({
        productId,
        buyerAddress: user.wallet.address,
        quantity: parseInt(quantity),
        transactionSignature: result.signature
      });

      if (res.success) {
        setTransactionStatus('success');
        setTransactionSignature(result.signature);
        setPurchased(true);
        toast.success(`Purchase successful! Signature: ${result.signature.slice(0, 8)}...`);
      } else {
        throw new Error(res.error || 'Failed to update product');
      }

    } catch (e: any) {
      setTransactionStatus('failed');
      setError(e.message || 'Failed to purchase');
      toast.error('Purchase failed. Please try again.');
      console.error('Purchase failed:', e);
    } finally {
      setPurchasing(false);
    }
  };

  const handleConnectWallet = async () => {
    if (!ready) return;

    if (authenticated) {
      await logout();
      window.location.reload();
      toast.info("Please select a new wallet", {
        position: "top-right",
        autoClose: 3000,
        theme: "dark",
      });
      login();
    } else {
      login();
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-black relative overflow-hidden">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <Tiles rows={50} cols={50} tileSize="md" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="relative w-10 h-10">
          <Image
            src="/logo/verxioIconWhite.svg"
            alt="Verxio"
            width={40}
            height={40}
            className="w-full h-full"
          />
        </div>

        <div className="flex items-center gap-4">
          {authenticated && (
            <>
              <span className="text-white text-sm">
                {user?.wallet?.address?.slice(0, 6)}...{user?.wallet?.address?.slice(-4)}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen pt-20 px-4">
        <div className="w-full max-w-md mx-auto space-y-6">
          {isLoading || !product ? (
            <div className="flex items-center justify-center py-16">
              <VerxioLoaderWhite size="md" />
            </div>
          ) : (
            purchased ? (
              <Card className="bg-black/50 border-white/10 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white text-center">Purchase Successful</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-center text-sm text-white/80 mb-4">
                    Your purchase has been completed successfully!
                  </div>
                  {product.redirectUrl && (
                    <div className="text-center">
                      <a
                        href={product.redirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                      >
                        Access Your {product.isProduct ? 'Product' : 'Service'}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
            <>
            {/* Product details */}
            <Card className="bg-black/50 border-white/10 text-white">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Product Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
              {product.enableReferral && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-200 text-sm">
                      {product.referralPercentage}% of the purchase amount will be awarded to the referrer
                    </p>
                  </div>
                )}
                
                {product.image && (
                  <div className="w-full h-48 overflow-hidden rounded-lg">
                    <img
                      src={product.image}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-zinc-400 text-sm">Type</p>
                    <p className="text-white font-medium">{product.isProduct ? 'Product' : 'Service'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Status</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      product.status === 'ACTIVE' ? 'border-green-500/50 text-green-400 bg-green-500/10' :
                      product.status === 'SOLD_OUT' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                      'border-gray-500/50 text-gray-400 bg-gray-500/10'
                    }`}>
                      {product.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Price</p>
                    <p className="text-white font-medium">${product.amount}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Points per Purchase</p>
                    <p className="text-white font-medium">{product.pointsPerPurchase}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Available Quantity</p>
                    <p className="text-white font-medium">{product.quantity}</p>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Total Sold</p>
                    <p className="text-white font-medium">{product.totalSold}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase */}
            <Card className="bg-black/50 border-white/10 text-white">
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-zinc-400 text-sm mb-2 block">Quantity</label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      max={product.isProduct ? undefined : 50}
                      disabled={!authenticated || product.status !== 'ACTIVE'}
                      className="bg-black/20 border-white/20 text-white placeholder:text-white/40 disabled:opacity-50"
                    />
                    {!product.isProduct && (
                      <p className="text-xs text-zinc-400 mt-1">Maximum 50 units for services</p>
                    )}
                  </div>
                  
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Price per unit:</span>
                      <span className="text-white font-medium">${product.amount} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Quantity:</span>
                      <span className="text-white font-medium">{quantity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Subtotal:</span>
                      <span className="text-white font-medium">${(product.amount * parseInt(quantity || '1')).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Fee (0.5%):</span>
                      <span className="text-white font-medium">${(product.amount * parseInt(quantity || '1') * 0.005).toFixed(4)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                      <span className="text-zinc-400 font-medium">Total:</span>
                      <span className="text-white font-bold">
                        {(() => {
                          const subtotal = product.amount * parseInt(quantity || '1');
                          const platformFee = Math.min(subtotal * 0.005, 5);
                          return `$${(subtotal + platformFee).toFixed(4)} USDC`;
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Points Awarded:</span>
                      <span className="text-white font-medium">{product.pointsPerPurchase * parseInt(quantity || '1')}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="text-xs text-red-400">{error}</div>
                  )}

                  {authenticated ? (
                    <button
                      onClick={handlePurchase}
                      disabled={!quantity || parseInt(quantity) <= 0 || product.status !== 'ACTIVE' || purchasing || isLoadingBalance || parseFloat(userBalance) < (product.amount * parseInt(quantity) + Math.min(product.amount * parseInt(quantity) * 0.005, 5))}
                      className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 justify-center text-sm">
                        {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                        <span>
                          {purchasing ? 'Processing Payment...' : 
                           isLoadingBalance ? 'Checking Balance...' :
                           parseFloat(userBalance) < (product.amount * parseInt(quantity) + Math.min(product.amount * parseInt(quantity) * 0.005, 5)) ? 'Insufficient Balance' :
                           product.status !== 'ACTIVE' ? 'Product not available' : 
                           'Pay with USDC'}
                        </span>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectWallet}
                      className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00adef] to-[#056f96] hover:from-[#0098d1] hover:to-[#0088c1] text-white"
                    >
                      Connect Wallet to Purchase
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
            </>
            )
          )}
        </div>
      </div>
      
      <ToastContainer
        position="top-right"
        autoClose={3000}
        theme="dark"
      />
    </div>
  );
}
