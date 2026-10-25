import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CopyCouponCode from "@/components/CopyCouponCode";
import {
  getPublicCoupons,
  getPublicCouponRetailers,
  addUtmParameters,
  type Coupon,
} from "@/lib/api";
import { retailerSlug, retailerDisplayName } from "@/lib/retailers";

export const revalidate = 1800;

// Rendered on demand by the Workers deployment — new retailers get pages
// automatically as the coupons pipeline ingests them.
export function generateStaticParams() {
  return [];
}

type Params = { slug: string };

async function resolveRetailer(slug: string): Promise<string | null> {
  const retailers = await getPublicCouponRetailers();
  const match = retailers.find((r) => retailerSlug(r) === slug);
  return match ?? null;
}

// RSS-sourced coupons frequently carry the headline's trailing word as the
// "code" (FINAL, CODES, SAVE...) — those aren't real promo codes and showing
// them would hurt trust. Blocklist the obvious fillers.
const JUNK_CODES = new Set([
  "final", "codes", "code", "promo", "sale", "deal", "deals", "save",
  "shop", "free", "new", "hot", "get", "buy", "off", "now", "more",
  "here", "today", "discount", "offer", "check", "click", "link",
]);

function isJunkCode(code: string): boolean {
  return JUNK_CODES.has(code.toLowerCase());
}

function discountLabel(coupon: Coupon): string {
  if (coupon.discount_type === "percentage" && coupon.discount_value) {
    return `${coupon.discount_value}% off`;
  }
  if (coupon.discount_type === "fixed" && coupon.discount_value) {
    return `$${coupon.discount_value} off`;
  }
  if (coupon.discount_type === "free_shipping") return "Free shipping";
  return coupon.title;
}

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function successRate(coupon: Coupon): number | null {
  if (!coupon.times_used || coupon.times_used < 3) return null;
  return Math.round((coupon.success_count / coupon.times_used) * 100);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const retailer = await resolveRetailer(slug);
  const name = retailer
    ? retailerDisplayName(retailer)
    : retailerDisplayName(slug);
  const title = `${name} Coupon Codes & Promo Codes`;
  const description = `Verified ${name} coupon codes, promo codes, and discounts. Codes are crowd-tested by shoppers and updated as new offers arrive.`;
  return {
    title,
    description,
    alternates: { canonical: `/coupons/${slug}` },
    openGraph: { title, description, url: `/coupons/${slug}` },
    // Noindex pages whose retailer can't be resolved — thin/empty pages
    // shouldn't reach the index.
    ...(retailer ? {} : { robots: { index: false } }),
  };
}

export default async function StoreCouponsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const retailer = await resolveRetailer(slug);
  const name = retailer
    ? retailerDisplayName(retailer)
    : retailerDisplayName(slug);

  let coupons: Coupon[] = [];
  let error = "";
  if (retailer) {
    try {
      coupons = (await getPublicCoupons(100, 0, { retailer })).filter(
        (c) => !isJunkCode(c.code)
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load coupons";
    }
  }

  const verifiedCount = coupons.filter((c) => c.verified).length;
  const lastVerified = coupons
    .map((c) => c.scraped_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/coupons"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← All coupons
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {name} Coupon Codes &amp; Promo Codes
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Working {name} promo codes, verified by real shoppers.{" "}
            {verifiedCount > 0 &&
              `${verifiedCount} code${verifiedCount !== 1 ? "s" : ""} currently verified. `}
            {lastVerified &&
              `Last checked ${formatDate(lastVerified)}.`}{" "}
            We may earn a commission when you shop through links on this page.
          </p>

          {error ? (
            <div className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          ) : !retailer || coupons.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No {name} coupon codes available right now. Check back soon —
                new codes are added as our sources verify them.
              </p>
              <Link
                href={`/stores/${slug}`}
                className="mt-4 inline-block text-sm text-zinc-600 underline hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Browse live {name} deals instead
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
                {coupons.length} active {name} code
                {coupons.length !== 1 ? "s" : ""}
              </p>
              <ul className="mt-4 space-y-3">
                {coupons.map((coupon) => {
                  const rate = successRate(coupon);
                  const expires = formatDate(coupon.expires_at);
                  return (
                    <li
                      key={coupon.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                            {discountLabel(coupon)}
                          </span>
                          {coupon.verified && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                              Verified
                            </span>
                          )}
                        </div>
                        {coupon.title &&
                          coupon.title !== discountLabel(coupon) && (
                            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                              {coupon.title}
                            </p>
                          )}
                        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                          {rate !== null &&
                            `${rate}% success rate · `}
                          {coupon.min_purchase
                            ? `Min. purchase $${coupon.min_purchase} · `
                            : ""}
                          {expires ? `Expires ${expires}` : "No expiry listed"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <CopyCouponCode code={coupon.code} />
                        {coupon.product_url && (
                          <a
                            href={addUtmParameters(
                              coupon.product_url,
                              "bargainhuntrs",
                              "coupon_page",
                              `coupon_${slug}`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
                          >
                            Source →
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    How we verify codes:
                  </strong>{" "}
                  shoppers report whether each code worked at checkout. Codes
                  with consistently successful reports earn a Verified badge;
                  codes that stop working are removed.{" "}
                  <Link href="/disclosure" className="underline">
                    Affiliate disclosure
                  </Link>
                  {" · "}
                  <Link href={`/stores/${slug}`} className="underline">
                    {name} deals
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
