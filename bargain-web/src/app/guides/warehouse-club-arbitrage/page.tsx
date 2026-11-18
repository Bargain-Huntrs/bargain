import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Warehouse Club Arbitrage: Costco, Sam's Club & BJ's Basics | BargainHuntrs",
  description:
    "Warehouse clubs are an overlooked arbitrage source — bulk pricing, instant rebates, and clearance finds that resell for real margins. How club sourcing works, what to buy, and the math that matters.",
  alternates: { canonical: "/guides/warehouse-club-arbitrage" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "Warehouse Club Arbitrage: Costco, Sam's Club & BJ's Basics",
    description:
      "Bulk pricing, instant rebates, and clearance finds — how resellers source warehouse clubs for profit.",
    url: "/guides/warehouse-club-arbitrage",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Warehouse Club Arbitrage" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Warehouse Club Arbitrage: Costco, Sam's Club & BJ's Basics",
    description: "Bulk pricing, instant rebates, and clearance — how resellers source warehouse clubs.",
    images: ["/og-image.png"],
  },
};

export default function WarehouseClubArbitrage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Warehouse Club Arbitrage: Costco, Sam's Club & BJ's Basics",
    description:
      "Bulk pricing, instant rebates, and clearance finds — how resellers source warehouse clubs for profit.",
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
          <span className="text-zinc-900 dark:text-zinc-100">Warehouse Club Arbitrage</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Warehouse Club Arbitrage Basics
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Costco, Sam&apos;s Club, and BJ&apos;s aren&apos;t just for stocking your pantry — resellers treat them as a wholesale source hiding in plain sight.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Why warehouse clubs work for arbitrage</h2>
            <p>
              Warehouse clubs buy in massive volume and sell near cost — the membership fee is the real
              business model. That creates three recurring opportunities for resellers:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Bulk unit pricing.</strong> Multi-packs and club-size bundles can break down to per-unit costs below what singles sell for on marketplaces.</li>
              <li><strong>Instant rebates and coupon books.</strong> Clubs run rotating instant-savings events. A rebated item bought during the window can undercut normal retail sourcing entirely.</li>
              <li><strong>Clearance and manager specials.</strong> Clubs clear seasonal and discontinued items aggressively because floor space is expensive — unadvertised markdowns are common.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">What actually flips from clubs</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Health, beauty, and supplements.</strong> Name-brand items in club sizes often split profitably into single units — check marketplace rules on lot codes and expiration dating first.</li>
              <li><strong>Seasonal goods.</strong> Post-holiday clearance on decor, toys, and gift sets can hit deep discounts in the weeks after the season.</li>
              <li><strong>Clothing and shoes.</strong> Brand-name apparel appears at club prices far below department store tags — sizes move differently though, so test before buying deep.</li>
              <li><strong>Small appliances and electronics accessories.</strong> Rebated units during sale events are the sweet spot; full-price club electronics rarely leave room after marketplace fees.</li>
              <li><strong>Club-exclusive bundles.</strong> Packaging that doesn&apos;t exist elsewhere (bonus items, club-only varieties) can carry a premium with buyers who can&apos;t access a club.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The membership math</h2>
            <p>
              A basic club membership runs roughly $50–$60 a year; executive tiers run about double and pay
              back a percentage of purchases. The calculus is simple: if you source even modestly, the
              membership pays for itself fast — one decent clearance haul usually covers it. The executive
              upgrade only makes sense once your annual club spend makes the rebate exceed the upgrade cost.
            </p>
            <p className="mt-3">
              Don&apos;t forget the hidden costs though: gas, your time in the warehouse, storage space for
              bulk buys, and capital locked in inventory that hasn&apos;t sold yet.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">How to source clubs without wasting trips</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li><strong>Check the monthly savings book first.</strong> Instant rebates are published ahead of time — build a candidate list before you drive.</li>
              <li><strong>Scan before you buy.</strong> Look up the current selling price on your target marketplace for every candidate item. Club price + fees vs. selling price is the only math that matters.</li>
              <li><strong>Learn one warehouse first.</strong> Each location clears different departments at different times. Regulars learn where the clearance carts park and which endcaps turn over.</li>
              <li><strong>Buy shallow on new categories.</strong> One or two units to validate demand, then scale on the next sourcing run.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              Club sourcing is real but not magic: competition for obvious deals is thick, return policies
              have limits, some marketplaces restrict reselling certain grocery or topical categories, and a
              unit that doesn&apos;t sell is just expensive pantry stock. Verify the sell-through on your
              target platform before every buy, and run the fee math in a{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              — a $5 margin on paper can go negative after shipping and marketplace fees.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/guides/retail-arbitrage-for-beginners" className="font-medium text-emerald-600 underline dark:text-emerald-400">Retail arbitrage for beginners</Link> — the full sourcing-to-sale playbook.</li>
              <li><Link href="/guides/how-resellers-find-deep-discounts" className="font-medium text-emerald-600 underline dark:text-emerald-400">How resellers find deep discounts</Link> — alerts and markdown cycles beyond the warehouse.</li>
              <li><Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Profit calculator</Link> — fees, shipping, and the margin you&apos;d actually keep.</li>
              <li><Link href="/deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals feed</Link> — online sourcing when you can&apos;t make the drive.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Source deals without leaving the couch
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The deals feed tracks online markdowns across retailers — free to browse, always updating.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/deals"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Browse live deals
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
