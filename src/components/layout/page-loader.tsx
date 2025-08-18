"use client"

import { useEffect, useState } from 'react';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

export function PageLoader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Show loader for a brief moment to prevent flash
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <VerxioLoaderWhite size="lg" />
      </div>
    );
  }

  return null;
} 