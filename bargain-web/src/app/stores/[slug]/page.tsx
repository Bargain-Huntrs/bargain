import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getPublicDeals,
  getPublicDealRetailers,
  type ArbitrageDeal,
} from "@/lib/api";
import { retailerSlug, retailerDisplayName } from "@/lib/retailers";

export const revalidate = 1800;

// Legacy `output: "export"` builds generate no store pages; the live Workers
// deployment renders them on demand with `dynamicParams`.
export function generateStaticParams() {
  return [];
}

type Params = { slug: string };

// Resolve a URL slug back to the retailer value the API stores, using the
// live retailer list so casing/spacing/dots don't matter.
async function resolveRetailer(slug: string): Promise<string | null> {
  try {
    const retailers = await getPublicDealRetailers();
    const match = retailers.find((r) => retailerSlug(r.retailer) === slug);
    return match ? match.retailer : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const retailer = await resolveRetailer(slug);
  const name = retailer ? retailerDisplayName(retailer) : retailerDisplayName(slug);
  const title = `${name} Deals — Today's Best ${name} Bargains`;
  const description = `Find today's best ${name} deals, discounts, and clearance items. Updated automatically throughout the day.`;
  return {
    title,
    description,
    alternates: { canonical: `/stores/${slug}` },
    openGraph: { title, description, url: `/stores/${slug}` },
  };
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

function timeAgo(detectedAt: string): string {
  const diff = Date.now() - new Date(detectedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function StoreDealsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const retailer = await resolveRetailer(slug);
  const name = retailer
    ? retailerDisplayName(retailer)
    : retailerDisplayName(slug);

  let deals: ArbitrageDeal[] = [];
  let error = "";
  if (retailer) {
    try {
      deals = await getPublicDeals(100, 0, undefined, retailer);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load deals";
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/stores"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← All stores
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {name} Deals
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Today&apos;s best {name} bargains, discounts, and clearance items.
            Updated automatically throughout the day as our scanners find new
            opportunities.
          </p>

          {error ? (
            <div className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          ) : deals.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No {name} deals available right now. Check back soon — our
                scanners update throughout the day.
              </p>
              <Link
                href="/deals"
                className="mt-4 inline-block text-sm text-zinc-600 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Browse all live deals
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                {deals.length} {name} deal{deals.length !== 1 ? "s" : ""}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {deals.map((deal) => {
                  const discount = discountPercent(deal);
                  return (
                    <Link
                      key={deal.id}
                      href={`/deals/${deal.id}`}
                      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                    >
                      <div className="relative aspect-square w-full bg-zinc-50 dark:bg-zinc-800 overflow-hidden">
                        {deal.image_url ? (
                          <img
                            src={deal.image_url}
                            alt={deal.title}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl">
                            🏷️
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="absolute top-2 left-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
                            {discount}% OFF
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-3">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 mb-2">
                          {deal.title}
                        </h3>
                        <div className="flex items-baseline gap-2 mt-auto">
                          <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                            ${deal.buy_price.toFixed(2)}
                          </span>
                          {deal.historical_avg &&
                            deal.historical_avg > deal.buy_price && (
                              <span className="text-xs text-zinc-400 line-through">
                                ${deal.historical_avg.toFixed(2)}
                              </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                          {timeAgo(deal.detected_at)}
                        </p>
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
