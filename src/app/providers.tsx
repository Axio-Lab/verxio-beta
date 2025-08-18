'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
            config={{

                loginMethods: ['google', 'email',],
                appearance: {
                    theme: '#ffffff',
                    accentColor: '#000000',
                    showWalletLoginFirst: false,
                    logo: "/logo/verxioLogoMain.svg",
                    walletChainType: "solana-only",
                    walletList: [
                        "detected_solana_wallets",
                    ]
                },
                embeddedWallets: {
                    solana: {
                        createOnLogin: 'users-without-wallets'
                    }
                },
                externalWallets: {
                    solana: {
                        connectors: toSolanaWalletConnectors()
                    }
                }
            }}
        >
            {children}
        </PrivyProvider>
    );
} 