"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import {
  getPublicDeals,
  getDeals,
  trackAffiliateClick,
  clickAffiliatePublic,
  addUtmParameters,
  type ArbitrageDeal,
} from "@/lib/api";

type SectionKey = "trending" | "drops" | "profit";

const SECTION_PAGE_SIZE = 12;

function discountPercent(deal: ArbitrageDeal): number {
  if (deal.historical_avg && deal.historical_avg > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.historical_avg) * 100);
  }
  if (deal.original_buy_price && deal.original_buy_price > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.original_buy_price) * 100);
  }
  return 0;
}

function savingsAmount(deal: ArbitrageDeal): number {
  if (deal.historical_avg && deal.historical_avg > deal.buy_price) {
    return deal.historical_avg - deal.buy_price;
  }
  if (deal.original_buy_price && deal.original_buy_price > deal.buy_price) {
    return deal.original_buy_price - deal.buy_price;
  }
  return 0;
}

/** Trending score: a blended rank combining profit, ROI, and discount. */
function trendingScore(deal: ArbitrageDeal): number {
  const profit = deal.net_profit ?? 0;
  const roi = deal.roi ?? 0; // already a percentage (e.g. 120 = 120%)
  const discount = discountPercent(deal);
  // Weighted blend — profit in dollars, roi & discount as percentages.
  return profit * 1.0 + roi * 0.5 + discount * 0.3;
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

export default function TrendingDealsClient() {
  const router = useRouter();
  const { idToken } = useAuth();

  const [allDeals, setAllDeals] = useState<ArbitrageDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<SectionKey>("trending");
  const [visibleCounts, setVisibleCounts] = useState<Record<SectionKey, number>>({
    trending: SECTION_PAGE_SIZE,
    drops: SECTION_PAGE_SIZE,
    profit: SECTION_PAGE_SIZE,
  });
  const [clickingDeal, setClickingDeal] = useState<string | null>(null);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data: ArbitrageDeal[];
      if (idToken) {
        data = await getDeals(idToken, { limit: 200 });
      } else {
        data = await getPublicDeals(200, 0);
      }
      setAllDeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const trendingDeals = useMemo(
    () =>
      allDeals
        .slice()
        .sort((a, b) => trendingScore(b) - trendingScore(a)),
    [allDeals]
  );

  const biggestDrops = useMemo(
    () =>
      allDeals
        .slice()
        .sort((a, b) => discountPercent(b) - discountPercent(a) || savingsAmount(b) - savingsAmount(a)),
    [allDeals]
  );

  const highestProfit = useMemo(
    () =>
      allDeals
        .slice()
        .sort((a, b) => (b.net_profit ?? 0) - (a.net_profit ?? 0)),
    [allDeals]
  );

  const handleDealClick = useCallback(
    async (deal: ArbitrageDeal, e: React.MouseEvent) => {
      e.preventDefault();
      if (!deal.buy_url) return;
      setClickingDeal(deal.id);
      const dealUrl = addUtmParameters(
        deal.buy_url,
        "bargainhuntrs",
        "trending_page",
        "deal_click"
      );
      try {
        if (idToken) {
          const result = await trackAffiliateClick(idToken, {
            url: dealUrl,
            retailer: deal.retailer || "amazon",
            asin: deal.asin,
            deal_id: deal.id,
          });
          window.open(result.affiliate_url || dealUrl, "_blank", "noopener,noreferrer");
        } else {
          const result = await clickAffiliatePublic({
            url: dealUrl,
            retailer: deal.retailer || "amazon",
            asin: deal.asin,
            deal_id: deal.id,
          });
          window.open(result.affiliate_url || dealUrl, "_blank", "noopener,noreferrer");
        }
      } catch {
        window.open(dealUrl, "_blank", "noopener,noreferrer");
      } finally {
        setClickingDeal(null);
      }
    },
    [idToken]
  );

  const sections: { key: SectionKey; label: string; icon: string; deals: ArbitrageDeal[] }[] = [
    { key: "trending", label: "Trending Now", icon: "🔥", deals: trendingDeals },
    { key: "drops", label: "Biggest Price Drops", icon: "📉", deals: biggestDrops },
    { key: "profit", label: "Highest Profit Potential", icon: "💰", deals: highestProfit },
  ];

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1">
        {/* Header */}
        <section className="px-6 py-10 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/deals"
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              ← Back to all deals
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Trending Deals
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              The hottest deals right now — biggest drops, highest profits, and most popular finds.
            </p>
          </div>
        </section>

        {/* Section tabs */}
        <section className="sticky top-0 z-10 border-b border-zinc-100 bg-white/80 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/80">
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex gap-1 overflow-x-auto">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => {
                    setActiveSection(section.key);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`whitespace-nowrap rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                    activeSection === section.key
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="mr-1">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            {!idToken && !loading && allDeals.length > 0 && (
              <div className="mb-6 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50 px-4 py-3 dark:from-emerald-950/50 dark:to-emerald-950/50">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  <span className="font-semibold">Sign up free</span> to unlock prices, exclusive deals, and instant alerts.
                </p>
                <button
                  onClick={() => router.push("/signup")}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Get free access →
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
              </div>
            ) : allDeals.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No deals available right now. Check back soon — our scanners update throughout the day.
                </p>
              </div>
            ) : (
              <div className="space-y-12">
                <AffiliateDisclosure />
                {sections.map((section) => {
                  if (activeSection !== section.key) return null;
                  const visible = section.deals.slice(0, visibleCounts[section.key]);
                  const hasMore = section.deals.length > visibleCounts[section.key];

                  return (
                    <div key={section.key}>
                      <div className="mb-4 flex items-center gap-2">
                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                          <span className="mr-1.5">{section.icon}</span>
                          {section.key === "trending"
                            ? "Trending Now"
                            : section.key === "drops"
                              ? "Biggest Price Drops"
                              : "Highest Profit Potential"}
                        </h2>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {section.deals.length}
                        </span>
                      </div>

                      {section.key === "trending" && (
                        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                          Most popular deals right now, ranked by a blended trending score of profit, ROI, and discount.
                        </p>
                      )}
                      {section.key === "drops" && (
                        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                          The steepest price drops across all retailers — ranked by discount percentage.
                        </p>
                      )}
                      {section.key === "profit" && (
                        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                          The highest-profit flips available now — ranked by net profit.
                        </p>
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((deal) => {
                          const discount = discountPercent(deal);
                          const savings = savingsAmount(deal);
                          const retailer = retailerName(deal.retailer);
                          const roiPct =
                            deal.roi != null
                              ? deal.roi >= 1
                                ? Math.round(deal.roi)
                                : Math.round(deal.roi * 100)
                              : null;

                          return (
                            <Link
                              key={deal.id}
                              href={`/deals/${deal.id}`}
                              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                            >
                              {/* Image */}
                              <div className="relative aspect-square w-full bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                                {deal.image_url ? (
                                  <img
                                    src={deal.image_url}
                                    alt={deal.title}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent && !parent.querySelector(".icon-fallback")) {
                                        const fallback = document.createElement("div");
                                        fallback.className =
                                          "icon-fallback flex h-full w-full items-center justify-center text-4xl";
                                        fallback.textContent = "🏷️";
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-4xl">
                                    🏷️
                                  </div>
                                )}

                                {/* Section-specific badge */}
                                {section.key === "trending" && discount > 50 && (
                                  <div className="absolute top-2 left-2 rounded-md bg-orange-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    🔥 Hot
                                  </div>
                                )}
                                {section.key === "drops" && savings > 0 && (
                                  <div className="absolute top-2 left-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    Save ${savings.toFixed(0)}
                                  </div>
                                )}
                                {section.key === "profit" && roiPct != null && roiPct > 100 && (
                                  <div className="absolute top-2 left-2 rounded-md bg-emerald-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    🏆 Best flip
                                  </div>
                                )}

                                {/* Discount badge (drops section) */}
                                {section.key === "drops" && discount > 0 && (
                                  <div className="absolute top-2 right-2 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    {discount}% OFF
                                  </div>
                                )}
                                {/* ROI badge (profit section) */}
                                {section.key === "profit" && roiPct != null && (
                                  <div className="absolute top-2 right-2 rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    {roiPct}% ROI
                                  </div>
                                )}
                                {/* Discount badge (trending section) */}
                                {section.key === "trending" && discount > 0 && discount <= 50 && (
                                  <div className="absolute top-2 right-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                                    {discount}% OFF
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex flex-1 flex-col p-4">
                                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                  {retailer}
                                </p>

                                <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                                  {deal.title}
                                </h3>

                                <div className="mt-auto space-y-1.5">
                                  {idToken ? (
                                    <>
                                      {/* Price row */}
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                          ${deal.buy_price.toFixed(2)}
                                        </span>
                                        {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                                          <span className="text-xs text-zinc-400 line-through dark:text-zinc-500">
                                            ${deal.historical_avg.toFixed(2)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Drops section: old → new */}
                                      {section.key === "drops" && deal.historical_avg && deal.historical_avg > deal.buy_price && (
                                        <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                          <span className="line-through">${deal.historical_avg.toFixed(2)}</span>
                                          {" → "}
                                          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                                            ${deal.buy_price.toFixed(2)}
                                          </span>
                                        </p>
                                      )}

                                      {/* Profit section: sell price + net profit */}
                                      {section.key === "profit" && (
                                        <div className="space-y-0.5">
                                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                            Buy:{" "}
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                                              ${deal.buy_price.toFixed(2)}
                                            </span>
                                            {" · "}
                                            Sell:{" "}
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                                              ${deal.sell_price.toFixed(2)}
                                            </span>
                                          </p>
                                          {deal.net_profit != null && deal.net_profit > 0 && (
                                            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                              Net profit: ${deal.net_profit.toFixed(2)}
                                              {roiPct != null && <span className="ml-1">({roiPct}% ROI)</span>}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Trending section: discount + profit summary */}
                                      {section.key === "trending" && (
                                        <div className="space-y-0.5">
                                          {discount > 0 && (
                                            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                              {discount}% off
                                              {savings > 0 && <span className="ml-1">· Save ${savings.toFixed(2)}</span>}
                                            </p>
                                          )}
                                          {deal.net_profit != null && deal.net_profit > 0 && (
                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                              Profit:{" "}
                                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                ${deal.net_profit.toFixed(2)}
                                              </span>
                                              {roiPct != null && <span className="ml-1">({roiPct}% ROI)</span>}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Coupon badge */}
                                      {deal.applied_coupon_code && (
                                        <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                          🎫 {deal.applied_coupon_code}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 blur-sm select-none">
                                          $XX.XX
                                        </span>
                                        {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                                          <span className="text-xs text-zinc-400 line-through blur-sm select-none dark:text-zinc-500">
                                            $XX.XX
                                          </span>
                                        )}
                                      </div>
                                      {discount > 0 && (
                                        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                          Save up to {discount}% off
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="mt-3 flex gap-2">
                                  {idToken ? (
                                    deal.buy_url && (
                                      <button
                                        onClick={(e) => handleDealClick(deal, e)}
                                        disabled={clickingDeal === deal.id}
                                        className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-emerald-500 dark:hover:text-white"
                                      >
                                        {clickingDeal === deal.id ? "Opening…" : "View Deal →"}
                                      </button>
                                    )
                                  ) : (
                                    <button
                                      onClick={() => router.push("/signup")}
                                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                                    >
                                      🔒 Sign up to view
                                    </button>
                                  )}
                                  <span className="flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                    Details
                                  </span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {hasMore && (
                        <div className="mt-6 flex justify-center">
                          <button
                            onClick={() =>
                              setVisibleCounts((prev) => ({
                                ...prev,
                                [section.key]: prev[section.key] + SECTION_PAGE_SIZE,
                              }))
                            }
                            className="rounded-lg border border-zinc-200 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Load more ({section.deals.length - visibleCounts[section.key]} remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
