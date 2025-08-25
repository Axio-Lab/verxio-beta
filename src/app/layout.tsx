import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ConditionalProviders } from "@/components/providers/conditional-providers";
import { Tiles } from "@/components/layout/backgroundTiles";
import { PageLoader } from "@/components/layout/page-loader";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Verxio Checkout",
  description: "Verxio's loyalty native checkout experience",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} antialiased bg-black`}>
        <Tiles
          rows={50}
          cols={50}
          tileSize="md"
        />
        <PageLoader />
        <div className="relative z-10">
          <ConditionalProviders>
            {children}
          </ConditionalProviders>
        </div>
      </body>
    </html>
  );
}
