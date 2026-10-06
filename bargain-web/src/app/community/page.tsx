import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CommunityFeed from "@/components/CommunityFeed";

export const metadata: Metadata = {
  title: "Community Deals",
  description:
    "Deals and finds shared by the BargainHuntrs community — vote up the best, discuss, and post your own. No account needed.",
  openGraph: {
    title: "Community Deals | BargainHuntrs",
    description:
      "Deals and finds shared by the BargainHuntrs community — vote up the best, discuss, and post your own.",
  },
};

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <CommunityFeed />
      <Footer />
    </div>
  );
}
