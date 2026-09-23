"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListingGenerator from "@/components/tools/ListingGenerator";

export default function ListingGeneratorPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <ListingGenerator />
      </main>
      <Footer />
    </div>
  );
}
