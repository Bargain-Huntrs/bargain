import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import FeedbackWidget from "@/components/FeedbackWidget";
import GoogleAnalytics from "@/app/components/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "BargainHuntrs — Find It, Flip It, Profit";
const description =
  "Discover the best deals, discounts, and arbitrage opportunities from Amazon, Walmart, and more.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bargainhuntrs.com"),
  title: {
    default: title,
    template: "%s | BargainHuntrs",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    url: "https://www.bargainhuntrs.com",
    title: "BargainHuntrs — Find It, Flip It, Profit",
    description:
      "Discover the best deals, discounts, and arbitrage opportunities from Amazon, Walmart, and more.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BargainHuntrs — Find It, Flip It, Profit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "BargainHuntrs — Find It, Flip It, Profit",
    description:
      "Discover the best deals, discounts, and arbitrage opportunities from Amazon, Walmart, and more.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="p:domain_verify" content="668ecc0f3284e738c81ab6e51a58213d" />
        <meta name="theme-color" content="#18181b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bargain Huntrs" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="impact-site-verification" content="c2aacb17-49a0-4116-b515-be1a7e596103" />
        <meta name="Impact-Site-Verification" content="c2aacb17-49a0-4116-b515-be1a7e596103" />
        <meta name="impact-site-verification" content="566d9ee4-d392-4d5c-9123-f95164f06883" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Impact tracking script for affiliate verification */}
        <Script
          id="impact-tracking"
          type="text/javascript"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A1208408-03fa-4fd4-a07a-20e974bc746d1.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`,
          }}
        />
        <AuthProvider>{children}</AuthProvider>
        <FeedbackWidget />
        <PwaInstallPrompt />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
