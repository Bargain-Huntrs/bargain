"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getPublicDeals, type ArbitrageDeal } from "@/lib/api";

// ─── Retailer data ────────────────────────────────────────────────────────────

type Emoji = "🛒" | "📱" | "👕" | "🏠" | "🐾" | "⚽" | "📦";

interface Retailer {
  name: string;
  domain: string;
  categories: string[];
  bestFor: string;
  inStorePickup: boolean;
  emoji: Emoji;
}

const RETAILERS: Retailer[] = [
  // Online Marketplaces
  { name: "Amazon", domain: "amazon.com", categories: ["Electronics", "Home", "Everything"], bestFor: "Electronics", inStorePickup: false, emoji: "📦" },
  { name: "eBay", domain: "ebay.com", categories: ["Everything", "Used/Refurbished"], bestFor: "Used & Refurbished", inStorePickup: false, emoji: "🛒" },
  { name: "Walmart", domain: "walmart.com", categories: ["Home", "Electronics", "Grocery"], bestFor: "Home & Garden", inStorePickup: true, emoji: "🛒" },
  { name: "Target", domain: "target.com", categories: ["Home", "Clothing", "Electronics"], bestFor: "Home & Clothing", inStorePickup: true, emoji: "🛒" },
  { name: "Best Buy", domain: "bestbuy.com", categories: ["Electronics", "Appliances"], bestFor: "Electronics", inStorePickup: true, emoji: "📱" },
  { name: "Costco", domain: "costco.com", categories: ["Bulk", "Electronics", "Home"], bestFor: "Bulk Buying", inStorePickup: true, emoji: "🛒" },
  { name: "Sam's Club", domain: "samsclub.com", categories: ["Bulk", "Electronics"], bestFor: "Bulk Buying", inStorePickup: true, emoji: "🛒" },
  { name: "Wayfair", domain: "wayfair.com", categories: ["Furniture", "Home"], bestFor: "Home & Garden", inStorePickup: false, emoji: "🏠" },
  { name: "Overstock", domain: "overstock.com", categories: ["Furniture", "Home"], bestFor: "Home & Garden", inStorePickup: false, emoji: "🏠" },

  // Home & Hardware
  { name: "Home Depot", domain: "homedepot.com", categories: ["Tools", "Hardware"], bestFor: "Home & Garden", inStorePickup: true, emoji: "🏠" },
  { name: "Lowe's", domain: "lowes.com", categories: ["Tools", "Hardware"], bestFor: "Home & Garden", inStorePickup: true, emoji: "🏠" },
  { name: "Bed Bath & Beyond", domain: "bedbathandbeyond.com", categories: ["Home", "Kitchen"], bestFor: "Home & Kitchen", inStorePickup: true, emoji: "🏠" },
  { name: "IKEA", domain: "ikea.com", categories: ["Furniture"], bestFor: "Furniture", inStorePickup: true, emoji: "🏠" },

  // Clothing & Fashion
  { name: "Kohl's", domain: "kohls.com", categories: ["Clothing"], bestFor: "Clothing", inStorePickup: true, emoji: "👕" },
  { name: "Macy's", domain: "macys.com", categories: ["Clothing", "Home"], bestFor: "Clothing & Home", inStorePickup: true, emoji: "👕" },
  { name: "Nordstrom", domain: "nordstrom.com", categories: ["Fashion"], bestFor: "Fashion", inStorePickup: true, emoji: "👕" },
  { name: "TJ Maxx", domain: "tjmaxx.com", categories: ["Discount Fashion"], bestFor: "Discount Fashion", inStorePickup: true, emoji: "👕" },
  { name: "Marshalls", domain: "marshalls.com", categories: ["Discount Fashion"], bestFor: "Discount Fashion", inStorePickup: true, emoji: "👕" },
  { name: "Ross", domain: "rossstores.com", categories: ["Discount Fashion"], bestFor: "Discount Fashion", inStorePickup: true, emoji: "👕" },
  { name: "Ulta", domain: "ulta.com", categories: ["Beauty"], bestFor: "Beauty", inStorePickup: true, emoji: "👕" },
  { name: "Sephora", domain: "sephora.com", categories: ["Beauty"], bestFor: "Beauty", inStorePickup: true, emoji: "👕" },

  // Sports & Outdoors
  { name: "Dick's Sporting Goods", domain: "dickssportinggoods.com", categories: ["Sports"], bestFor: "Sports & Outdoors", inStorePickup: true, emoji: "⚽" },
  { name: "Academy Sports", domain: "academy.com", categories: ["Sports", "Outdoors"], bestFor: "Sports & Outdoors", inStorePickup: true, emoji: "⚽" },
  { name: "REI", domain: "rei.com", categories: ["Outdoors"], bestFor: "Outdoors", inStorePickup: true, emoji: "⚽" },

  // Office & Misc
  { name: "Office Depot", domain: "officedepot.com", categories: ["Office"], bestFor: "Office Supplies", inStorePickup: true, emoji: "📦" },
  { name: "Staples", domain: "staples.com", categories: ["Office"], bestFor: "Office Supplies", inStorePickup: true, emoji: "📦" },
  { name: "PetSmart", domain: "petsmart.com", categories: ["Pet Supplies"], bestFor: "Pet Supplies", inStorePickup: true, emoji: "🐾" },
  { name: "Petco", domain: "petco.com", categories: ["Pet Supplies"], bestFor: "Pet Supplies", inStorePickup: true, emoji: "🐾" },
];

const CATEGORY_SECTIONS: { title: string; retailers: string[] }[] = [
  {
    title: "Online Marketplaces",
    retailers: ["Amazon", "eBay", "Walmart", "Target", "Best Buy", "Costco", "Sam's Club", "Wayfair", "Overstock"],
  },
  {
    title: "Home & Hardware",
    retailers: ["Home Depot", "Lowe's", "Bed Bath & Beyond", "IKEA"],
  },
  {
    title: "Clothing & Fashion",
    retailers: ["Kohl's", "Macy's", "Nordstrom", "TJ Maxx", "Marshalls", "Ross", "Ulta", "Sephora"],
  },
  {
    title: "Sports & Outdoors",
    retailers: ["Dick's Sporting Goods", "Academy Sports", "REI"],
  },
  {
    title: "Office & Misc",
    retailers: ["Office Depot", "Staples", "PetSmart", "Petco"],
  },
];

const FEATURE_CARDS = [
  {
    title: "Real-Time Scanning",
    body: "Our scanners check prices across 30+ retailers every few minutes, catching price drops the moment they happen.",
    emoji: "⚡",
  },
  {
    title: "Price Glitch Detection",
    body: "We spot pricing errors and glitches within seconds, before retailers fix them.",
    emoji: "🔍",
  },
  {
    title: "Clearance & Closeout",
    body: "We monitor clearance sections and closeout sales so you never miss a deep discount.",
    emoji: "🏷️",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeRetailerKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function discountPercent(deal: ArbitrageDeal): number {
  if (deal.historical_avg && deal.historical_avg > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.historical_avg) * 100);
  }
  if (deal.original_buy_price && deal.original_buy_price > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.original_buy_price) * 100);
  }
  return 0;
}

interface RetailerStat {
  name: string;
  activeDeals: number;
  avgDiscount: number;
  bestDeal: { id: string; discount: number; title: string } | null;
}

function computeStats(deals: ArbitrageDeal[]): RetailerStat[] {
  const byRetailer = new Map<string, ArbitrageDeal[]>();
  for (const deal of deals) {
    const key = (deal.retailer || "amazon").toLowerCase();
    const arr = byRetailer.get(key) || [];
    arr.push(deal);
    byRetailer.set(key, arr);
  }

  const stats: RetailerStat[] = [];
  for (const [key, retailerDeals] of byRetailer.entries()) {
    const discounts = retailerDeals.map(discountPercent).filter((d) => d > 0);
    const avgDiscount =
      discounts.length > 0
        ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length)
        : 0;

    let best: RetailerStat["bestDeal"] = null;
    for (const d of retailerDeals) {
      const disc = discountPercent(d);
      if (!best || disc > best.discount) {
        best = { id: d.id, discount: disc, title: d.title };
      }
    }

    // Try to map the API retailer key back to a display name from our list.
    const match = RETAILERS.find(
      (r) => normalizeRetailerKey(r.name) === key
    );
    const name = match ? match.name : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

    stats.push({
      name,
      activeDeals: retailerDeals.length,
      avgDiscount,
      bestDeal: best,
    });
  }

  return stats.sort((a, b) => b.activeDeals - a.activeDeals);
}

// ─── Retailer card ────────────────────────────────────────────────────────────

function RetailerCard({ retailer }: { retailer: Retailer }) {
  const href = `/deals?retailer=${encodeURIComponent(retailer.name)}`;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between">
        <span className="text-3xl" aria-hidden>
          {retailer.emoji}
        </span>
        {retailer.inStorePickup && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            In-store pickup
          </span>
        )}
      </div>

      <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-50 group-hover:opacity-80 transition-opacity">
        {retailer.name}
      </h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{retailer.domain}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {retailer.categories.map((c) => (
          <span
            key={c}
            className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          >
            {c}
          </span>
        ))}
      </div>

      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Best for: <span className="font-medium text-zinc-700 dark:text-zinc-300">{retailer.bestFor}</span>
      </div>

      <span className="mt-4 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors group-hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:group-hover:bg-zinc-200">
        View deals →
      </span>
    </Link>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

export default function RetailersClient() {
  const [query, setQuery] = useState("");
  const [deals, setDeals] = useState<ArbitrageDeal[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getPublicDeals(200, 0);
        if (!cancelled) {
          setDeals(result);
          setLoadingStats(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStatsError(err instanceof Error ? err.message : "Failed to load deal statistics");
          setLoadingStats(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => computeStats(deals), [deals]);

  const filteredRetailers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RETAILERS;
    return RETAILERS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.categories.some((c) => c.toLowerCase().includes(q)) ||
        r.bestFor.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredNames = new Set(filteredRetailers.map((r) => r.name));

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Tracked Retailers
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              We scan 30+ retailers for price drops, glitches, and clearance deals. Find the best deals at your favorite stores.
            </p>
          </div>

          {/* Search / filter */}
          <div className="mt-8 flex justify-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search retailers by name or category…"
              className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-700"
            />
          </div>

          {/* Category sections */}
          <div className="mt-12 space-y-12">
            {CATEGORY_SECTIONS.map((section) => {
              const sectionRetailers = section.retailers
                .map((name) => RETAILERS.find((r) => r.name === name))
                .filter((r): r is Retailer => Boolean(r) && filteredNames.has(r!.name));

              if (sectionRetailers.length === 0) return null;

              return (
                <section key={section.title}>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    {section.title}
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {sectionRetailers.map((r) => (
                      <RetailerCard key={r.name} retailer={r} />
                    ))}
                  </div>
                </section>
              );
            })}

            {filteredRetailers.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No retailers match &ldquo;{query}&rdquo;. Try a different search.
                </p>
              </div>
            )}
          </div>

          {/* How we track deals */}
          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              How We Track Deals
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {FEATURE_CARDS.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-3xl" aria-hidden>
                    {f.emoji}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Retailer deal statistics */}
          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Retailer Deal Statistics
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Live counts from our most recent scan. Updated every few minutes.
            </p>

            {loadingStats ? (
              <div className="mt-6 animate-pulse space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : statsError ? (
              <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {statsError}
              </div>
            ) : stats.length === 0 ? (
              <div className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                No active deals right now. Check back soon.
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Retailer</th>
                      <th className="px-4 py-3 font-medium">Active Deals</th>
                      <th className="px-4 py-3 font-medium">Avg Discount</th>
                      <th className="px-4 py-3 font-medium">Best Deal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {stats.map((s) => (
                      <tr key={s.name} className="bg-white dark:bg-zinc-950">
                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                          {s.name}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {s.activeDeals}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {s.avgDiscount > 0 ? `${s.avgDiscount}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {s.bestDeal && s.bestDeal.discount > 0 ? (
                            <Link
                              href={`/deals/${s.bestDeal.id}`}
                              className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                            >
                              {s.bestDeal.discount}% off
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
