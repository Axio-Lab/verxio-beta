'use client';

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';
import { usePrivy } from '@privy-io/react-auth';
import { getUserProducts } from '@/app/actions/product';
import { useRouter } from 'next/navigation';
import { Plus, Package, DollarSign, ArrowLeft } from 'lucide-react';
import { AppButton } from '@/components/ui/app-button';

interface Product {
  id: string;
  productName: string;
  amount: number;
  pointsPerPurchase: number;
  isProduct: boolean;
  quantity: number;
  totalSold: number;
  status: string;
  enableReferral: boolean;
  referralPercentage: number;
  createdAt: string;
}

export default function ManageProductsPage() {
  const { user } = usePrivy();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const load = async (page: number = currentPage) => {
    if (!user?.wallet?.address) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await getUserProducts(user.wallet.address, page, 10);
      if (res.success && res.products) {
        setProducts(res.products as Product[]);
        setPagination(res.pagination);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.wallet?.address]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    load(page);
  };

  return (
    <AppLayout currentPage="dashboard">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <AppButton
            onClick={() => router.push('/dashboard')}
            variant="secondary"
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </AppButton>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-white">Product Management</h1>
            <p className="text-white/60 text-sm">Create and manage your products</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push('/create/product')}
            className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 text-left transition-all duration-300 hover:scale-105 backdrop-blur-sm group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-200 shadow-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Create Product</div>
            <div className="text-xs text-white/60 font-medium">Start selling</div>
          </button>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Products</div>
            <div className="text-xl font-bold text-green-400">{products.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Revenue</div>
            <div className="text-xl font-bold text-purple-400">
              ${products.reduce((sum, product) => sum + (product.amount * product.totalSold), 0).toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg text-left backdrop-blur-sm">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg flex items-center justify-center mb-2 shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-white">Total Sales</div>
            <div className="text-xl font-bold text-orange-400">
              {products.reduce((sum, product) => sum + product.totalSold, 0)}
            </div>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-900/90 border border-white/10 text-white overflow-hidden relative">
          <CardHeader className="relative z-10 pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg text-white font-semibold">My Products</CardTitle>
              {pagination && (
                <div className="text-xs text-white/60">
                  Showing {((currentPage - 1) * 10) + 1}-{Math.min(currentPage * 10, pagination.total)} of {pagination.total} products
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <VerxioLoaderWhite size="md" />
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-8 text-white/60">No products yet</div>
            ) : (
              <>
                <div className="space-y-3">
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => router.push(`/manage/product/${product.id}`)}
                      className="w-full p-4 bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-lg hover:border-white/25 hover:bg-white/10 transition-all duration-300 hover:scale-105 backdrop-blur-sm text-left"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-white">{product.productName}</div>
                        <div className="text-xs text-blue-400 font-medium">{product.status}</div>
                      </div>
                      <div className="text-xs text-white/60">
                        ${product.amount} • {product.totalSold.toLocaleString()} sold • {product.quantity.toLocaleString()} available
                      </div>
                      <div className="text-[10px] text-white/40 mt-1">
                        {product.isProduct ? 'Product' : 'Service'} • {product.pointsPerPurchase} $VERXIO per purchase
                      </div>
                      {product.enableReferral && (
                        <div className="text-[10px] text-blue-300 mt-1">
                          Referral: {product.referralPercentage}% commission
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-xs rounded-lg ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-white/20 hover:bg-white/10 text-white'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      {pagination.totalPages > 5 && (
                        <>
                          <span className="text-white/60">...</span>
                          <button
                            onClick={() => handlePageChange(pagination.totalPages)}
                            className={`px-3 py-2 text-xs rounded-lg ${
                              currentPage === pagination.totalPages
                                ? 'bg-blue-600 text-white'
                                : 'border border-white/20 hover:bg-white/10 text-white'
                            }`}
                          >
                            {pagination.totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                      className="px-3 py-2 text-xs border border-white/20 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
