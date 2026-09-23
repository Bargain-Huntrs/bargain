"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealEstateCalculator from "@/components/tools/RealEstateCalculator";

export default function RealEstateCalculatorPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <RealEstateCalculator />
      </main>
      <Footer />
    </div>
  );
}
