
'use client';

import { useState, useEffect } from 'react';
import { ComingSoon } from '@/components/ui/coming-soon';
import { AppLayout } from '@/components/layout/app-layout';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

export default function Inbox() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Show loader for a brief moment
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <AppLayout currentPage="inbox">
        <div className="w-full flex items-center justify-center min-h-[calc(100vh-200px)]">
          <VerxioLoaderWhite size="md" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout currentPage="inbox">
       <ComingSoon />
    </AppLayout>
  );
} 