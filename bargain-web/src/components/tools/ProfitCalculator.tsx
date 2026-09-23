"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

// ─── Platform fee data ──────────────────────────────────────────────────────

type PlatformKey =
  | "ebay"
  | "amazon_individual"
  | "amazon_professional"
  | "facebook"
  | "craigslist"
  | "mercari"
  | "poshmark"
  | "depop"
  | "offerup";

interface PlatformInfo {
  key: PlatformKey;
  label: string;
  group?: string;
  percent: number; // fee as fraction of sell price (0.1325 = 13.25%)
  flat: number; // flat fee per order/item in $
  note?: string;
}

const PLATFORMS: PlatformInfo[] = [
  { key: "ebay", label: "eBay", percent: 0.1325, flat: 0.3, note: "13.25% final value fee + $0.30 per order" },
  { key: "amazon_individual", label: "Amazon (Individual)", group: "Amazon", percent: 0.15, flat: 0.99, note: "15% referral fee + $0.99 per item" },
  { key: "amazon_professional", label: "Amazon (Professional)", group: "Amazon", percent: 0.08, flat: 0, note: "8% referral fee + $39.99/mo subscription" },
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ProfitCalculator({
  embedded = false,
  initialBuy,
  initialSell,
  initialPlatform,
}: {
  embedded?: boolean;
  initialBuy?: string;
  initialSell?: string;
  initialPlatform?: string;
}) {
  const [buyPrice, setBuyPrice] = useState<string>(initialBuy || "");
  const [sellPrice, setSellPrice] = useState<string>(initialSell || "");
  const [platformKey, setPlatformKey] = useState<PlatformKey>(
    (PLATFORMS.some((p) => p.key === initialPlatform) ? initialPlatform : "ebay") as PlatformKey
  );
  const [shippingCost, setShippingCost] = useState<string>("");
  const [cogs, setCogs] = useState<string>("");
  const [salesTax, setSalesTax] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Prefill from query params (props take precedence when embedded)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const buy = q.get("buy");
    const sell = q.get("sell");
    const platform = q.get("platform");
    if (buy && !initialBuy) setBuyPrice(buy);
    if (sell && !initialSell) setSellPrice(sell);
    if (platform && !initialPlatform && PLATFORMS.some((p) => p.key === platform)) {
      setPlatformKey(platform as PlatformKey);
    }
  }, [initialBuy, initialSell, initialPlatform]);

  const platform = PLATFORMS.find((p) => p.key === platformKey)!;

  const calc = useMemo(() => {
    const buy = parseFloat(buyPrice) || 0;
    const sell = parseFloat(sellPrice) || 0;
    const shipping = parseFloat(shippingCost) || 0;
    const goods = parseFloat(cogs) || 0;
    const tax = parseFloat(salesTax) || 0;

    const grossRevenue = sell - shipping; // what you collect before fees (shipping paid by buyer excluded from revenue)
    const platformFee = computeFee(platform, sell);
    const netRevenue = grossRevenue - platformFee;
    const totalCosts = buy + shipping + goods + tax;
    const netProfit = netRevenue - totalCosts;
    const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;
    const margin = sell > 0 ? (netProfit / sell) * 100 : 0;

    // Break-even: sell price where netProfit = 0
    // netProfit = sell - shipping - fee(sell) - totalCosts = 0
    // For percentage+flat: sell*(1-pct) = shipping + flat + totalCosts
    let breakEven = 0;
    if (platform.key === "facebook" || platform.key === "poshmark") {
      // Has tiered flat rules; solve iteratively
      let lo = 0;
      let hi = 100000;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const f = computeFee(platform, mid);
        const profit = mid - shipping - f - totalCosts;
        if (profit < 0) lo = mid;
        else hi = mid;
      }
      breakEven = (lo + hi) / 2;
    } else {
      const denom = 1 - platform.percent;
      if (denom > 0) {
        breakEven = (shipping + platform.flat + totalCosts) / denom;
      } else {
        breakEven = shipping + platform.flat + totalCosts;
      }
    }
    if (breakEven < 0) breakEven = 0;

    return {
      buy, sell, shipping, goods, tax,
      grossRevenue, platformFee, netRevenue, totalCosts,
      netProfit, roi, margin, breakEven,
    };
  }, [buyPrice, sellPrice, shippingCost, cogs, salesTax, platform]);

  const profitable = calc.netProfit > 0;
  const hasInput = calc.buy > 0 || calc.sell > 0;

  function handleCopy() {
    const lines = [
      "BargainHuntrs Profit Calculator",
      `Platform: ${platform.label}`,
      `Buy Price: ${fmt(calc.buy)}`,
      `Sell Price: ${fmt(calc.sell)}`,
      `Shipping Cost: ${fmt(calc.shipping)}`,
      `Platform Fee: ${fmt(calc.platformFee)}`,
      `Total Costs: ${fmt(calc.totalCosts)}`,
      `Net Profit: ${fmt(calc.netProfit)}`,
      `ROI: ${pct(calc.roi)}`,
      `Profit Margin: ${pct(calc.margin)}`,
      `Break-even Sell Price: ${fmt(calc.breakEven)}`,
      "",
      "Calculated at bargainhuntrs.com/tools/profit-calculator",
    ].join("\n");
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ROI / margin progress bar fill (capped at 100% for display)
  const roiFill = Math.max(0, Math.min(100, calc.roi));
  const marginFill = Math.max(0, Math.min(100, calc.margin));

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
            Arbitrage Profit Calculator
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Calculate your net profit, ROI, and platform fees for eBay, Amazon, Facebook Marketplace, and more.
            Find out if a deal is worth flipping — before you spend a dollar.
          </p>
        </section>
          </>
        )}

        {/* ── Calculator ───────────────────────────────────────────────── */}
        <section className="px-6 py-10">
          <div className="mx-auto max-w-5xl grid gap-6 lg:grid-cols-2">

            {/* Inputs */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-5">Deal Details</h2>

              <div className="space-y-4">
                <Field label="Buy Price ($)" required>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Sell Price ($)" required>
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Platform">
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

                <Field label="Shipping Cost ($)" hint="optional">
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Cost of Goods Sold ($)" hint="packaging, tape, etc.">
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={cogs}
                    onChange={(e) => setCogs(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                <Field label="Sales Tax on Purchase ($)" hint="optional">
                  <input
                    type="number" inputMode="decimal" min="0" step="0.01"
                    value={salesTax}
                    onChange={(e) => setSalesTax(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* Results */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Results</h2>
                <button
                  onClick={handleCopy}
                  disabled={!hasInput}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {copied ? "Copied!" : "Copy results"}
                </button>
              </div>

              {/* Net Profit headline */}
              <div className={`rounded-xl p-5 mb-5 text-center ${profitable ? "bg-emerald-50 dark:bg-emerald-950/30" : hasInput ? "bg-red-50 dark:bg-red-950/30" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Net Profit</p>
                <p className={`mt-1 text-4xl font-black tabular-nums ${profitable ? "text-emerald-600 dark:text-emerald-400" : hasInput ? "text-red-600 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                  {hasInput ? fmt(calc.netProfit) : "$0.00"}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {hasInput ? (profitable ? "Profitable deal" : "You'd lose money") : "Enter prices to calculate"}
                </p>
              </div>

              {/* ROI & Margin bars */}
              <div className="space-y-4 mb-5">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">ROI</span>
                    <span className={`font-bold tabular-nums ${calc.roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{hasInput ? pct(calc.roi) : "—"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${calc.roi >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${roiFill}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400">Profit Margin</span>
                    <span className={`font-bold tabular-nums ${calc.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{hasInput ? pct(calc.margin) : "—"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${calc.margin >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${marginFill}%` }} />
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <dl className="space-y-2.5 text-sm">
                <Row label="Gross Revenue" value={fmt(calc.grossRevenue)} />
                <Row label="Platform Fee" value={`- ${fmt(calc.platformFee)}`} />
                <Row label="Net Revenue" value={fmt(calc.netRevenue)} />
                <div className="border-t border-zinc-100 dark:border-zinc-800 my-1" />
                <Row label="Buy Price" value={`- ${fmt(calc.buy)}`} />
                <Row label="Shipping Cost" value={`- ${fmt(calc.shipping)}`} />
                <Row label="Cost of Goods" value={`- ${fmt(calc.goods)}`} />
                <Row label="Sales Tax" value={`- ${fmt(calc.tax)}`} />
                <Row label="Total Costs" value={`- ${fmt(calc.totalCosts)} ${hasInput ? "" : ""}`} />
              </dl>

              {/* Break-even */}
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">Break-even Sell Price</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-300">{fmt(calc.breakEven)}</p>
                <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/70">Don&apos;t sell below this</p>
              </div>
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
                How to Calculate Arbitrage Profit
              </h2>
              <div className="space-y-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <p>
                  Arbitrage profit is the money left over after you buy a product at one price and resell it at a
                  higher price — once every fee, shipping cost, and tax is accounted for. The formula is simple in
                  theory but easy to get wrong in practice: <strong className="text-zinc-900 dark:text-zinc-50">Net Profit = Sell Price − Platform Fees − Buy Price − Shipping − Other Costs</strong>.
                  Most new flippers forget to factor in the platform fee and end up shocked when their &quot;profit&quot;
                  disappears.
                </p>
                <p>
                  Every marketplace takes a cut. <strong className="text-zinc-900 dark:text-zinc-50">eBay</strong> charges a
                  13.25% final value fee plus a $0.30 per-order fee on the total sale amount (including shipping).
                  <strong className="text-zinc-900 dark:text-zinc-50"> Amazon</strong> takes a 15% referral fee plus $0.99
                  per item on the Individual plan, or 8% plus a $39.99/month subscription on the Professional plan.
                  <strong className="text-zinc-900 dark:text-zinc-50"> Facebook Marketplace</strong> is cheaper at 5%, while
                  <strong className="text-zinc-900 dark:text-zinc-50"> Poshmark</strong> takes the biggest bite at 20%.
                  Shipping costs — both what you pay to send the item and what the buyer pays — directly affect your
                  net profit and should always be entered into the calculator.
                </p>
                <p>
                  Here&apos;s a worked example. Say you buy a pair of headphones for $40 and flip them on eBay for $80.
                  eBay&apos;s fee is 13.25% of $80 ($10.60) plus $0.30, so $10.90. If shipping costs you $8 and you
                  paid $3 in sales tax, your total costs are $40 + $8 + $3 = $51. Your net revenue is $80 − $10.90 =
                  $69.10, and your net profit is $69.10 − $51 = <strong className="text-emerald-600 dark:text-emerald-400">$18.10</strong>.
                  That&apos;s a 35.5% ROI and a 22.6% profit margin — a solid flip.
                </p>
                <p>
                  The break-even sell price is the minimum you can charge without losing money. Our calculator solves
                  for it automatically using each platform&apos;s fee structure, so you know the exact floor price
                  before you list. If the market is selling below your break-even, walk away — there&apos;s no profit
                  to be made no matter how good the deal looks.
                </p>
              </div>
            </div>

            {/* eBay profit calculator */}
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                eBay Profit Calculator
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                This tool doubles as a dedicated eBay profit calculator. Select &quot;eBay&quot; from the platform
                dropdown and it applies eBay&apos;s 13.25% final value fee plus the $0.30 per-order fee automatically.
                eBay&apos;s fee is calculated on the <em>total amount of the sale</em> (item price + shipping +
                sales tax), so be sure to enter your shipping cost — even if the buyer pays it — for an accurate
                estimate. Power sellers who list more than 250 items per month should remember eBay&apos;s $0.35
                per-listing fee for additional listings, which is not included here.
              </p>
            </div>

            {/* Amazon arbitrage calculator */}
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                Amazon Arbitrage Calculator
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Choose &quot;Amazon (Individual)&quot; or &quot;Amazon (Professional)&quot; to use this as an Amazon
                arbitrage calculator. The Individual plan charges a 15% referral fee plus $0.99 per item — best for
                low-volume sellers. The Professional plan drops the referral fee to 8% and waives the per-item fee,
                but adds a $39.99/month subscription that only pays off if you sell enough volume. As a rule of
                thumb, if you sell more than ~40 items a month the Professional plan is cheaper. Note that some
                product categories on Amazon have different referral fee percentages; this calculator uses the
                standard 15%/8% rates.
              </p>
            </div>

            {/* Flip calculator */}
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
                Flip Calculator
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Whether you&apos;re flipping thrifted clothes on Poshmark, garage-sale finds on Facebook Marketplace,
                or clearance electronics on Amazon, this flip calculator works for any reselling scenario. Just enter
                what you paid, what you&apos;ll sell it for, pick your platform, and add any shipping or supply costs.
                The ROI and profit margin tell you instantly whether a flip is worth your time — aim for at least
                30% ROI to cover your effort and the risk of returns.
              </p>
            </div>

            {/* Platform fee comparison */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                Platform Fee Comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px] text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Platform</th>
                      <th className="py-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fee %</th>
                      <th className="py-3 pr-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Flat Fee</th>
                      <th className="py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLATFORMS.map((p, i) => (
                      <tr key={p.key} className={`border-b ${i % 2 === 0 ? "border-zinc-100 dark:border-zinc-800/60" : "border-zinc-200/60 dark:border-zinc-800"}`}>
                        <td className="py-3 pr-4 font-medium text-zinc-900 dark:text-zinc-50">{p.label}</td>
                        <td className="py-3 pr-4 tabular-nums text-zinc-600 dark:text-zinc-400">{p.percent === 0 ? "0%" : `${(p.percent * 100).toFixed(2)}%`}</td>
                        <td className="py-3 pr-4 tabular-nums text-zinc-600 dark:text-zinc-400">{p.flat === 0 ? "—" : fmt(p.flat)}</td>
                        <td className="py-3 text-xs text-zinc-500 dark:text-zinc-400">{p.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-6 mb-2">
                Which platform has the lowest fees?
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <strong className="text-zinc-900 dark:text-zinc-50">Craigslist</strong> has the lowest fees — zero — but
                only works for local, in-person sales. Among shippable platforms,
                <strong className="text-zinc-900 dark:text-zinc-50"> Facebook Marketplace</strong> wins at just 5% (or a
                flat $0.40 for items under $8). <strong className="text-zinc-900 dark:text-zinc-50">Amazon
                Professional</strong> is next at 8%, but only after you cover the $39.99/month subscription.
                <strong className="text-zinc-900 dark:text-zinc-50"> Mercari</strong> and <strong className="text-zinc-900 dark:text-zinc-50">Depop</strong>
                sit in the middle at 10% + $0.30, while <strong className="text-zinc-900 dark:text-zinc-50">eBay</strong> at
                13.25% and <strong className="text-zinc-900 dark:text-zinc-50">Poshmark</strong> at 20% take the largest
                cut. The right platform depends on your item, your audience, and how fast you need it to sell — not
                just the fee.
              </p>
            </div>

            {/* Tips */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">
                Tips for Maximizing Your Profit
              </h2>
              <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Always calculate fees before you buy.</strong> A &quot;deal&quot; isn&apos;t a deal if platform fees eat your margin. Run the numbers in this calculator first.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Negotiate shipping.</strong> Shipping is often the difference between profit and loss. Use USPS Priority Mail flat-rate boxes for heavy items, and compare Pirate Ship, Shippo, and eBay&apos;s discounted rates.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Bundle supplies in bulk.</strong> Buy boxes, tape, and bubble mailers in bulk to cut your cost of goods sold from dollars per item to cents.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Pick the right platform for the item.</strong> Clothes sell best (and fastest) on Poshmark and Depop despite higher fees; electronics do better on eBay; local bulky items belong on Craigslist or Facebook Marketplace.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Target 30%+ ROI.</strong> Anything less barely covers your time, gas, and the risk of returns or a buyer dispute. Use the break-even price as your floor and aim well above it.</span></li>
                <li className="flex gap-3"><span className="text-emerald-500 font-bold">•</span><span><strong className="text-zinc-900 dark:text-zinc-50">Track every deal.</strong> Log your buy price, sell price, fees, and shipping for each flip. Over time you&apos;ll learn which categories and platforms give you the best net profit — and which to avoid.</span></li>
              </ul>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-50 px-6 py-10 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white dark:text-zinc-900">
                Find deals worth flipping.
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">{value}</dd>
    </div>
  );
}
