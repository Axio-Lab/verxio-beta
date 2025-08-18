'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { CreateCheckoutCard } from '@/components/layout/create/create-checkout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

export default function Create() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Show loading for a brief moment, then show checkout
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsCheckoutOpen(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = (optionId: string) => {
    console.log(`Selected checkout type: ${optionId}`);
    // The CreateCheckoutCard component handles routing internally
    // We just need to close the modal
    setIsCheckoutOpen(false);
  };

  const handleClose = () => {
    setIsCheckoutOpen(false);
  };

  if (isLoading) {
    return (
      <AppLayout currentPage="create">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="create">
      <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)] pt-24 pb-8">
        <CreateCheckoutCard
          isOpen={isCheckoutOpen}
          onClose={handleClose}
          onSelect={handleSelect}
        />
      </div>
    </AppLayout>
  );
} 