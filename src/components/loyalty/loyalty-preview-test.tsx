'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { LoyaltyProgramPreview } from '@/components/loyalty/loyalty-program-preview';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

// Sample data for testing
const sampleLoyaltyProgram = {
  image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=500&h=500&fit=crop&crop=center",
  loyaltyName: "Coffee Rewards",
  organizationName: "Starbucks",
  tiers: [
    { id: '1', name: 'Bronze', xpRequired: 500, discount: 2, discountType: 'percentage' as const },
    { id: '2', name: 'Silver', xpRequired: 1000, discount: 5, discountType: 'percentage' as const },
    { id: '3', name: 'Gold', xpRequired: 2000, discount: 10, discountType: 'percentage' as const }
  ],
  pointActions: [
    { id: '1', action: 'Purchase', points: 100 },
    { id: '2', action: 'Referral', points: 50 },
    { id: '3', action: 'Review', points: 25 }
  ]
};

export default function TaskPage() {
  const [isLoading, setIsLoading] = useState(true);

  // Show loading for a brief moment
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <AppLayout currentPage="create">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)] pt-24 pb-8">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="create">
      <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)] pt-24 pb-8">
        <LoyaltyProgramPreview
          image={sampleLoyaltyProgram.image}
          loyaltyName={sampleLoyaltyProgram.loyaltyName}
          organizationName={sampleLoyaltyProgram.organizationName}
          tiers={sampleLoyaltyProgram.tiers}
          pointActions={sampleLoyaltyProgram.pointActions}
          className="mx-auto"
        />
      </div>
    </AppLayout>
  );
} 