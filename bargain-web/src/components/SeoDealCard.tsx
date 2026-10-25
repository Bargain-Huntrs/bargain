import Link from "next/link";
import type { ArbitrageDeal } from "@/lib/api";
import { discountPercent, retailerName, timeAgo } from "@/lib/seo-helpers";

export default function SeoDealCard({
  deal,
  showRank,
  rank,
}: {
  deal: ArbitrageDeal;
  // Retained in the type for call sites; cards currently link internally
  // and per-surface attribution happens on the deal page's /d/{id} click-out.
  source?: string;
  showRank?: boolean;
  rank?: number;
}) {
  const discount = discountPercent(deal);
  const retailer = retailerName(deal.retailer);

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="relative aspect-square w-full bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt={deal.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            <span className="text-zinc-300 dark:text-zinc-600">No image</span>
          </div>
        )}
        {discount > 0 && (
          <div className="absolute top-2 left-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
            {discount}% OFF
          </div>
        )}
        {deal.deal_tier === "glitch" && (
          <div className="absolute bottom-2 left-2 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-1 text-xs font-bold text-white shadow-sm">
            PRICE ERROR
          </div>
        )}
        {deal.deal_tier === "clearance" && (
          <div className="absolute bottom-2 left-2 rounded-md bg-purple-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
            CLEARANCE
          </div>
        )}
        {showRank && rank != null && (
          <div className="absolute top-2 right-2 rounded-md bg-zinc-900 px-1.5 py-0.5 text-xs font-bold text-white">
            #{rank}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {retailer}
        </p>
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          {deal.title}
        </h3>
        <div className="mt-auto space-y-1">
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
          {deal.net_profit != null && deal.net_profit > 0 && (
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Profit ${deal.net_profit.toFixed(2)}
              {deal.roi != null && <span className="ml-1">({Math.round(deal.roi)}% ROI)</span>}
            </p>
          )}
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {timeAgo(deal.detected_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
