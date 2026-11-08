import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { PrefsProvider } from "@/lib/prefs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "CediX — Crypto Trading for Ghana", template: "%s | CediX" },
  description:
    "Trade crypto with Ghanaian Cedis. Spot trading, P2P, instant MoMo deposits & fiat withdrawals via Payteller, staking, savings and the Orbit community.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply saved theme before hydration to avoid a flash (light is default) */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"try{if(localStorage.getItem('cedix_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}"}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <PrefsProvider>
          <Suspense>{children}</Suspense>
        </PrefsProvider>
      </body>
    </html>
  );
}
