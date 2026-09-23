"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [deals, setDeals] = useState<ArbitrageDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickingDeal, setClickingDeal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [verticalCounts, setVerticalCounts] = useState<{
    properties: number | null;
    auctions: number | null;
    coupons: number | null;
    community: number | null;
  }>({ properties: null, auctions: null, coupons: null, community: null });
  const [leaders, setLeaders] = useState<Array<{ rank: number; name: string; aura_points: number; aura_tier: string; deals_submitted: number }>>([]);

  useEffect(() => {
    getPublicDeals(50, 0)
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(searchQuery.trim() ? `/deals?q=${encodeURIComponent(searchQuery.trim())}` : "/deals");
  };

  const avgDiscount = deals.length
    ? Math.round(
        deals.reduce((s, d) => s + discountPercent(d), 0) /
          (deals.filter((d) => discountPercent(d) > 0).length || 1)
      )
    : null;
  const totalProfit = deals.reduce((s, d) => s + (d.net_profit || 0), 0);
  const hotDeals = [...deals].sort((a, b) => discountPercent(b) - discountPercent(a)).slice(0, 3);

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      {/* Impact site verification (content method) */}
      <div style={{ position: "absolute", left: "-9999px", top: "0", fontSize: "1px", color: "#fff" }} aria-hidden="true">
        Impact-Site-Verification: c2aacb17-49a0-4116-b515-be1a7e596103
      </div>
      <Header />

      <main className="flex-1 flex flex-col">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-6 pt-14 pb-10 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 backdrop-blur px-4 py-1.5 text-xs font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            {deals.length > 0 ? `${deals.length} live deals — all 20%+ off` : "Scanning 500+ retailers right now..."}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50 leading-[1.05]">
            Find it underpriced.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400">
              Flip it for profit.
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            BargainHuntrs scans retail prices, real estate, auctions and coupons around the clock —
            catches price glitches within seconds, verifies the discount is real, and shows you the
            profit spread before you spend a dollar.
          </p>

          {/* Search → deals page */}
          <form onSubmit={handleSearch} className="mt-7 mx-auto max-w-xl">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals, stores, or categories..."
                className="w-full rounded-xl border border-zinc-300 bg-white py-3.5 pl-12 pr-28 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                Search
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Popular:</span>
            {["Nike", "Lego", "Dyson", "Nintendo", "Tools"].map((t) => (
              <button
                key={t}
                onClick={() => router.push(`/deals?q=${encodeURIComponent(t)}`)}
                className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-emerald-600 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-emerald-400"
              >
                {t}
              </button>
            ))}
          </div>

          {/* Live stats bar */}
          <div className="mx-auto mt-9 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">{deals.length || "—"}</p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Live deals</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {avgDiscount !== null ? `${avgDiscount}%` : "—"}
              </p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Avg discount</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                {deals.length ? `$${Math.round(totalProfit).toLocaleString()}` : "—"}
              </p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Est. profit on feed</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white/70 px-3 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
              <p className="text-lg font-black text-zinc-900 dark:text-zinc-50">500+</p>
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Retailers scanned</p>
            </div>
          </div>
        </section>

        {/* ── Pick your hunt — vertical cards ──────────────────────────── */}
        <section className="border-b border-zinc-200 px-6 py-10 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Pick your hunt
              </h2>
            </div>
            <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
              Five ways to find an edge. Every category lives on its own page — pick one and dig in.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  href: "/deals",
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
                  count: verticalCounts.coupons !== null ? `${verticalCounts.coupons}${verticalCounts.coupons >= 100 ? "+" : ""} active` : null,
                  accent: "pink",
                },
                {
                  href: "/community",
                  icon: "👥",
                  title: "Community Finds",
                  desc: "Deals posted by hunters",
                  count: verticalCounts.community ? `${verticalCounts.community} posted` : null,
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

        {/* ── Hot right now — teaser ───────────────────────────────────── */}
        <section className="border-b border-zinc-200 px-6 py-10 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Hot right now
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Biggest verified discounts on the feed this minute.
                </p>
              </div>
              <Link
                href="/deals"
                className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-700 dark:bg-emerald-500 dark:hover:bg-emerald-400"
              >
                Browse all deals →
              </Link>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {hotDeals.map((deal) => {
                  const discount = discountPercent(deal);
                  const tier = dealTierLabel(deal.deal_tier);
                  const retailer = deal.retailer || "amazon";
                  return (
                    <div
                      key={deal.id}
                      className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800">
                          {deal.image_url ? (
                            <img
                              src={deal.image_url}
                              alt={deal.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector(".icon-fallback")) {
                                  const fallback = document.createElement("div");
                                  fallback.className = "icon-fallback flex h-full w-full items-center justify-center text-2xl";
                                  fallback.textContent = categoryIcon(deal.title);
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl">
                              {categoryIcon(deal.title)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${tier.color}`}>{tier.label}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${retailerColor(retailer)}`}>
                              {retailerDisplayName(retailer)}
                            </span>
                            <span className="text-[10px] text-zinc-400">{timeAgo(deal.detected_at)}</span>
                          </div>
                          <h3 className="mt-1.5 line-clamp-2 text-xs font-semibold text-zinc-900 dark:text-zinc-50">
                            {deal.title}
                          </h3>
                        </div>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                          ${deal.buy_price.toFixed(2)}
                        </span>
                        {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                          <span className="text-xs text-zinc-400 line-through">${deal.historical_avg.toFixed(2)}</span>
                        )}
                        {discount > 0 && (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">{discount}% OFF</span>
                        )}
                      </div>
                      <div className="mt-3">
                        {deal.deal_tier === "glitch" ? (
                          <Link
                            href="/pricing"
                            className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                          >
                            Unlock with Hunter →
                          </Link>
                        ) : deal.buy_url ? (
                          <button
                            onClick={(e) => handleDealClick(deal, e)}
                            disabled={clickingDeal === deal.id}
                            className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                          >
                            {clickingDeal === deal.id ? "Opening..." : "View Deal →"}
                          </button>
                        ) : (
                          <Link
                            href="/signup"
                            className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            Sign up to view
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── What you get — feature grid ──────────────────────────────── */}
        <section id="features" className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-12 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              What to expect
            </h2>
            <p className="mt-1 mb-6 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Everything on the platform, explained. No inflated "was" prices, no recycled deals —
              every card shows the real discount and the math behind it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: "⚡",
                  title: "Live glitch feed",
                  desc: "Scanners watch 500+ retailers continuously. When a price drops below its verified average, it hits the feed in seconds — flagged PRICE ERROR, CLEARANCE, or DEAL so you know how hot it is.",
                  href: "/deals",
                },
                {
                  icon: "✅",
                  title: "Verified discounts",
                  desc: "We compare against real price history, not the retailer's inflated list price. The % off you see is the discount that actually exists.",
                  href: "/deals/best",
                },
                {
                  icon: "🎟️",
                  title: "Coupon stacking",
                  desc: "Every deal is checked against active promo codes. If a code stacks, we show the effective price and total savings right on the card.",
                  href: "/coupons",
                },
                {
                  icon: "🔔",
                  title: "Instant alerts",
                  desc: "Free members get daily digests. Hunter members get real-time alerts via email, SMS, Discord, and Telegram — filtered to the niches you follow.",
                  href: "/settings/notifications",
                },
                {
                  icon: "🧮",
                  title: "Profit tools",
                  desc: "Run any deal through the Profit Calculator for net profit, ROI and platform fees — then generate an optimized resale listing in one click.",
                  href: "/tools/profit-calculator",
                },
                {
                  icon: "🏆",
                  title: "Hunter community",
                  desc: "Post your own finds, vote on deals, and earn Aura. Top hunters climb the leaderboard and qualify for the monthly draw.",
                  href: "/community",
                },
              ].map((f) => (
                <Link
                  key={f.title}
                  href={f.href}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="mt-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{f.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className="border-b border-zinc-200 px-6 py-12 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              How hunters profit
            </h2>
            <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              The same three-step loop pros run every deal through — all tools free in your dashboard.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { step: "1", icon: "🔎", title: "Spot it", desc: "Browse the live feed or set niche alerts. Price errors and clearance are flagged the second our scanners catch them — before they're fixed or sold out.", href: "/deals", cta: "Browse the feed" },
                { step: "2", icon: "🧮", title: "Analyze it", desc: "Run the deal through the Profit Calculator: buy price, resale value, platform fees, shipping — see exact net profit and ROI before you spend a dollar.", href: "/tools/profit-calculator", cta: "Run the numbers" },
                { step: "3", icon: "📦", title: "Flip it", desc: "The Listing Generator writes an optimized title, description and price for eBay, Facebook Marketplace or Poshmark. Post it, sell it, pocket the spread.", href: "/tools/listing-generator", cta: "Build a listing" },
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

        {/* ── Free vs Hunter ───────────────────────────────────────────── */}
        <section className="border-b border-zinc-200 bg-zinc-50/60 px-6 py-12 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Free vs. Hunter
            </h2>
            <p className="mt-1 mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Start free forever. Upgrade when you're ready to move faster than everyone else.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Free</h3>
                  <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">$0</span>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Full deals feed — every deal, every retailer</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Daily email alert digest</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Profit Calculator &amp; Listing Generator</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Community posting &amp; Aura rewards</li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-5 inline-block w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-center text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  Start free
                </Link>
              </div>
              <div className="relative rounded-2xl border-2 border-emerald-500 bg-white p-6 dark:bg-zinc-900">
                <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  Most popular
                </span>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Hunter</h3>
                  <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                    $9.99<span className="text-xs font-medium text-zinc-500">/mo</span>
                  </span>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Everything in Free</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> <strong className="text-zinc-900 dark:text-zinc-50">Instant alerts</strong>&nbsp;— SMS, Discord &amp; Telegram</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> <strong className="text-zinc-900 dark:text-zinc-50">Price errors unlocked</strong>&nbsp;— glitches gated for members</li>
                  <li className="flex gap-2"><span className="text-emerald-500">✓</span> Priority niche filters &amp; early access to hot deals</li>
                </ul>
                <Link
                  href="/pricing"
                  className="mt-5 inline-block w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-emerald-400"
                >
                  Upgrade to Hunter →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Leaderboard teaser ───────────────────────────────────────── */}
        {leaders.length > 0 && (
          <section className="border-b border-zinc-200 px-6 py-10 dark:border-zinc-800">
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

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="border-b border-zinc-200 px-6 py-12 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Questions hunters ask
            </h2>
            <div className="mt-6 space-y-3">
              {[
                {
                  q: "What exactly is a price glitch?",
                  a: "A pricing error — a retailer lists an item far below its real price (a $500 item at $100). Our scanners catch them within seconds and flag them PRICE ERROR. Glitches are the highest-value finds and are unlocked for Hunter members because they get fixed fast.",
                },
                {
                  q: "Is it actually free?",
                  a: "Yes. Free accounts see the full deals feed, get daily email digests, and can use the Profit Calculator and Listing Generator forever. Hunter ($9.99/mo) adds instant multi-channel alerts and unlocks gated price errors.",
                },
                {
                  q: "How do I know the discount is real?",
                  a: "We track price history. The percentage shown compares the current price against the item's verified historical average — not the inflated 'was' price retailers advertise.",
                },
                {
                  q: "How do alerts reach me?",
                  a: "Free members get a daily email digest. Hunter members get real-time alerts through email, SMS, Discord, and Telegram — filtered to only the niches and categories you subscribe to.",
                },
                {
                  q: "Do I need experience to flip deals?",
                  a: "No. The workflow is built in: spot a deal on the feed, run it through the Profit Calculator to see net profit after fees, then generate a ready-to-post resale listing for eBay, Facebook Marketplace, or Poshmark.",
                },
                {
                  q: "Where do the deals come from?",
                  a: "Automated scanners across 500+ retailers, plus community-submitted finds, government and retail auctions, real estate listings, and verified coupon codes submitted by sellers.",
                },
              ].map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-zinc-200 bg-white px-5 py-4 open:pb-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-50 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="ml-3 text-zinc-400 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Community stats + Seller CTA ──────────────────────────────── */}
        <section className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-12">
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
        <section className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-16">
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
                href="/deals"
                className="rounded-xl border border-zinc-300 px-7 py-3.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Browse deals
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
