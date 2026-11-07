import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How Resellers Find 50%+ Discounts Before They Sell Out | BargainHuntrs",
  description:
    "Deal resellers don't get lucky — they get alerted. The real mechanics behind finding deep discounts early: markdown cycles, price trackers, glitch feeds, and why speed is a system, not a skill.",
  alternates: { canonical: "/guides/how-resellers-find-deep-discounts" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "How Resellers Find 50%+ Discounts Before They Sell Out",
    description:
      "The real mechanics behind finding deep discounts early — markdown cycles, price trackers, glitch feeds, and why speed is a system.",
    url: "/guides/how-resellers-find-deep-discounts",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How Resellers Find Deep Discounts" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "How Resellers Find 50%+ Discounts Before They Sell Out",
    description: "The real mechanics behind finding deep discounts early — alerts, markdown cycles, and glitch feeds.",
    images: ["/og-image.png"],
  },
};

export default function ResellerDiscountsGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How Resellers Find 50%+ Discounts Before They Sell Out",
    description:
      "The real mechanics behind finding deep discounts early — markdown cycles, price trackers, glitch feeds, and why speed is a system, not a skill.",
    author: { "@type": "Organization", name: "BargainHuntrs" },
    publisher: { "@type": "Organization", name: "BargainHuntrs" },
    datePublished: "2026-11-06",
    dateModified: "2026-11-06",
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
          <span className="text-zinc-900 dark:text-zinc-100">How Resellers Find Deep Discounts</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How deal resellers actually find 50%+ discounts before they sell out
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          It looks like luck from the outside. From the inside, it&apos;s a system.
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Where 50%+ discounts even come from</h2>
            <p>
              Deep discounts aren&apos;t random generosity — they&apos;re predictable retail mechanics. Clearance
              markdowns happen when a store needs shelf space and would rather sell cheap than ship stock back
              to a warehouse. Seasonal resets hit on a calendar you can learn. Open-box and warehouse-deal
              programs discount items that are functionally new but can&apos;t be sold as such. Pricing errors
              and mismatched promos create short-lived glitches. Coupon stacking and store-app offers pile
              percentages on top of already-marked-down prices.
            </p>
            <p className="mt-3">
              The resellers who consistently buy at half price or better aren&apos;t finding different deals
              than everyone else — they&apos;re finding the <em>same</em> deals hours earlier, before the
              inventory is gone.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Speed is a system, not a skill</h2>
            <p>
              Nobody sits refreshing Amazon all day. The resellers who get there first run alerts, not
              bookmarks. The working stack, roughly in order of how much it matters:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong className="text-zinc-900 dark:text-zinc-50">Deal feed alerts.</strong> Aggregator feeds that scan retailer prices continuously and surface drops as they happen. That&apos;s literally what BargainHuntrs&apos; <Link href="/deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">live deals feed</Link> and the <Link href="/deals/over-50-off" className="font-medium text-emerald-600 underline dark:text-emerald-400">over-50%-off page</Link> are for — the scroll is free, the point is seeing it early.</li>
              <li><strong className="text-zinc-900 dark:text-zinc-50">Price-drop notifications.</strong> Alerts on specific SKUs you already know flip well — when the price crosses your buy threshold, you get pinged instead of finding out tomorrow.</li>
              <li><strong className="text-zinc-900 dark:text-zinc-50">Deal communities.</strong> Discord servers, forums, and subreddits where members post glitches and clearance finds in real time. The best finds are crowdsourced — one person spots it, hundreds confirm it.</li>
              <li><strong className="text-zinc-900 dark:text-zinc-50">Markdown-cycle knowledge.</strong> Retailers clear inventory on rhythms — end-of-season, post-holiday, model-year changeovers. You don&apos;t need to predict the day; you need to be looking during the window.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The retail-arbitrage loop</h2>
            <p>
              Reselling follows the same loop whether it&apos;s online or in-store: find an item priced well
              below its going resale rate, verify the spread still exists after fees and shipping, buy before
              the discount corrects, list it where buyers actually look. In-store that means scanning
              clearance endcaps with a seller app and checking stock before driving. Online it means watching
              the same feeds everyone has access to — faster.
            </p>
            <p className="mt-3">
              A 50% discount is only the starting filter. The resellers who stay in business run the math
              before they buy: marketplace fees, shipping, returns, and the time the item will sit. A $10 item
              at 70% off still loses money if it costs $8 to ship and sells for $12. Run the numbers on the{' '}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{' '}
              before you treat any discount as inventory.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              No guide can promise you profit — anyone who does is selling a course, not a method. Discounts
              sell out mid-checkout, resale prices drop while your inventory is in transit, marketplaces change
              fees, and some buys just don&apos;t move. What the working system actually does is shift the
              odds: earlier alerts mean more shots at real discounts, and disciplined math means fewer
              inventory mistakes. The rest is volume and patience.
            </p>
            <p className="mt-3">
              Also worth saying plainly: the same tools work if you never resell a thing. Most people use deal
              alerts to buy what they were going to buy anyway — cheaper.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals/over-50-off" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals over 50% off</Link> — the raw feed, updated continuously.</li>
              <li><Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Profit calculator</Link> — fees, shipping, and the margin you&apos;d actually keep.</li>
              <li><Link href="/tools/listing-generator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Listing generator</Link> — turn a find into a resale listing fast.</li>
              <li><Link href="/guides/retail-arbitrage-for-beginners" className="font-medium text-emerald-600 underline dark:text-emerald-400">Retail arbitrage for beginners</Link> — the full starter playbook.</li>
              <li><Link href="/guides/best-times-to-find-deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Best times to find deals</Link> — when the markdown windows open.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            See the discounts while they&apos;re still in stock
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The deals feed updates continuously — free to browse, faster than hunting store by store.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/deals/over-50-off"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Browse 50%+ off deals
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
