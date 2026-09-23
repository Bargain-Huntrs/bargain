"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsletterPopup from "@/components/NewsletterPopup";
import LiveActivityFeed from "@/components/LiveActivityFeed";
import { getPublicDeals, clickAffiliatePublic, getCommunityStats, addUtmParameters, getProperties, getListings, getPublicCoupons, getPublicCommunityDeals, getPublicLeaderboard, type ArbitrageDeal, type CommunityStats } from "@/lib/api";

// ─── Helpers ───────────────────────────────────────────────────────────────

function discountPercent(deal: ArbitrageDeal): number {
  if (deal.historical_avg && deal.historical_avg > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.historical_avg) * 100);
  }
  if (deal.original_buy_price && deal.original_buy_price > deal.buy_price) {
    return Math.round((1 - deal.buy_price / deal.original_buy_price) * 100);
  }
  return 0;
}

function timeAgo(detectedAt: string): string {
  const diff = Date.now() - new Date(detectedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function retailerDisplayName(retailer?: string): string {
  if (!retailer) return "Amazon";
  const map: Record<string, string> = {
    amazon: "Amazon",
    home_depot: "Home Depot",
    ace_hardware: "Ace Hardware",
    ace: "Ace Hardware",
    corsair: "Corsair",
    walmart: "Walmart",
    target: "Target",
    best_buy: "Best Buy",
    costco: "Costco",
    lowes: "Lowe's",
    ebay: "eBay",
    ador: "ADOR",
    eufy: "Eufy",
    belkin: "Belkin",
    lenovo: "Lenovo",
    abebooks: "AbeBooks",
    barkbox: "BarkBox",
    golf_partner: "GOLF Partner",
    umbra: "Umbra",
    wine_express: "Wine Express",
    namecheap: "Namecheap",
    envato: "Envato",
    invideo: "InVideo",
    canva: "Canva",
    overstock: "Overstock",
    bhphoto: "B&H Photo",
    woot: "Woot",
    newegg: "Newegg",
    adorama: "Adorama",
    monoprice: "Monoprice",
    bestbuy: "Best Buy",
  };
  return map[retailer.toLowerCase()] || retailer.charAt(0).toUpperCase() + retailer.slice(1).replace(/_/g, " ");
}

function retailerColor(retailer?: string): string {
  if (!retailer) return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
  const map: Record<string, string> = {
    amazon: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    home_depot: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    ace_hardware: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    ace: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    corsair: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
    walmart: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    target: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    best_buy: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    costco: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    lowes: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    ador: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400",
    eufy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    belkin: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    lenovo: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    overstock: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
    bhphoto: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
    woot: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    ebay: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  };
  return map[retailer.toLowerCase()] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
}

function dealTierLabel(tier: string): { label: string; color: string } {
  switch (tier) {
    case "glitch":
      return { label: "PRICE ERROR", color: "bg-red-600 text-white" };
    case "clearance":
      return { label: "CLEARANCE", color: "bg-purple-600 text-white" };
    case "arbitrage":
      return { label: "DEAL", color: "bg-emerald-600 text-white" };
    default:
      return { label: "DEAL", color: "bg-emerald-600 text-white" };
  }
}

function categoryIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("headphone") || t.includes("earbud") || t.includes("earphone") || t.includes("speaker") || t.includes("audio")) return "🎧";
  if (t.includes("tv") || t.includes("monitor") || t.includes("display") || t.includes("screen")) return "📺";
  if (t.includes("laptop") || t.includes("computer") || t.includes("pc") || t.includes("tablet")) return "💻";
  if (t.includes("phone") || t.includes("smartphone") || t.includes("mobile")) return "📱";
  if (t.includes("camera") || t.includes("lens")) return "📷";
  if (t.includes("gaming") || t.includes("game") || t.includes("console") || t.includes("xbox") || t.includes("playstation") || t.includes("nintendo")) return "🎮";
  if (t.includes("tool") || t.includes("drill") || t.includes("saw") || t.includes("hammer")) return "🔧";
  if (t.includes("kitchen") || t.includes("blender") || t.includes("cook") || t.includes("pot") || t.includes("pan")) return "🍳";
  if (t.includes("fan") || t.includes("air") || t.includes("heater") || t.includes("cool")) return "❄️";
  if (t.includes("chair") || t.includes("desk") || t.includes("table") || t.includes("bed") || t.includes("furniture")) return "🪑";
  if (t.includes("toy") || t.includes("lego") || t.includes("kids") || t.includes("baby")) return "🧸";
  if (t.includes("fitness") || t.includes("exercise") || t.includes("dumbbell") || t.includes("gym") || t.includes("workout")) return "💪";
  if (t.includes("garden") || t.includes("plant") || t.includes("outdoor")) return "🌱";
  if (t.includes("pet") || t.includes("dog") || t.includes("cat") || t.includes("bird")) return "🐾";
  if (t.includes("food") || t.includes("snack") || t.includes("drink") || t.includes("coffee")) return "🍔";
  if (t.includes("beauty") || t.includes("skin") || t.includes("face") || t.includes("hair")) return "💄";
  if (t.includes("watch") || t.includes("smartwatch") || t.includes("fitness tracker")) return "⌚";
  if (t.includes("printer") || t.includes("label")) return "🖨️";
  if (t.includes("pen") || t.includes("paper") || t.includes("office")) return "✏️";
  if (t.includes("cd") || t.includes("dvd") || t.includes("vinyl") || t.includes("music")) return "💿";
  return "🏷️";
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function HomePageContent() {
  const [deals, setDeals] = useState<ArbitrageDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clickingDeal, setClickingDeal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRetailer, setFilterRetailer] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null); // online, in_store
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [verticalCounts, setVerticalCounts] = useState<{
    properties: number | null;
    auctions: number | null;
    coupons: number | null;
    community: number | null;
  }>({ properties: null, auctions: null, coupons: null, community: null });
  const [leaders, setLeaders] = useState<Array<{ rank: number; name: string; aura_points: number; aura_tier: string; deals_submitted: number }>>([]);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getPublicDeals(50, 0);
      setDeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  // Load community stats (non-critical, fail silently)
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      getCommunityStats(token).then(setCommunityStats).catch(() => {});
    }
  }, []);

  // Live counts for each vertical — all fail silently, cards show "Live" fallback
  useEffect(() => {
    getProperties({ per_page: 1 })
      .then((r) => setVerticalCounts((v) => ({ ...v, properties: r.total })))
      .catch(() => {});
    getListings({ per_page: 1 })
      .then((r) => setVerticalCounts((v) => ({ ...v, auctions: r.total })))
      .catch(() => {});
    getPublicCoupons(100)
      .then((r) => setVerticalCounts((v) => ({ ...v, coupons: r.length })))
      .catch(() => {});
    getPublicCommunityDeals({ limit: 100 })
      .then((r) => setVerticalCounts((v) => ({ ...v, community: r.length })))
      .catch(() => {});
    getPublicLeaderboard(5).then(setLeaders).catch(() => {});
  }, []);

  const handleDealClick = useCallback(
    async (deal: ArbitrageDeal, e: React.MouseEvent) => {
      e.preventDefault();
      if (!deal.buy_url) return;
      setClickingDeal(deal.id);
      // Tag outgoing deal links from the homepage feed
      const dealUrl = addUtmParameters(deal.buy_url, "bargainhuntrs", "deal_card", "deal_click");
      try {
        const result = await clickAffiliatePublic({
          url: dealUrl,
          retailer: deal.retailer || "amazon",
          asin: deal.asin,
          deal_id: deal.id,
        });
        window.open(result.affiliate_url || dealUrl, "_blank", "noopener,noreferrer");
      } catch {
        window.open(dealUrl, "_blank", "noopener,noreferrer");
      } finally {
        setClickingDeal(null);
      }
    },
    []
  );

  // Get unique retailers for filter chips
  const retailers = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => set.add(d.retailer || "amazon"));
    return Array.from(set);
  }, [deals]);

  // Filter deals based on search, retailer, and source
  const filteredDeals = useMemo(() => {
    // Deduplicate by title (keep first occurrence)
    const seen = new Set<string>();
    return deals.filter((deal) => {
      // Dedup by title
      const titleKey = deal.title.slice(0, 80).toLowerCase();
      if (seen.has(titleKey)) return false;
      seen.add(titleKey);

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = deal.title.toLowerCase();
        const retailer = (deal.retailer || "amazon").toLowerCase();
        const category = (deal.category || "").toLowerCase();
        if (!title.includes(q) && !retailer.includes(q) && !category.includes(q)) {
          return false;
        }
      }
      // Retailer filter
      if (filterRetailer && (deal.retailer || "amazon") !== filterRetailer) {
        return false;
      }
      // Source filter (online/in-store)
      if (filterSource && (deal.deal_source || "online") !== filterSource) {
        return false;
      }
      return true;
    });
  }, [deals, searchQuery, filterRetailer, filterSource]);

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      {/* Impact site verification (content method) */}
      <div style={{ position: "absolute", left: "-9999px", top: "0", fontSize: "1px", color: "#fff" }} aria-hidden="true">
        Impact-Site-Verification: c2aacb17-49a0-4116-b515-be1a7e596103
      </div>
      <Header />

      <main className="flex-1 flex flex-col">
        {/* ── Hero with search ─────────────────────────────────────────── */}
        <section className="px-6 pt-12 pb-8 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            {deals.length > 0 ? `${deals.length} live deals — all 20%+ off` : "Scanning for deals..."}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-[1.1]">
            Find it underpriced.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400">
              Flip it for profit.
            </span>
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Retail glitches, clearance, real estate, auctions & coupons — scanned live, ranked by profit.
          </p>

          {/* Search bar */}
          <div className="mt-6 mx-auto max-w-xl">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals, stores, or categories..."
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-12 pr-4 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* Live stats bar */}
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">{deals.length || "—"}</p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Live deals</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {filteredDeals.length ? `${Math.round(filteredDeals.reduce((s, d) => s + discountPercent(d), 0) / filteredDeals.filter((d) => discountPercent(d) > 0).length || 1)}%` : "—"}
              </p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Avg discount</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                {deals.length ? `$${Math.round(deals.reduce((s, d) => s + (d.net_profit || 0), 0)).toLocaleString()}` : "—"}
              </p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Est. profit on feed</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                {communityStats ? communityStats.total_members.toLocaleString() : "—"}
              </p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Hunters</p>
            </div>
          </div>
        </section>

        {/* ── Pick your hunt — vertical cards ──────────────────────────── */}
        <section className="border-b border-zinc-200 px-6 py-8 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Pick your hunt
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  href: "#feed",
                  icon: "🏷️",
                  title: "Retail Glitches",
                  desc: "Price errors & clearance",
                  count: deals.length ? `${deals.length} live` : null,
                  accent: "emerald",
                },
                {
                  href: "/real-estate/deals",
                  icon: "🏠",
                  title: "Real Estate",
                  desc: "Distressed & MAO deals",
                  count: verticalCounts.properties !== null ? `${verticalCounts.properties.toLocaleString()} listed` : null,
                  accent: "blue",
                },
                {
                  href: "/auctions",
                  icon: "🔨",
                  title: "Auctions & Surplus",
                  desc: "Gov & retail auctions",
                  count: verticalCounts.auctions !== null ? `${verticalCounts.auctions.toLocaleString()} listed` : null,
                  accent: "amber",
                },
                {
                  href: "/coupons",
                  icon: "🎟️",
                  title: "Coupons",
                  desc: "Codes & stacking",
                  count: verticalCounts.coupons !== null ? `${verticalCounts.coupons} active` : null,
                  accent: "pink",
                },
                {
                  href: "/community",
                  icon: "👥",
                  title: "Community Finds",
                  desc: "Deals posted by hunters",
                  count: verticalCounts.community !== null ? `${verticalCounts.community} posted` : null,
                  accent: "indigo",
                },
              ].map((v) => (
                <Link
                  key={v.title}
                  href={v.href}
                  className="group rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="text-2xl">{v.icon}</span>
                  <h3 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{v.title}</h3>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{v.desc}</p>
                  <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {v.count || "Live"}
                    <span className="ml-1 text-zinc-400 transition-transform group-hover:translate-x-0.5 inline-block">→</span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Filter chips ─────────────────────────────────────────────── */}
        <section className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setFilterRetailer(null); setFilterSource(null); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !filterRetailer && !filterSource
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              All Deals
            </button>
            <button
              onClick={() => { setFilterSource("online"); setFilterRetailer(null); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterSource === "online"
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              Online Deals
            </button>
            <button
              onClick={() => { setFilterSource("in_store"); setFilterRetailer(null); }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterSource === "in_store"
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              In-Store
            </button>
            <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
            {retailers.map((r) => (
              <button
                key={r}
                onClick={() => setFilterRetailer(r === filterRetailer ? null : r)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterRetailer === r
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                {retailerDisplayName(r)}
              </button>
            ))}
          </div>
        </section>

        {/* ── Deals feed ───────────────────────────────────────────────── */}
        <section id="feed" className="px-6 py-8 flex-1">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Latest retail finds
            </h2>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Finding the best deals...</p>
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {searchQuery || filterRetailer || filterSource ? "No deals match your filters" : "No deals found right now"}
                </p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                  Our scanners are watching for price drops and glitches. Check back soon or{" "}
                  <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium">
                    sign up for alerts
                  </Link>{" "}
                  so you never miss one.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""} found
                  </p>
                  <Link
                    href="/deals"
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    View all deals →
                  </Link>
                </div>

                {/* Deal cards — horizontal list like HiddenClearances */}
                <div className="space-y-3">
                  {filteredDeals.map((deal) => {
                    const discount = discountPercent(deal);
                    const tier = dealTierLabel(deal.deal_tier);
                    const retailer = deal.retailer || "amazon";
                    const isOnline = (deal.deal_source || "online") === "online";

                    return (
                      <div
                        key={deal.id}
                        className="group flex gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      >
                        {/* Image */}
                        <div className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-lg bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                          {deal.image_url ? (
                            <img
                              src={deal.image_url}
                              alt={deal.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                // Fallback to category icon if image fails to load
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector(".icon-fallback")) {
                                  const fallback = document.createElement("div");
                                  fallback.className = "icon-fallback flex h-full w-full items-center justify-center text-3xl";
                                  fallback.textContent = categoryIcon(deal.title);
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl">
                              {categoryIcon(deal.title)}
                            </div>
                          )}
                          {/* Discount badge */}
                          {discount > 0 && (
                            <div className="absolute top-1 left-1 rounded-md bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                              {discount}% OFF
                            </div>
                          )}
                          {/* Premium badge for price errors */}
                          {deal.deal_tier === "glitch" && (
                            <div className="absolute bottom-1 left-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 px-1.5 py-0.5 text-xs font-bold text-white shadow-sm">
                              PREMIUM
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          {/* Top row: tags */}
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${tier.color}`}>
                              {tier.label}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${retailerColor(retailer)}`}>
                              {retailerDisplayName(retailer)}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              isOnline
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            }`}>
                              {isOnline ? "Online" : "In-Store"}
                            </span>
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">
                              {timeAgo(deal.detected_at)}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 mb-2">
                            {deal.title}
                          </h3>

                          {/* Price row */}
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                              ${deal.buy_price.toFixed(2)}
                            </span>
                            {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                              <span className="text-sm text-zinc-400 line-through">
                                ${deal.historical_avg.toFixed(2)}
                              </span>
                            )}
                            {discount > 0 && (
                              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                                {discount}% OFF
                              </span>
                            )}
                          </div>

                          {/* Best coupon badge */}
                          {deal.best_coupon && deal.best_coupon.savings > 0 && (
                            <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/40">
                              <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 1l-2.5 2.5L10 6l2.5-2.5L10 1zM5 6l-2.5 2.5L5 11l2.5-2.5L5 6zm10 0l-2.5 2.5L15 11l2.5-2.5L15 6zm-5 5l-2.5 2.5L10 16l2.5-2.5L10 11z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                Code: {deal.best_coupon.code} → ${deal.best_coupon.effective_price.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                (save ${deal.best_coupon.savings.toFixed(2)})
                              </span>
                            </div>
                          )}

                          {/* CTA */}
                          <div className="mt-auto">
                            {deal.deal_tier === "glitch" ? (
                              // Price errors are premium — gate the link
                              <Link
                                href="/pricing"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                              >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Unlock with Hunter →
                              </Link>
                            ) : deal.buy_url ? (
                              <button
                                onClick={(e) => handleDealClick(deal, e)}
                                disabled={clickingDeal === deal.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                              >
                                {clickingDeal === deal.id ? "Opening..." : "View Deal →"}
                              </button>
                            ) : (
                              <Link
                                href="/signup"
                                className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              >
                                Sign up to view
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Spot → Analyze → Flip (tools strip) ──────────────────────── */}
        <section className="border-t border-zinc-200 bg-zinc-50/60 px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              How hunters profit
            </h2>
            <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
              The same three tools pros run every deal through — free, in your dashboard.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { step: "1", icon: "🔎", title: "Spot it", desc: "Live feed flags glitches & clearance with real discounts — not inflated 'was' prices.", href: "#feed", cta: "Browse the feed" },
                { step: "2", icon: "🧮", title: "Analyze it", desc: "Profit Calculator shows net profit, ROI and platform fees before you spend a dollar.", href: "/tools/profit-calculator", cta: "Run the numbers" },
                { step: "3", icon: "📦", title: "Flip it", desc: "Listing Generator writes an optimized title, description and price for eBay/FB/Poshmark.", href: "/tools/listing-generator", cta: "Build a listing" },
              ].map((t) => (
                <Link
                  key={t.step}
                  href={t.href}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      {t.step}
                    </span>
                    <span className="text-xl">{t.icon}</span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t.title}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t.desc}</p>
                  <p className="mt-3 text-xs font-semibold text-emerald-600 group-hover:underline dark:text-emerald-400">
                    {t.cta} →
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Leaderboard teaser ───────────────────────────────────────── */}
        {leaders.length > 0 && (
          <section className="border-t border-zinc-200 px-6 py-10 dark:border-zinc-800">
            <div className="mx-auto max-w-5xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Top hunters this week
                </h2>
                <Link
                  href="/community/leaderboard"
                  className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Full leaderboard →
                </Link>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {leaders.map((l, i) => (
                  <div
                    key={l.rank}
                    className="flex items-center gap-4 border-b border-zinc-100 px-5 py-3 last:border-0 dark:border-zinc-800/60"
                  >
                    <span className="w-6 text-center text-sm font-black text-zinc-400">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : l.rank}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {l.name}
                    </span>
                    <span className="text-xs text-zinc-500">{l.deals_submitted} deals</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {l.aura_points.toLocaleString()} Aura
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Community stats + Seller CTA ──────────────────────────────── */}
        <section className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-12">
          <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2">
            {/* Community */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎯</span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Join the Hunt</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                    {communityStats ? communityStats.total_members.toLocaleString() : "500k+"}
                  </p>
                  <p className="text-xs text-zinc-500">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                    {communityStats ? communityStats.deals_posted.toLocaleString() : "10k+"}
                  </p>
                  <p className="text-xs text-zinc-500">Deals Posted</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-600">$100</p>
                  <p className="text-xs text-zinc-500">Monthly Draw</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                Vote on deals, farm Aura points, and climb to GOAT status.
              </p>
              <Link
                href="/community"
                className="mt-4 inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Start farming Aura →
              </Link>
            </div>

            {/* Seller */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏪</span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Are you a seller?</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Submit your coupon codes and price drops directly to our deal feed.
                Verified sellers get instant publishing — no moderation queue.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Submit coupon codes
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Submit price drops
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Bulk submit via API
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-500">✓</span> Verified seller badge
                </li>
              </ul>
              <Link
                href="/seller"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Submit codes · Submit a price drop →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Signup CTA ───────────────────────────────────────────────── */}
        <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-6 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Get alerted the moment a deal drops.
            </h2>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
              Free forever. Browse every deal, get daily alerts, and save money from day one.
              Upgrade to Hunter for instant alerts for just $9.99/mo.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
              >
                Start for free
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-zinc-300 px-7 py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Live activity feed — scrolling social proof notifications */}
      <LiveActivityFeed />

      <Footer />
      <NewsletterPopup />
    </div>
  );
}
