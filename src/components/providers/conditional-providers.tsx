'use client';

import { usePathname } from 'next/navigation';
import { Providers } from '@/app/providers';
import { WalletProviders } from '@/app/providers-wallet';

export function ConditionalProviders({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Use wallet providers for payment routes
    const isPaymentRoute = pathname?.startsWith('/pay/')
    
        || pathname?.startsWith('/product/')
        // pathname?.startsWith('/payment/')
        // pathname?.startsWith('/claim/');

    if (isPaymentRoute) {
        return <WalletProviders>{children}</WalletProviders>;
    }

    // Use regular providers for other routes
    return <Providers>{children}</Providers>;
}
