"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ─── Platform fee data (mirrors profit calculator) ──────────────────────────

type PlatformKey =
  | "ebay"
  | "facebook"
  | "craigslist"
  | "mercari"
  | "poshmark"
  | "depop"
  | "offerup";

interface PlatformInfo {
  key: PlatformKey;
  label: string;
  percent: number; // fee as fraction of sell price
  flat: number; // flat fee per order in $
  note?: string;
}

const PLATFORMS: PlatformInfo[] = [
  { key: "ebay", label: "eBay", percent: 0.1325, flat: 0.3, note: "13.25% final value fee + $0.30 per order" },
  { key: "facebook", label: "Facebook Marketplace", percent: 0.05, flat: 0, note: "5% fee ($0.40 for items under $8)" },
  { key: "craigslist", label: "Craigslist", percent: 0, flat: 0, note: "Free for local pickup" },
  { key: "mercari", label: "Mercari", percent: 0.1, flat: 0.3, note: "10% + $0.30" },
  { key: "poshmark", label: "Poshmark", percent: 0.2, flat: 0, note: "20% fee (flat $2 for items under $15)" },
  { key: "depop", label: "Depop", percent: 0.1, flat: 0.3, note: "10% + $0.30" },
  { key: "offerup", label: "OfferUp", percent: 0.129, flat: 0.3, note: "12.9% + $0.30" },
];

// Apply special-case rules (Facebook under $8, Poshmark under $15)
function computeFee(p: PlatformInfo, sellPrice: number): number {
  if (p.key === "facebook" && sellPrice > 0 && sellPrice < 8) {
    return 0.4;
  }
  if (p.key === "poshmark" && sellPrice > 0 && sellPrice < 15) {
    return 2;
  }
  return sellPrice * p.percent + p.flat;
}

// ─── Category config ────────────────────────────────────────────────────────

type CategoryKey =
  | "electronics"
  | "home_garden"
  | "clothing"
  | "toys"
  | "tools"
  | "sports"
  | "books"
  | "other";

interface CategoryInfo {
  key: CategoryKey;
  label: string;
  keyword: string; // keyword appended to title
  bestDay: string;
  bestDuration: string;
  tagSeeds: string[];
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: "electronics",
    label: "Electronics",
    keyword: "Electronics",
    bestDay: "Sunday evening (6–8 PM EST)",
    bestDuration: "7-day auction",
    tagSeeds: ["electronics", "tech", "gadget", "device", "tech accessories"],
  },
  {
    key: "home_garden",
    label: "Home & Garden",
    keyword: "Home & Garden",
    bestDay: "Saturday morning (9–11 AM EST)",
    bestDuration: "30-day Buy It Now",
    tagSeeds: ["home", "garden", "household", "decor", "home improvement"],
  },
  {
    key: "clothing",
    label: "Clothing",
    keyword: "Apparel",
    bestDay: "Thursday evening (7–9 PM EST)",
    bestDuration: "30-day Buy It Now",
    tagSeeds: ["clothing", "fashion", "apparel", "style", "wardrobe"],
  },
  {
    key: "toys",
    label: "Toys",
    keyword: "Toys & Games",
    bestDay: "Sunday afternoon (2–4 PM EST)",
    bestDuration: "7-day auction",
    tagSeeds: ["toys", "games", "kids", "collectible", "play"],
  },
  {
    key: "tools",
    label: "Tools",
    keyword: "Tools",
    bestDay: "Tuesday evening (6–8 PM EST)",
    bestDuration: "30-day Buy It Now",
    tagSeeds: ["tools", "hardware", "diy", "power tools", "workshop"],
  },
  {
    key: "sports",
    label: "Sports",
    keyword: "Sporting Goods",
    bestDay: "Monday evening (6–8 PM EST)",
    bestDuration: "30-day Buy It Now",
    tagSeeds: ["sports", "fitness", "outdoor", "athletic", "gear"],
  },
  {
    key: "books",
    label: "Books",
    keyword: "Books",
    bestDay: "Sunday evening (6–8 PM EST)",
    bestDuration: "7-day auction",
    tagSeeds: ["books", "reading", "literature", "textbook", "novel"],
  },
  {
    key: "other",
    label: "Other",
    keyword: "Misc",
    bestDay: "Sunday evening (6–8 PM EST)",
    bestDuration: "30-day Buy It Now",
    tagSeeds: ["deal", "sale", "bargain", "discount", "quality"],
  },
];

// ─── Condition config ───────────────────────────────────────────────────────

type ConditionKey = "new" | "like_new" | "very_good" | "good" | "acceptable";

interface ConditionInfo {
  key: ConditionKey;
  label: string;
  titleWord: string;
  description: string;
}

const CONDITIONS: ConditionInfo[] = [
  { key: "new", label: "New", titleWord: "New", description: "Brand new, sealed in original packaging. Never opened, never used." },
  { key: "like_new", label: "Like New", titleWord: "Like New", description: "Barely used, no scratches or marks. Comes with original packaging and accessories." },
  { key: "very_good", label: "Very Good", titleWord: "Very Good", description: "Lightly used with minimal signs of wear. Fully functional and well cared for." },
  { key: "good", label: "Good", titleWord: "Good", description: "Used condition with some cosmetic wear. Works perfectly and has plenty of life left." },
  { key: "acceptable", label: "Acceptable", titleWord: "Acceptable", description: "Shows visible wear from regular use but remains fully functional. Priced accordingly." },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Capitalize the first letter of a feature phrase
function capFeature(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Listing generation logic ───────────────────────────────────────────────

interface GeneratedListing {
  title: string;
  description: string;
  tags: string[];
  buyItNow: number;
  auctionStart: number;
  minOffer: number;
  bestDay: string;
  bestDuration: string;
  titleTruncated: boolean;
}

function generateListing(opts: {
  productTitle: string;
  buyPrice: number;
  platform: PlatformInfo;
  condition: ConditionInfo;
  category: CategoryInfo;
  features: string[];
  shippingIncluded: boolean;
}): GeneratedListing | null {
  const { productTitle, buyPrice, platform, condition, category, features, shippingIncluded } = opts;
  if (!productTitle.trim()) return null;

  const titleParts: string[] = [];
  // Brand/Type = product title (trimmed)
  titleParts.push(productTitle.trim());
  // Key Feature 1 & 2
  if (features[0]) titleParts.push(capFeature(features[0]));
  if (features[1]) titleParts.push(capFeature(features[1]));
  // Condition
  titleParts.push(condition.titleWord);
  // Category keyword
  titleParts.push(category.keyword);

  let title = titleParts.join(" ");
  // Truncate to 60 chars for eBay
  const titleTruncated = title.length > 60;
  if (titleTruncated) {
    title = title.slice(0, 57).trimEnd() + "...";
  }

  // Description
  const lines: string[] = [];
  lines.push(`🔥 ${productTitle.trim()}`);
  lines.push("");
  lines.push(
    `Up for sale is ${productTitle.trim()} in ${condition.label} condition.`
  );
  if (features.length > 0) {
    lines.push(
      `This item ${features.length > 1 ? "features" : "features"} ${features.slice(0, 2).map((f) => capFeature(f).toLowerCase()).join(" and ")}.`
    );
  }
  lines.push("");
  if (features.length > 0) {
    lines.push("✅ Key Features:");
    features.forEach((f) => {
      const feat = f.trim();
      if (feat) lines.push(`• ${capFeature(feat)}`);
    });
    lines.push("");
  }
  lines.push(`📦 Condition: ${condition.label} — ${condition.description}`);
  lines.push("");
  if (shippingIncluded) {
    lines.push("🚚 Free Shipping — ships within 1 business day via USPS Priority Mail");
  } else {
    lines.push("🚚 Ships within 1 business day — buyer pays shipping");
  }
  lines.push("");
  lines.push("💰 Why buy from me?");
  lines.push("• Trusted seller with fast shipping");
  lines.push("• 30-day return policy");
  lines.push("• Smoke-free, pet-free home");
  lines.push("");
  lines.push("Don't miss out — these won't last long! Message me with any questions.");

  const description = lines.join("\n");

  // Tags
  const tagSet = new Set<string>();
  // From product title words
  productTitle
    .toLowerCase()
    .split(/\s+/)
    .forEach((w) => {
      const clean = w.replace(/[^a-z0-9]/g, "");
      if (clean.length >= 3) tagSet.add(clean);
    });
  // From features
  features.forEach((f) => {
    f.toLowerCase()
      .split(/\s+/)
      .forEach((w) => {
        const clean = w.replace(/[^a-z0-9]/g, "");
        if (clean.length >= 3) tagSet.add(clean);
      });
  });
  // From category seeds
  category.tagSeeds.forEach((t) => tagSet.add(t));
  // Condition
  tagSet.add(condition.label.toLowerCase());
  // Platform
  tagSet.add(platform.label.toLowerCase().replace(/\s+/g, ""));
  const tags = Array.from(tagSet).slice(0, 15);

  // Pricing — suggest sell prices based on buy price & platform fees
  // Target a healthy margin: aim for ~40-60% markup over buy price
  // Buy It Now: price that yields ~30% ROI after fees
  // Auction start: ~15% below BIN to attract bidding
  // Min offer: break-even + small buffer
  let buyItNow = 0;
  let auctionStart = 0;
  let minOffer = 0;

  if (buyPrice > 0) {
    // Solve for sell price giving 30% ROI: profit = 0.3 * totalCosts
    // netProfit = sell - fee(sell) - buyPrice  (ignore shipping for suggestion)
    // 0.3*buy = sell*(1-pct) - flat - buy  => sell = (0.3*buy + buy + flat)/(1-pct)
    const denom = 1 - platform.percent;
    if (denom > 0) {
      buyItNow = (1.3 * buyPrice + platform.flat) / denom;
    } else {
      buyItNow = 1.3 * buyPrice + platform.flat;
    }
    // Round to nearest $0.99
    buyItNow = Math.max(buyItNow, buyPrice + 1);
    buyItNow = Math.round(buyItNow) - 0.01;

    auctionStart = Math.round(buyItNow * 0.85) - 0.01;
    if (auctionStart < buyPrice) auctionStart = buyPrice;

    // Min offer = break-even + $2 buffer
    let breakEven = 0;
    if (platform.key === "facebook" || platform.key === "poshmark") {
      let lo = 0;
      let hi = 100000;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const f = computeFee(platform, mid);
        const profit = mid - f - buyPrice;
        if (profit < 0) lo = mid;
        else hi = mid;
      }
      breakEven = (lo + hi) / 2;
    } else {
      if (denom > 0) {
        breakEven = (buyPrice + platform.flat) / denom;
      } else {
        breakEven = buyPrice + platform.flat;
      }
    }
    minOffer = Math.round(breakEven + 2) - 0.01;
    if (minOffer < buyPrice) minOffer = buyPrice;
  }

  return {
    title,
    description,
    tags,
    buyItNow,
    auctionStart,
    minOffer,
    bestDay: category.bestDay,
    bestDuration: category.bestDuration,
    titleTruncated,
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ListingGenerator({
  embedded = false,
  initialTitle,
  initialBuy,
  initialPlatform,
}: {
  embedded?: boolean;
  initialTitle?: string;
  initialBuy?: string;
  initialPlatform?: string;
}) {
  const [productTitle, setProductTitle] = useState(initialTitle || "");
  const [buyPrice, setBuyPrice] = useState(initialBuy || "");
  const [platformKey, setPlatformKey] = useState<PlatformKey>(
    (PLATFORMS.some((p) => p.key === initialPlatform) ? initialPlatform : "ebay") as PlatformKey
  );
  const [conditionKey, setConditionKey] = useState<ConditionKey>("like_new");
  const [categoryKey, setCategoryKey] = useState<CategoryKey>("electronics");
  const [featuresText, setFeaturesText] = useState("");
  const [shippingIncluded, setShippingIncluded] = useState(true);

  const [copiedListing, setCopiedListing] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);

  // Prefill from query params (props take precedence when embedded)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const title = q.get("title");
    const buy = q.get("buy");
    const platform = q.get("platform");
    if (title && !initialTitle) setProductTitle(title);
    if (buy && !initialBuy) setBuyPrice(buy);
    if (platform && !initialPlatform && PLATFORMS.some((p) => p.key === platform)) {
      setPlatformKey(platform as PlatformKey);
    }
  }, [initialTitle, initialBuy, initialPlatform]);

  const platform = PLATFORMS.find((p) => p.key === platformKey)!;
  const condition = CONDITIONS.find((c) => c.key === conditionKey)!;
  const category = CATEGORIES.find((c) => c.key === categoryKey)!;

  const features = useMemo(
    () => featuresText.split(",").map((f) => f.trim()).filter(Boolean),
    [featuresText]
  );

  const listing = useMemo(
    () =>
      generateListing({
        productTitle,
        buyPrice: parseFloat(buyPrice) || 0,
        platform,
        condition,
        category,
        features,
        shippingIncluded,
      }),
    [productTitle, buyPrice, platform, condition, category, features, shippingIncluded]
  );

  const hasInput = productTitle.trim().length > 0;

  function copyListing() {
    if (!listing) return;
    const text = `${listing.title}\n\n${listing.description}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedListing(true);
      setTimeout(() => setCopiedListing(false), 2000);
    });
  }

  function copyTitle() {
    if (!listing) return;
    navigator.clipboard.writeText(listing.title).then(() => {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    });
  }

  function copyTags() {
    if (!listing) return;
    navigator.clipboard.writeText(listing.tags.join(", ")).then(() => {
      setCopiedTags(true);
      setTimeout(() => setCopiedTags(false), 2000);
    });
  }

  return (
    <>
        {!embedded && (
          <>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-6 py-14 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-5">
            Free Tool
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-[1.1]">
            AI Listing Generator
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Generate optimized resale listings for eBay, Facebook Marketplace, Mercari, and more.
            Get SEO-friendly titles, professional descriptions, smart pricing, and tags — instantly.
          </p>
        </section>
          </>
        )}

        {/* ── Generator ────────────────────────────────────────────────── */}
        <section className="px-6 py-10">
          <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">

            {/* Inputs */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Product Details</h2>

              <div className="space-y-4">
                <Field label="Product Title" required>
                  <input
                    type="text"
                    value={productTitle}
                    onChange={(e) => setProductTitle(e.target.value)}
                    placeholder="e.g., Sony WH-1000XM5 Headphones"
                    className={inputCls}
                  />
                </Field>

                <Field label="Buy Price ($)" required>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Sell Platform">
                  <select
                    value={platformKey}
                    onChange={(e) => setPlatformKey(e.target.value as PlatformKey)}
                    className={inputCls}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{platform.note}</p>
                </Field>

                <Field label="Condition">
                  <select
                    value={conditionKey}
                    onChange={(e) => setConditionKey(e.target.value as ConditionKey)}
                    className={inputCls}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Category">
                  <select
                    value={categoryKey}
                    onChange={(e) => setCategoryKey(e.target.value as CategoryKey)}
                    className={inputCls}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Key Features" hint="comma separated">
                  <textarea
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    placeholder="wireless, noise cancelling, 30hr battery"
                    rows={3}
                    className={inputCls + " resize-none"}
                  />
                </Field>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={shippingIncluded}
                    onChange={(e) => setShippingIncluded(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Shipping included? <span className="text-zinc-400 dark:text-zinc-500 font-normal">(adds &quot;Free Shipping&quot; to listing)</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Generated listing preview */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Generated Listing</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyTitle}
                    disabled={!hasInput}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {copiedTitle ? "Copied!" : "Copy title"}
                  </button>
                  <button
                    onClick={copyListing}
                    disabled={!hasInput}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copiedListing ? "Copied!" : "Copy listing"}
                  </button>
                </div>
              </div>

              {!listing ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Enter a product title to generate your listing.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Optimized Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Optimized Title</span>
                      <span className={`text-xs tabular-nums ${listing.titleTruncated ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {listing.title.length}/60
                      </span>
                    </div>
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-50">
                      {listing.title}
                    </div>
                    {listing.titleTruncated && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Title truncated to fit eBay&apos;s 80-char limit (optimized for 60).</p>
                    )}
                  </div>

                  {/* Listing Description preview */}
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Listing Description</span>
                    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{listing.description}</pre>
                    </div>
                  </div>

                  {/* Suggested Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Suggested Tags / Keywords</span>
                      <button
                        onClick={copyTags}
                        className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      >
                        {copiedTags ? "Copied!" : "Copy tags"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {listing.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Pricing */}
                  <div>
                    <span className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Suggested Pricing</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Buy It Now</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {listing.buyItNow > 0 ? fmt(listing.buyItNow) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Auction Start</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {listing.auctionStart > 0 ? fmt(listing.auctionStart) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Min Offer</p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                          {listing.minOffer > 0 ? fmt(listing.minOffer) : "—"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Pricing targets ~30% ROI after {platform.label} fees. Adjust based on market comps.
                    </p>
                  </div>

                  {/* Best Listing Time */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Best Time to List</p>
                    <p className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-300">
                      Best day: {listing.bestDay}
                    </p>
                    <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-400/80">
                      Recommended: {listing.bestDuration}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {!embedded && (
          <>
        {/* ── SEO Content ──────────────────────────────────────────────── */}
        <section className="px-6 py-12 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl space-y-10">

            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                How to Write a Listing That Sells
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <p>
                  A great listing is the difference between a sale in a day and an item sitting for months.
                  The title is your headline — it&apos;s what buyers search for and what the marketplace algorithm
                  ranks. <strong className="text-zinc-900 dark:text-zinc-50">Pack it with keywords</strong>: brand,
                  model, key features, condition, and category. eBay allows 80 characters, but the first 60 carry
                  the most weight in search. Our generator builds titles using a proven formula —
                  <strong className="text-zinc-900 dark:text-zinc-50"> [Brand/Type] [Feature] [Feature] [Condition] [Category]</strong> —
                  and trims to 60 characters so your listing shows up in more searches.
                </p>
                <p>
                  The description is where you convert a searcher into a buyer. Start with a hook, list the key
                  features as scannable bullet points, be honest about the condition, and always include shipping
                  info and a call to action. Buyers trust sellers who are upfront — a
                  <strong className="text-zinc-900 dark:text-zinc-50"> &quot;why buy from me&quot;</strong> section
                  with your return policy and shipping speed builds confidence. Our generator handles all of this
                  automatically, formatting it with emojis and clean spacing that works across eBay, Facebook
                  Marketplace, Mercari, Poshmark, Depop, and OfferUp.
                </p>
                <p>
                  Pricing is where most resellers leave money on the table. Price too high and your item won&apos;t
                  sell; price too low and you erode your margin. Our generator suggests three prices based on your
                  buy price and the platform&apos;s fee structure: a <strong className="text-zinc-900 dark:text-zinc-50">Buy It Now</strong> price
                  targeting ~30% ROI, an <strong className="text-zinc-900 dark:text-zinc-50">auction starting price</strong> about 15% below
                  that to attract bids, and a <strong className="text-zinc-900 dark:text-zinc-50">minimum acceptable offer</strong> at your
                  break-even plus a small buffer. Always check completed sold listings on your platform to validate
                  these suggestions against real market data.
                </p>
              </div>
            </div>

            {/* Platform-specific tips */}
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                Platform-Specific Listing Tips
              </h3>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">eBay:</strong> Use all 80 title characters. Sunday evening is the best time to list — buyers are browsing. 7-day auctions ending on Sunday get the most bids.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Facebook Marketplace:</strong> Keep it local-friendly. Post clear photos and respond fast — the algorithm rewards active sellers. Saturday mornings get the most engagement.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Mercari:</strong> Add as many tags as allowed — Mercari&apos;s search is tag-driven. Price slightly above your target and enable offers; buyers love to negotiate.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Poshmark:</strong> Clothing sells best here. Use brand names in the title and share your listing to parties multiple times a day. Thursday evenings are prime shopping time.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Depop:</strong> Aesthetic matters — pair this listing with clean, well-lit photos. Use trending keywords and hashtags. Gen Z buyers browse in the evening.</span></li>
              </ul>
            </div>

            {/* Cross-link to profit calculator */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Calculate your profit first
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                Before you list, make sure the deal is actually profitable. Our free profit calculator factors in
                platform fees, shipping, and taxes so you know your net profit and ROI up front.
              </p>
              <Link
                href="/tools/profit-calculator"
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Try our Profit Calculator →
              </Link>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-50 px-6 py-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white dark:text-zinc-900">
                Find deals worth listing.
              </h2>
              <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-600 max-w-lg mx-auto">
                BargainHuntrs scans 500+ retailers in real time and surfaces clearance deals and price glitches with
                the profit spread already calculated. Stop guessing — start flipping.
              </p>
              <div className="mt-6">
                <Link
                  href="/signup"
                  className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Get deal alerts free
                </Link>
              </div>
            </div>

          </div>
        </section>
          </>
        )}
      </>
  );
}

// ─── Small UI helpers ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500";

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
        {hint && <span className="text-zinc-400 dark:text-zinc-600 font-normal"> — {hint}</span>}
      </span>
      {children}
    </label>
  );
}
