import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RoadmapClient from "./RoadmapClient";

export const metadata: Metadata = {
  title: "Feature Roadmap",
  description:
    "See what BargainHuntrs is building next — vote on feature requests and submit your own ideas.",
  openGraph: {
    title: "Feature Roadmap | BargainHuntrs",
    description:
      "See what BargainHuntrs is building next — vote on feature requests and submit your own ideas.",
  },
};

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <RoadmapClient />
      <Footer />
    </div>
  );
}
