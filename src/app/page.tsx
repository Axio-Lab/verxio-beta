'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Suspense } from 'react';
import { AuroraHero } from '@/components/layout/hero-section';
import { Tiles } from '@/components/layout/backgroundTiles';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

function HomeContent() {
  const { ready, } = usePrivy();

  if (!ready) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <AuroraHero />
        </div>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
