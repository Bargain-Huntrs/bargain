import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Best Things to Flip for Profit: Categories That Actually Sell | BargainHuntrs",
  description:
    "Not everything discounted is worth flipping. The categories with real resale margins — electronics accessories, toys, tools, discontinued products — and the traits that make an item flippable.",
  alternates: { canonical: "/guides/best-things-to-flip-for-profit" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "Best Things to Flip for Profit: Categories That Actually Sell",
    description:
      "The categories with real resale margins and the traits that make an item flippable.",
    url: "/guides/best-things-to-flip-for-profit",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Best Things to Flip for Profit" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Best Things to Flip for Profit: Categories That Actually Sell",
    description: "The categories with real resale margins and what makes an item flippable.",
    images: ["/og-image.png"],
  },
};

export default function BestThingsToFlip() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Best Things to Flip for Profit: Categories That Actually Sell",
    description:
      "The categories with real resale margins and the traits that make an item flippable.",
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
          <span className="text-zinc-900 dark:text-zinc-100">Best Things to Flip for Profit</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Best Things to Flip for Profit
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          A deep discount is only half the equation — the other half is whether anyone buys it at the higher price.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">What makes an item flippable</h2>
            <p>
              Before the category list, the filter every flip has to pass:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Proven demand.</strong> The item already sells at your target price — check sold listings or sales rank, not asking prices.</li>
              <li><strong>Margin after everything.</strong> Sell price minus buy price, marketplace fees, shipping, and a return allowance still leaves real profit — run it through a <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>.</li>
              <li><strong>Sell-through speed.</strong> A $20 profit that takes six months ties up capital worse than a $8 profit that turns weekly.</li>
              <li><strong>Shippable.</strong> Small, light, and durable beats cheap-but-huge almost every time — shipping eats margin and breakage eats accounts.</li>
              <li><strong>Allowed.</strong> Some brands and categories are gated on the big marketplaces — check before you buy, not after.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Categories with real resale margins</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Electronics accessories.</strong> Cables, chargers, cases, mounts — cheap to source on clearance, light to ship, steady demand. Margins are thinner per unit but turnover is fast.</li>
              <li><strong>Toys and games.</strong> The classic flip category — especially around the holidays when demand spikes and store clearances run deep. Watch for restricted brands on marketplaces.</li>
              <li><strong>Tools and home improvement.</strong> Quality hand tools, name-brand power tool accessories, and discontinued hardware hold value well and have practical buyers.</li>
              <li><strong>Discontinued products.</strong> When a brand kills a product people love — a scent, a color, a model — remaining stock can sell above original retail. Clearance aisles are where these hide.</li>
              <li><strong>Health and beauty (name brands).</strong> Consistent demand and easy shipping, but check expiration dates and marketplace category rules carefully.</li>
              <li><strong>Books and media.</strong> Textbooks and niche non-fiction source cheap and sell predictably — low excitement, reliable margin.</li>
              <li><strong>Seasonal items bought off-season.</strong> Clearance holiday goods, patio furniture in fall, winter gear in spring — buy when stores dump, sell when demand returns.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Categories that look good but trap beginners</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Clothing.</strong> Deep clearance discounts, but sizes fragment demand, returns run high, and competition is brutal. Workable, not easy.</li>
              <li><strong>Big electronics.</strong> TVs and laptops have thin margins, heavy shipping, and expensive return fraud exposure.</li>
              <li><strong>Anything gated without approval.</strong> Restricted categories can&apos;t be listed until you&apos;re approved — inventory you can&apos;t list is just clutter.</li>
              <li><strong>Trending fad items.</strong> By the time a viral product hits clearance, the trend that drove the price is often already dying.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">A simple first-buy test</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li>Find the item&apos;s current selling price on your target marketplace (sold comps, not list prices).</li>
              <li>Subtract fees and shipping — what&apos;s left is your ceiling.</li>
              <li>Buy only if your cost is under ~60% of that ceiling — that buffer absorbs price drops and returns.</li>
              <li>Buy one or two units first. If it sells in your target window, scale on the next run.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              No category list survives contact with your local stores or your marketplace account — gated
              brands, regional demand, and your own sell-through history matter more than any generic
              ranking. The categories above are where flips commonly work, not a promise they&apos;ll work
              for you. Every buy is a bet; the profit calculator and the one-unit test are how you keep the
              bets small until you know which categories move for you.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals feed</Link> — filter by category and start testing.</li>
              <li><Link href="/categories" className="font-medium text-emerald-600 underline dark:text-emerald-400">Deals by category</Link> — electronics, home, toys, and more, live.</li>
              <li><Link href="/guides/retail-arbitrage-for-beginners" className="font-medium text-emerald-600 underline dark:text-emerald-400">Retail arbitrage for beginners</Link> — the full flip workflow.</li>
              <li><Link href="/tools/listing-generator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Listing generator</Link> — turn a find into a marketplace listing.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Find your first flip in the live feed
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Discounted products across categories, updated continuously — free to browse.
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
