'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tiles } from '@/components/layout/backgroundTiles';
import Image from 'next/image';
import { VerxioLoaderWhite } from '@/components/ui/verxio-loader-white';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: 'vault' | 'dashboard' | 'create' | 'inbox' | 'profile';
}

export function AppLayout({ children, currentPage }: AppLayoutProps) {
  const { authenticated, logout, ready } = usePrivy();
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    if (!ready) return;
    
    if (!authenticated) {
      router.push('/');
    } else {
      // Small delay to prevent flash of content
      const timer = setTimeout(() => {
        setIsCheckingAuth(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [authenticated, ready, router]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10">
          <VerxioLoaderWhite size="lg" />
          <p className="text-white mt-4 text-lg text-center">Checking Authentication...</p>
        </div>
      </div>
    );
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative">
        <Tiles rows={50} cols={50} tileSize="md" />
        <div className="relative z-10">
          <VerxioLoaderWhite size="md" />
          {/* <p className="text-white mt-4 text-lg text-center">Loading App...</p> */}
        </div>
      </div>
    );
  }

  const getNavItemClass = (page: string) => {
    return currentPage === page ? 'text-foreground' : 'text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Background Stars */}
      <Tiles 
        rows={50} 
        cols={50}
        tileSize="md"
      />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <div className="relative w-10 h-10">
            <Image
              src="/logo/verxioIconWhite.svg"
              alt="Verxio"
              width={40}
              height={40}
              className="w-full h-full"
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={logout}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 text-white relative z-10">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-sm border-t border-white/10">
        <div className="flex justify-around py-2">
          <button 
            onClick={() => router.push('/vault')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-white/10 ${getNavItemClass('vault')}`}
          >
            <svg className={`w-6 h-6 mb-1 ${currentPage === 'vault' ? 'text-[#00adef]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className={`text-xs ${currentPage === 'vault' ? 'text-[#00adef]' : 'text-white'}`}>Vault</span>
          </button>
          <button 
            onClick={() => router.push('/dashboard')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-white/10 ${getNavItemClass('dashboard')}`}
          >
            <svg className={`w-6 h-6 mb-1 ${currentPage === 'dashboard' ? 'text-[#00adef]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className={`text-xs ${currentPage === 'dashboard' ? 'text-[#00adef]' : 'text-white'}`}>Dashboard</span>
          </button>
          <button 
            onClick={() => router.push('/create')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-white/10 ${getNavItemClass('create')}`}
          >
            <svg className={`w-6 h-6 mb-1 ${currentPage === 'create' ? 'text-[#00adef]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className={`text-xs ${currentPage === 'create' ? 'text-[#00adef]' : 'text-white'}`}>Create</span>
          </button>
          <button 
            onClick={() => router.push('/inbox')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-white/10 ${getNavItemClass('inbox')}`}
          >
            <svg className={`w-6 h-6 mb-1 ${currentPage === 'inbox' ? 'text-[#00adef]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <span className={`text-xs ${currentPage === 'inbox' ? 'text-[#00adef]' : 'text-white'}`}>Inbox</span>
          </button>
          <button 
            onClick={() => router.push('/profile')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors hover:bg-white/10 ${getNavItemClass('profile')}`}
          >
            <svg className={`w-6 h-6 mb-1 ${currentPage === 'profile' ? 'text-[#00adef]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className={`text-xs ${currentPage === 'profile' ? 'text-[#00adef]' : 'text-white'}`}>Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}