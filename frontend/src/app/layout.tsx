import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import { Navigation } from "@/components/layout/Navigation";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Moments Money — NFT-Backed Lending on Flow",
  description:
    "Borrow FLOW tokens against your NBA Top Shot Moments and other Flow NFTs.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-100 font-sans">
        <Providers>
          <Navigation />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
