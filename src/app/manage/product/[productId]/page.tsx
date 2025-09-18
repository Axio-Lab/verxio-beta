"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppButton } from "@/components/ui/app-button";
import { VerxioLoaderWhite } from "@/components/ui/verxio-loader-white";
import { getProductById } from "@/app/actions/product";
import { ArrowLeft, Package, Users, TrendingUp, Copy, ExternalLink, Calendar } from "lucide-react";

interface Product {
  id: string;
  productName: string;
  amount: number;
  pointsPerPurchase: number;
  isProduct: boolean;
  quantity: number;
  maxQuantity: number;
  redirectUrl: string;
  image?: string;
  enableReferral: boolean;
  referralPercentage: number;
  status: string;
  totalSold: number;
  createdAt: string;
  updatedAt: string;
  purchases: ProductPurchase[];
}

interface ProductPurchase {
  id: string;
  buyerAddress: string;
  quantity: number;
  totalAmount: number;
  pointsAwarded: number;
  referralCode?: string;
  referralAddress?: string;
  referralPoints?: number;
  status: string;
  purchasedAt: string;
  user?: {
    email?: string;
    name?: string;
  };
}

export default function ProductDetailPage() {
  const { authenticated, user, ready } = usePrivy();
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      router.push('/');
      return;
    }

    fetchProduct();
  }, [authenticated, ready, router, productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const result = await getProductById(productId);
      
      if (result.success && result.product) {
        setProduct(result.product);
      } else {
        setError(result.error || 'Failed to fetch product');
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError('Failed to fetch product');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'INACTIVE':
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
      case 'SOLD_OUT':
        return 'text-red-400 bg-red-500/20 border-red-500/30';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'INACTIVE':
        return 'Inactive';
      case 'SOLD_OUT':
        return 'Sold Out';
      default:
        return status;
    }
  };

  if (!ready) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!authenticated) {
    return null;
  }

  if (loading) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <VerxioLoaderWhite size="lg" />
            <p className="text-white mt-4 text-lg">Loading product...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !product) {
    return (
      <AppLayout currentPage="dashboard">
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Product Not Found</h1>
            <p className="text-zinc-400 mb-6">{error || 'The product you are looking for does not exist.'}</p>
            <AppButton
              onClick={() => router.push('/manage/product')}
              variant="secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Products
            </AppButton>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <AppButton
            onClick={() => router.push('/manage/product')}
            variant="secondary"
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </AppButton>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-white">{product.productName}</h1>
            <p className="text-white/60 text-sm">Product Details & Sales Analytics</p>
          </div>
        </div>

        {/* Sales Analytics - Moved to top */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-zinc-400 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-white">${(product.amount * product.totalSold).toFixed(2).toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-zinc-400 text-sm">Total Sales</p>
                <p className="text-2xl font-bold text-white">{product.totalSold.toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-zinc-400 text-sm">Points Awarded</p>
                <p className="text-2xl font-bold text-white">{(product.pointsPerPurchase * product.totalSold).toLocaleString()}</p>
              </div>
              <div className="text-center p-4 bg-white/5 rounded-lg">
                <p className="text-zinc-400 text-sm">Conversion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {product.totalSold > 0 ? ((product.totalSold / (product.totalSold + product.quantity)) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Information */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
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
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}>
                  {getStatusText(product.status)}
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

            <div>
              <p className="text-zinc-400 text-sm mb-2">Redirect URL</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-medium flex-1 truncate">{product.redirectUrl}</p>
                <AppButton
                  onClick={() => copyToClipboard(product.redirectUrl)}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  {copied ? 'Copied!' : <Copy className="w-3 h-3" />}
                </AppButton>
                <AppButton
                  onClick={() => window.open(product.redirectUrl, '_blank')}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </AppButton>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-2">Share product link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-xs truncate text-white/80 border border-white/10 rounded-md px-3 py-2 bg-white/5">
                  {typeof window !== 'undefined' ? `${window.location.origin}/product/${productId}` : `/product/${productId}`}
                </div>
                <AppButton
                  onClick={async () => {
                    try {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/product/${productId}` : `/product/${productId}`;
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  {copied ? 'Copied!' : <Copy className="w-3 h-3" />}
                </AppButton>
                <AppButton
                  onClick={() => window.open(`/product/${productId}`, '_blank')}
                  variant="secondary"
                  className="text-xs px-2 py-1"
                >
                  <ExternalLink className="w-3 h-3" />
                </AppButton>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card className="bg-black/50 border-white/10 text-white">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5" />
              Recent Purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
            {product.purchases.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-4">No purchases yet</p>
            ) : (
              <div className="space-y-3">
                {product.purchases.slice(0, 5).map((purchase) => (
                  <div key={purchase.id} className="p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">
                        {purchase.buyerAddress.slice(0, 6)}...{purchase.buyerAddress.slice(-4)}
                      </span>
                      <span className="text-green-400 text-sm">${purchase.totalAmount}</span>
                    </div>
                    {purchase.user?.email && (
                      <div className="text-xs text-zinc-400 mb-1">
                        {purchase.user.email}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Qty: {purchase.quantity}</span>
                      <span>{new Date(purchase.purchasedAt).toLocaleDateString()}</span>
                    </div>
                    {purchase.referralCode && (
                      <div className="mt-1 text-xs text-blue-300">
                        Referral: {purchase.referralCode}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
