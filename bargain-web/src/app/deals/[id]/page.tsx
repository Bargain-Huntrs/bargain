import type { Metadata } from "next";
import DealPageClient from "../detail/DealPageClient";

// Dynamic deal detail route: /deals/:id
// Static sibling routes (today, best, calendar, etc.) take precedence over this
// dynamic segment in Next.js routing, so they are unaffected.
// The client component reads the deal ID from window.location.pathname.
export function generateStaticParams() {
  // No deal IDs are known at build time; all are rendered on demand.
  // Returning [] keeps `output: "export"` (legacy CF Pages path) buildable.
  return [];
}

export const metadata: Metadata = {
  title: "Deal Details | BargainHuntrs",
  description: "View this deal on BargainHuntrs — find it, flip it, profit.",
  openGraph: {
    type: "website",
    title: "Deal Details | BargainHuntrs",
    description: "View this deal on BargainHuntrs — find it, flip it, profit.",
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Deal Details | BargainHuntrs",
    description: "View this deal on BargainHuntrs — find it, flip it, profit.",
  },
};

export default function DealByIdPage() {
  return <DealPageClient />;
}
