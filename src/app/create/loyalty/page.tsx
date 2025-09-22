'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LoyaltyCheckoutCard } from '@/components/layout/create/loyalty/loyalty-checkout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

export default function LoyaltyPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Show loading for a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    // Navigate back to create page
    window.history.back();
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="create">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)] pt-8 pb-8">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="create">
      <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)] pt-24 pb-8">
        <LoyaltyCheckoutCard onClose={handleClose} />
      </div>
    </AppLayout>
  );
}
