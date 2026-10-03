"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import AiVerdict from "@/components/AiVerdict";
import { addUtmParameters, getPublicDeal, reportDeadDeal, type ArbitrageDeal } from "@/lib/api";

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
    ador: "ADOR",
    eufy: "Eufy",
    belkin: "Belkin",
    lenovo: "Lenovo",
    overstock: "Overstock",
    corsair: "Corsair",
    ace_hardware: "Ace Hardware",
  };
  return (
    map[retailer?.toLowerCase() || ""] ||
    (retailer ? retailer.charAt(0).toUpperCase() + retailer.slice(1).replace(/_/g, " ") : "Amazon")
  );
}

function formatDeal(deal: ArbitrageDeal) {
  const discount =
    deal.historical_avg && deal.historical_avg > deal.buy_price
      ? Math.round((1 - deal.buy_price / deal.historical_avg) * 100)
      : 0;
  const savings =
    deal.historical_avg && deal.historical_avg > deal.buy_price
      ? deal.historical_avg - deal.buy_price
      : 0;
  return { discount, savings };
}

export default function DealPageClient() {
  const router = useRouter();
  const [deal, setDeal] = useState<ArbitrageDeal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [deadReported, setDeadReported] = useState(false);

  const handleReportDead = async () => {
    if (!deal || deadReported) return;
    try {
      await reportDeadDeal(deal.id);
      setDeadReported(true);
    } catch {
      setDeadReported(true); // still show thanks — no error UI needed for a courtesy flag
    }
  };

  useEffect(() => {
    // Extract the deal ID from the URL pathname: /deals/:id
    const pathParts = window.location.pathname.split("/");
    const id = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    if (!id || id === "detail") {
      setError(true);
      setLoading(false);
      return;
    }

    getPublicDeal(id)
      .then((d) => {
        setDeal(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="mx-auto max-w-3xl">
            <div className="h-6 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-6 h-80 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
        <Header />
        <main className="flex-1 px-6 py-10">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Deal not found</h1>
            <p className="mt-2 text-zinc-500">This deal may have expired or been removed.</p>
            <Link href="/deals" className="mt-4 inline-block text-emerald-600 hover:underline">
              ← Back to deals
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { discount, savings } = formatDeal(deal);
  const retailer = retailerName(deal.retailer);

  const dealUrl = addUtmParameters(
    deal.buy_url || "",
    "bargainhuntrs",
    "deal_page",
    "deal_detail"
  );

  const dealDescription = savings
    ? `$${deal.buy_price.toFixed(2)} (was $${deal.historical_avg!.toFixed(2)}) at ${retailer}. Save $${savings.toFixed(2)}.`
    : `$${deal.buy_price.toFixed(2)} at ${retailer}.`;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.title,
    image: deal.image_url ? [deal.image_url] : undefined,
    description: dealDescription,
    brand: { "@type": "Brand", name: retailer },
    offers: {
      "@type": "Offer",
      price: deal.buy_price.toFixed(2),
      priceCurrency: "USD",
      url: deal.buy_url || `https://www.bargainhuntrs.com/deals/${deal.id}`,
      availability: deal.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      priceValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    },
  };

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/deals"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back to deals
          </Link>

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-6 sm:flex-row">
              {deal.image_url ? (
                <div className="relative aspect-square w-full max-w-[260px] flex-shrink-0 overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={deal.image_url}
                    alt={deal.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-square w-full max-w-[260px] items-center justify-center rounded-xl bg-zinc-50 text-6xl dark:bg-zinc-800">
                  🏷️
                </div>
              )}

              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-bold text-white dark:bg-zinc-50 dark:text-zinc-900">
                    {retailer}
                  </span>
                  {discount > 0 && (
                    <span className="rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white">
                      {discount}% OFF
                    </span>
                  )}
                </div>

                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-2xl">
                  {deal.title}
                </h1>

                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                    ${deal.buy_price.toFixed(2)}
                  </span>
                  {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                    <span className="text-lg text-zinc-400 line-through">
                      ${deal.historical_avg.toFixed(2)}
                    </span>
                  )}
                </div>

                {savings > 0 && (
                  <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Save ${savings.toFixed(2)}
                  </p>
                )}

                {dealUrl ? (
                  <a
                    href={dealUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex w-fit items-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
                  >
                    View Deal →
                  </a>
                ) : (
                  <p className="mt-6 text-sm text-zinc-500">No purchase link available.</p>
                )}

                {/* AI verdict — hidden unless AI is configured server-side */}
                <AiVerdict dealId={deal.id} />

                {/* Crowd verification — dead deals get reported, auto-archive at 5 */}
                <button
                  onClick={handleReportDead}
                  disabled={deadReported}
                  className="mt-3 block text-xs text-zinc-400 underline-offset-2 hover:text-red-500 hover:underline disabled:opacity-60"
                >
                  {deadReported ? "Thanks — reported" : "Dead deal? Report it"}
                </button>
              </div>
            </div>
          </div>

          <PriceHistoryChart deal={deal} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
