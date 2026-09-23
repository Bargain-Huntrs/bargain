"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getPublicDeals,
  getDeals,
  getDealStats,
  getNiches,
  trackAffiliateClick,
  clickAffiliatePublic,
  getPricePrediction,
  addUtmParameters,
  createClaim,
  type ArbitrageDeal,
  type Niche,
  type PricePrediction,
} from "@/lib/api";

export default function DealsPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();

  const [deals, setDeals] = useState<ArbitrageDeal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [minProfit, setMinProfit] = useState<string>("");
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [error, setError] = useState("");
  const [predictions, setPredictions] = useState<Record<string, PricePrediction>>({});
  const [loadingPrediction, setLoadingPrediction] = useState<Record<string, boolean>>({});
  const [clickingDeal, setClickingDeal] = useState<string | null>(null);
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);
  const [claimedDealIds, setClaimedDealIds] = useState<Set<string>>(new Set());
  const [claimingDeal, setClaimingDeal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRetailer, setFilterRetailer] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);

  const isPaidTier = (user?.subscriptionTier || "").toLowerCase() === "pro" ||
    (user?.subscriptionTier || "").toLowerCase() === "enterprise";

  // Load deals — public for logged-out users, authenticated for logged-in users
  const loadDeals = useCallback(async () => {
    setLoadingDeals(true);
    setError("");
    try {
      if (idToken) {
        const data = await getDeals(idToken, {
          tier: selectedTier || undefined,
          niche: selectedNiche || undefined,
          min_profit: minProfit ? parseFloat(minProfit) : undefined,
          limit: 100,
        });
        // Client-side filter for nearby/online
        let filtered = data;
        if (filterSource === "nearby") {
          const nearbyRetailers = ["walmart", "target", "best_buy", "bestbuy",
            "home_depot", "homedepot", "lowes", "costco", "samsclub", "sams_club",
            "kohls", "macys", "office_depot", "staples", "petsmart", "petco",
            "academy", "tj_maxx", "marshalls", "ross", "ulta", "sephora"];
          filtered = data.filter(d => nearbyRetailers.includes(d.retailer || ""));
        } else if (filterSource === "online") {
          filtered = data.filter(d => (d.deal_source || "online") === "online" &&
            !["walmart", "target", "best_buy", "bestbuy", "home_depot", "homedepot",
              "lowes", "costco", "samsclub", "sams_club", "kohls", "macys"].includes(d.retailer || ""));
        }
        setDeals(filtered);
      } else {
        // Public deals — no auth needed, pass source filter to API
        const data = await getPublicDeals(100, 0, filterSource || undefined);
        setDeals(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    } finally {
      setLoadingDeals(false);
    }
  }, [idToken, selectedTier, selectedNiche, minProfit, filterSource]);

  const loadStats = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await getDealStats(idToken);
      setStats(data);
    } catch {
      // Non-critical
    }
  }, [idToken]);

  const loadNiches = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await getNiches(idToken);
      setNiches(data);
    } catch {
      // Non-critical — niche filter just won't render
    }
  }, [idToken]);

  // Seed search from ?q= (homepage search bar lands here)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearchQuery(q);
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    if (idToken) {
      loadStats();
      loadNiches();
    }
  }, [idToken, loadStats, loadNiches]);

  const handleDealClick = useCallback(
    async (deal: ArbitrageDeal, e: React.MouseEvent) => {
      e.preventDefault();
      if (!deal.buy_url) return;
      setClickingDeal(deal.id);
      // Tag outgoing deal links from the deal feed
      const dealUrl = addUtmParameters(deal.buy_url, "bargainhuntrs", "deal_card", "deal_click");
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
          // Public affiliate click — no auth needed
          const result = await clickAffiliatePublic({
            url: dealUrl,
            retailer: deal.retailer || "amazon",
            asin: deal.asin,
            deal_id: deal.id,
          });
          window.open(result.affiliate_url || dealUrl, "_blank", "noopener,noreferrer");
        }
      } catch {
        // Fallback to the UTM-tagged URL if tracking fails
        window.open(dealUrl, "_blank", "noopener,noreferrer");
      } finally {
        setClickingDeal(null);
      }
    },
    [idToken]
  );

  const handleShare = useCallback(
    async (deal: ArbitrageDeal) => {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://www.bargainhuntrs.com";
      const shareUrl = addUtmParameters(
        `${baseUrl}/deals/${deal.id}`,
        "bargainhuntrs",
        "share",
        "deal_share"
      );
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedDealId(deal.id);
        setTimeout(() => setCopiedDealId(null), 2000);
      } catch {
        // Non-critical
      }
    },
    []
  );

  const handleClaim = useCallback(
    async (deal: ArbitrageDeal) => {
      if (!idToken || claimedDealIds.has(deal.id)) return;
      setClaimingDeal(deal.id);
      try {
        await createClaim(idToken, { deal_id: deal.id });
        setClaimedDealIds((prev) => new Set(prev).add(deal.id));
      } catch {
        // Non-critical
      } finally {
        setClaimingDeal(null);
      }
    },
    [idToken, claimedDealIds]
  );

  const handleLoadPrediction = useCallback(
    async (dealId: string) => {
      if (!idToken || predictions[dealId]) return;
      setLoadingPrediction((prev) => ({ ...prev, [dealId]: true }));
      try {
        const prediction = await getPricePrediction(idToken, dealId);
        setPredictions((prev) => ({ ...prev, [dealId]: prediction }));
      } catch (err) {
        // Non-critical — store a minimal error state so UI doesn't refetch
        setPredictions((prev) => ({
          ...prev,
          [dealId]: {
            deal_id: dealId,
            asin: "",
            current_price: 0,
            tier: "free",
            message: err instanceof Error ? err.message : "Prediction unavailable",
          },
        }));
      } finally {
        setLoadingPrediction((prev) => ({ ...prev, [dealId]: false }));
      }
    },
    [idToken, predictions]
  );

  const visibleDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.retailer || "").toLowerCase().includes(q) ||
        (d.category || "").toLowerCase().includes(q)
    );
  }, [deals, searchQuery]);

  function formatTier(tier: string): { label: string; color: string } {
    switch (tier) {
      case "glitch":
        return { label: "⚡ GLITCH", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" };
      case "clearance":
        return { label: "CLEARANCE", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400" };
      case "arbitrage":
        return { label: "ARBITRAGE", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" };
      case "watch":
        return { label: "WATCH", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" };
      default:
        return { label: tier.toUpperCase(), color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
    }
  }

  function formatPrediction(rec: string): { label: string; color: string; arrow: string } {
    switch (rec) {
      case "buy_now":
        return { label: "BUY NOW", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", arrow: "↓" };
      case "wait":
        return { label: "WAIT", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", arrow: "↓" };
      case "monitor":
        return { label: "MONITOR", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", arrow: "→" };
      default:
        return { label: rec.toUpperCase(), color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", arrow: "→" };
    }
  }

  function trendArrow(trend: string): string {
    if (trend === "decreasing") return "↓";
    if (trend === "increasing") return "↑";
    return "→";
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1">
        {/* Header */}
        <section className="px-6 py-10 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Deal Feed
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Live arbitrage opportunities scraped from 500+ retailers. Sorted by profit.
            </p>

            {/* Stats */}
            {stats && (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Deals</p>
                  <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {stats.total_profitable_deals ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Active</p>
                  <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stats.active_deals ?? 0}
                  </p>
                </div>
                {stats.tier_counts &&
                  Object.entries(stats.tier_counts).map(([tier, count]: [string, any]) => (
                    <div key={tier} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{tier}</p>
                      <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{count}</p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Source tabs: All / Online / Nearby */}
        <section className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="mx-auto max-w-7xl">
            <div className="flex gap-1">
              {[
                { key: "", label: "All", icon: "📋" },
                { key: "online", label: "Online", icon: "💻" },
                { key: "nearby", label: "Nearby", icon: "📍" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterSource(tab.key || null)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    filterSource === (tab.key || null)
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Niche filter chips */}
        {niches.length > 0 && (
          <section className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
            <div className="mx-auto max-w-6xl">
              <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-thin">
                <button
                  onClick={() => setSelectedNiche("")}
                  className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    selectedNiche === ""
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  All
                </button>
                {niches.map((n) => (
                  <button
                    key={n.key}
                    onClick={() => setSelectedNiche(n.key)}
                    className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedNiche === n.key
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    <span className="mr-1">{n.emoji}</span>
                    {n.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center gap-4">
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All tiers</option>
              <option value="glitch">⚡ Glitch</option>
              <option value="clearance">Clearance</option>
              <option value="arbitrage">Arbitrage</option>
              <option value="watch">Watch</option>
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deals..."
              className="w-48 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <input
              type="number"
              value={minProfit}
              onChange={(e) => setMinProfit(e.target.value)}
              placeholder="Min profit $"
              className="w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {(selectedTier || minProfit || selectedNiche || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedTier("");
                  setMinProfit("");
                  setSelectedNiche("");
                  setSearchQuery("");
                }}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {/* Deals grid */}
        <section className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Signup banner for non-logged-in users */}
            {!idToken && !loadingDeals && deals.length > 0 && (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50 px-4 py-3 dark:from-emerald-950/50 dark:to-emerald-950/50">
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

            {loadingDeals ? (
              <div className="flex justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-500" />
              </div>
            ) : visibleDeals.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {searchQuery.trim()
                    ? `No deals matching "${searchQuery.trim()}". Try a different search or clear filters.`
                    : "No deals found yet. Deals appear here when the scanner finds profitable arbitrage opportunities."}
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {visibleDeals.length} deal{visibleDeals.length !== 1 ? "s" : ""}
                  {searchQuery.trim() && ` matching "${searchQuery.trim()}"`}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {visibleDeals.map((deal) => {
                    const tier = formatTier(deal.deal_tier);
                    const discount = deal.historical_avg && deal.historical_avg > deal.buy_price
                      ? Math.round((1 - deal.buy_price / deal.historical_avg) * 100)
                      : 0;
                    const savings = deal.historical_avg && deal.historical_avg > deal.buy_price
                      ? deal.historical_avg - deal.buy_price
                      : 0;
                    return (
                      <div
                        key={deal.id}
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
                                  fallback.className = "icon-fallback flex h-full w-full items-center justify-center text-4xl";
                                  fallback.textContent = "🏷️";
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl">🏷️</div>
                          )}
                          {/* Discount badge */}
                          {discount > 0 && (
                            <div className="absolute top-2 left-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                              {discount}% OFF
                            </div>
                          )}
                          {/* Tier badge */}
                          <div className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${tier.color}`}>
                            {tier.label}
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex flex-1 flex-col p-3">
                          {/* Retailer + in-store badge */}
                          <div className="mb-1 flex items-center gap-1.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                              {(deal.retailer || "unknown").replace(/_/g, " ")}
                            </p>
                            {(() => {
                              const nearbyRetailers = ["walmart", "target", "best_buy", "bestbuy",
                                "home_depot", "homedepot", "lowes", "costco", "samsclub", "sams_club",
                                "kohls", "macys", "office_depot", "staples", "petsmart", "petco",
                                "academy", "tj_maxx", "marshalls", "ross", "ulta", "sephora"];
                              if (nearbyRetailers.includes(deal.retailer || "")) {
                                return (
                                  <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                    📍 IN-STORE
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Title */}
                          <h3 className="mb-2 line-clamp-2 text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                            {deal.title}
                          </h3>

                          {/* Price — blurred for non-logged-in users */}
                          <div className="mt-auto space-y-1">
                            {idToken ? (
                              <>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                                    ${deal.buy_price.toFixed(2)}
                                  </span>
                                  {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                                    <span className="text-xs text-zinc-400 line-through dark:text-zinc-500">
                                      ${deal.historical_avg.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                {savings > 0 && (
                                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    Save ${savings.toFixed(2)} ({discount}%)
                                  </p>
                                )}

                                {/* Profit (for logged-in users) */}
                                {deal.net_profit && deal.net_profit > 0 && (
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                    Profit: <span className="font-semibold text-emerald-600 dark:text-emerald-400">${deal.net_profit.toFixed(2)}</span>
                                    {deal.roi && <span className="ml-1">({(deal.roi * 100).toFixed(0)}% ROI)</span>}
                                  </p>
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
                                {/* Blurred price for non-logged-in users */}
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50 blur-sm select-none">
                                    $XX.XX
                                  </span>
                                  {deal.historical_avg && deal.historical_avg > deal.buy_price && (
                                    <span className="text-xs text-zinc-400 line-through blur-sm select-none dark:text-zinc-500">
                                      $XX.XX
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  Save up to {discount}% off
                                </p>
                              </>
                            )}
                          </div>

                          {/* View Deal + Share buttons */}
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
                                🔒 Sign up to view deal
                              </button>
                            )}
                            <button
                              onClick={() => handleShare(deal)}
                              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              {copiedDealId === deal.id ? "Copied!" : "Share"}
                            </button>
                          </div>
                          {idToken && (
                            <button
                              onClick={() => handleClaim(deal)}
                              disabled={claimingDeal === deal.id || claimedDealIds.has(deal.id)}
                              className="mt-2 w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950"
                            >
                              {claimedDealIds.has(deal.id)
                                ? "✓ In your haul"
                                : claimingDeal === deal.id
                                ? "Adding…"
                                : "📦 I bought this"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
