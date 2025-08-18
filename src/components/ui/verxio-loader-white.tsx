"use client"

import Image from 'next/image';

interface VerxioLoaderWhiteProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VerxioLoaderWhite({ size = 'md', className = '' }: VerxioLoaderWhiteProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const logoSize = {
    sm: 24,
    md: 32,
    lg: 40
  };

  return (
    <div className={`text-center ${className}`}>
      <div className={`relative ${sizeClasses[size]} mx-auto mb-4`}>
        {/* Spinning ring */}
        <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        {/* Logo */}
        <div className="absolute inset-4 flex items-center justify-center">
          <Image
            src="/logo/verxioIconWhite.svg"
            alt="Verxio"
            width={logoSize[size]}
            height={logoSize[size]}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
} 