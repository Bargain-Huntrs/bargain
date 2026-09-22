import type { Metadata } from "next";

const TITLE =
  "Real Estate Deal Calculator — 70% Rule, Flip ROI & Rental Yield | BargainHuntrs";
const DESCRIPTION =
  "Free real estate bargain calculator. Run the 70% rule / MAO on any property, calculate flip ROI with holding and closing costs, and check rental yield and cap rate before you buy.";
const URL = "https://www.bargainhuntrs.com/tools/real-estate-calculator";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "real estate deal calculator",
    "70% rule calculator",
    "MAO calculator",
    "maximum allowable offer calculator",
    "house flipping calculator",
    "flip roi calculator",
    "rental yield calculator",
    "cap rate calculator",
    "arv calculator",
    "wholesale deal calculator",
  ],
  alternates: { canonical: "/tools/real-estate-calculator" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "BargainHuntrs",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RealEstateCalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
