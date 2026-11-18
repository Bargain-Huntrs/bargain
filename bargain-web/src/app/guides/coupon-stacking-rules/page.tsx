import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Coupon Stacking Rules: What Actually Stacks & What Doesn't | BargainHuntrs",
  description:
    "Coupon stacking can turn a good deal into a great one — but every store has different rules. Learn the general stacking order (sale → store coupon → manufacturer coupon → rewards) and where the limits are.",
  alternates: { canonical: "/guides/coupon-stacking-rules" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "Coupon Stacking Rules: What Actually Stacks & What Doesn't",
    description:
      "The general stacking order — sale → store coupon → manufacturer coupon → rewards — and where the limits are.",
    url: "/guides/coupon-stacking-rules",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coupon Stacking Rules" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Coupon Stacking Rules: What Actually Stacks & What Doesn't",
    description: "The general stacking order and where each type of discount stops combining.",
    images: ["/og-image.png"],
  },
};

export default function CouponStackingRules() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Coupon Stacking Rules: What Actually Stacks & What Doesn't",
    description:
      "The general stacking order — sale, store coupon, manufacturer coupon, rewards — and where the limits are.",
    author: { "@type": "Organization", name: "BargainHuntrs" },
    publisher: { "@type": "Organization", name: "BargainHuntrs" },
    datePublished: "2026-11-18",
    dateModified: "2026-11-18",
  };

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-zinc-900 dark:hover:text-zinc-100">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100">Coupon Stacking Rules</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Coupon Stacking Rules: What Actually Stacks
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Stacking is how a 30% sale becomes a 60% effective discount — when the store&apos;s rules allow it.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The four discount layers</h2>
            <p>
              Almost every stackable deal is built from the same four layers. Understanding which layer a
              discount belongs to tells you whether it can combine with another:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li><strong>The base price.</strong> Sale price, clearance price, or rollback — whatever the register starts from.</li>
              <li><strong>Store coupons.</strong> Issued by the retailer itself — app coupons, weekly-ad coupons, category percent-off offers.</li>
              <li><strong>Manufacturer coupons.</strong> Issued by the brand — newspaper inserts, printable coupons, brand-app offers. These reimburse the store, which is why many retailers treat them separately from store coupons.</li>
              <li><strong>Rewards and rebates.</strong> Loyalty points, store cash earned on the purchase, cash-back apps, and mail-in or digital rebates — these usually apply after checkout rather than at the register.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The general stacking order</h2>
            <p>
              The classic stack at stores that allow it: <strong>sale price → store coupon → manufacturer
              coupon → rewards/rebates on top.</strong> Each layer applies to the subtotal the previous layer
              left behind, which is why percentage discounts stack multiplicatively, not additively — a 20%
              store coupon plus a 25%-off sale is roughly 40% off the original, not 45%.
            </p>
            <p className="mt-3">
              The near-universal limit: <strong>one manufacturer coupon per item.</strong> Most stores also
              cap identical coupons per transaction, and many digital coupons are single-use. Whether a
              store coupon and manufacturer coupon can combine on the same item is the rule that varies most.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Where stacking typically breaks</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Percent-off vs. percent-off.</strong> Many systems won&apos;t apply two store percent-off coupons to the same item or basket — the register picks one.</li>
              <li><strong>Exclusions.</strong> Coupon fine print routinely excludes clearance, doorbusters, gift cards, and specific brands. An excluded item just doesn&apos;t discount — no error message.</li>
              <li><strong>Threshold coupons.</strong> &quot;$10 off $50&quot; offers usually check the total after other coupons — stack the percentages first, then see if the threshold still clears.</li>
              <li><strong>Category conflicts.</strong> Some store coupons exclude items already on promotion — the coupon won&apos;t attach to a sale item at all.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The digital stacking workflow</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li><strong>Clip everything in the app first.</strong> Many store digital coupons must be clipped before checkout to attach.</li>
              <li><strong>Match coupons to items already on sale.</strong> Stacking on a full-price item is fine; stacking on a sale item is where the real discount lives.</li>
              <li><strong>Watch the register total.</strong> Verify each expected coupon deducted — a clipped coupon that didn&apos;t attach is money left behind.</li>
              <li><strong>Submit rebates after checkout.</strong> Cash-back apps and receipt-scan rebates layer on top of everything the register already took.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              Coupon policies are store-specific, change often, and sometimes vary by region or even by
              cashier discretion — always check the retailer&apos;s current coupon policy before planning a
              trip around a stack. Nothing here promises a specific discount at a specific store. And for
              resellers: a stacked coupon price is still just your cost basis — the{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              decides whether it flips.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/coupons" className="font-medium text-emerald-600 underline dark:text-emerald-400">Coupon feed</Link> — current promo codes and offers by retailer.</li>
              <li><Link href="/guides/best-times-to-find-deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Best times to find deals</Link> — when the base-layer sales are deepest.</li>
              <li><Link href="/guides/how-to-find-price-glitches" className="font-medium text-emerald-600 underline dark:text-emerald-400">How to find price glitches</Link> — the extreme end of the discount spectrum.</li>
              <li><Link href="/deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals feed</Link> — markdowns already tracked for you.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Find the base deal — then stack it
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Browse live coupons and marked-down deals in one place. Free to browse, no account needed.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/coupons"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Browse coupons
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Get deal alerts free
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
