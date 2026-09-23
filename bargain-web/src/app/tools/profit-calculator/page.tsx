"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProfitCalculator from "@/components/tools/ProfitCalculator";

export default function ProfitCalculatorPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <ProfitCalculator />
      </main>
      <Footer />
    </div>
  );
}
