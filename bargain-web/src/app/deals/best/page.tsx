import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";

export const metadata: Metadata = {
  title: "Best Deals This Week — Save Up to 70% | BargainHuntrs",
  description:
    "Find the best deals this week on Amazon, Walmart, and more. Updated daily with the highest ROI arbitrage opportunities.",
  alternates: { canonical: "/deals/best" },
  openGraph: {
    title: "Best Deals This Week — Save Up to 70% | BargainHuntrs",
    description:
      "Find the best deals this week on Amazon, Walmart, and more. Updated daily with the highest ROI arbitrage opportunities.",
    url: "/deals/best",
  },
};

function discountPercent(deal: ArbitrageDeal): number {
  if (deal.historical_avg && deal.historical_avg > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.historical_avg) * 100);
  }
  if (deal.original_buy_price && deal.original_buy_price > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.original_buy_price) * 100);
  }
  return 0;
}

function retailerName(retailer?: string): string {
  if (!retailer) return "Amazon";
  const map: Record<string, string> = {
    amazon: "Amazon",
    walmart: "Walmart",
    target: "Target",
    best_buy: "Best Buy",
    bestbuy: "Best Buy",
    home_depot: "Home Depot",
    homedepot: "Home Depot",
    lowes: "Lowe's",
    costco: "Costco",
    ebay: "eBay",
    newegg: "Newegg",
    woot: "Woot",
    bhphoto: "B&H Photo",
  };
  return (
    map[retailer.toLowerCase()] ||
    retailer.charAt(0).toUpperCase() + retailer.slice(1).replace(/_/g, " ")
  );
}

export default async function BestDealsPage() {
  let deals: ArbitrageDeal[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(100, 0);
    // Sort by ROI (desc), fall back to net_profit, then take top 20
    deals = data
      .slice()
      .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0) || (b.net_profit ?? 0) - (a.net_profit ?? 0))
      .slice(0, 20);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load deals";
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/deals"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back to all deals
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Best Deals This Week
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The top 20 deals ranked by ROI and profit. Updated daily with the
            highest-value arbitrage opportunities from Amazon, Walmart, and more.
          </p>

          {error ? (
            <div className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          ) : deals.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No deals available right now. Check back soon — our scanners
                update throughout the day.
              </p>
            </div>
          ) : (
            <>
              <AffiliateDisclosure className="mt-6" />
            <div className="mt-4 space-y-3">
              {deals.map((deal, idx) => {
                const discount = discountPercent(deal);
                const retailer = retailerName(deal.retailer);
                return (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="group flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div className="relative flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                      {deal.image_url ? (
                        <img
                          src={deal.image_url}
                          alt={deal.title}
                          className="h-full w-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl">
                          🏷️
                        </div>
                      )}
                      <div className="absolute top-1 left-1 rounded-md bg-zinc-900 px-1.5 py-0.5 text-xs font-bold text-white">
                        #{idx + 1}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {retailer}
                        </span>
                        {discount > 0 && (
                          <span className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                            {discount}% OFF
                          </span>
                        )}
                        {deal.roi != null && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            {Math.round(deal.roi)}% ROI
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 mb-2">
                        {deal.title}
                      </h3>

                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                          ${deal.buy_price.toFixed(2)}
                        </span>
                        {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                          <span className="text-sm text-zinc-400 line-through">
                            ${deal.historical_avg.toFixed(2)}
                          </span>
                        )}
                        {deal.net_profit != null && (
                          <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            Profit ${deal.net_profit.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
