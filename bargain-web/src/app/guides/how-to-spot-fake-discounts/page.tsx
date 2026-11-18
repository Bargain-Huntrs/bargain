import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How to Spot Fake Discounts & Inflated 'Was' Prices | BargainHuntrs",
  description:
    "That '70% off' badge might be off a price nobody ever paid. Learn how inflated list prices, fake countdown timers, and perpetual sales work — and how to check a deal's real history before you buy.",
  alternates: { canonical: "/guides/how-to-spot-fake-discounts" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "How to Spot Fake Discounts & Inflated 'Was' Prices",
    description:
      "Inflated list prices, fake countdown timers, perpetual sales — how to check a deal's real history.",
    url: "/guides/how-to-spot-fake-discounts",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How to Spot Fake Discounts" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "How to Spot Fake Discounts & Inflated 'Was' Prices",
    description: "How inflated reference prices and perpetual sales work — and how to verify a real deal.",
    images: ["/og-image.png"],
  },
};

export default function SpotFakeDiscounts() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Spot Fake Discounts & Inflated 'Was' Prices",
    description:
      "Inflated list prices, fake countdown timers, perpetual sales — how to check a deal's real history before you buy.",
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
          <span className="text-zinc-900 dark:text-zinc-100">How to Spot Fake Discounts</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How to Spot Fake Discounts
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          A discount is only real if the &quot;was&quot; price was real. Here&apos;s how inflated reference pricing works — and how to check.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The inflated list price trick</h2>
            <p>
              The most common fake discount: the &quot;was&quot; price is a manufacturer&apos;s suggested
              retail price — or just a made-up anchor — that the item rarely or never actually sold for. A
              gadget &quot;marked down from $99.99 to $24.99&quot; sounds like 75% off until you check and
              find it has sold at $24.99 for months. The discount is real only against a price that never
              existed.
            </p>
            <p className="mt-3">
              This is common enough that regulators have taken action over deceptive reference pricing —
              but enforcement is spotty, and the burden still falls on you to check.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Other discount theater to recognize</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>The perpetual sale.</strong> An item that&apos;s been &quot;on sale&quot; every day for a year has no sale price — that&apos;s just the price, wearing a costume.</li>
              <li><strong>Fake urgency.</strong> Countdown timers that reset on refresh, &quot;only 2 left!&quot; badges on infinite digital stock, cart-hold expirations that aren&apos;t real.</li>
              <li><strong>Event repricing.</strong> Prices quietly raised before Black Friday or Prime Day so the event discount lands back at the normal price — or above it.</li>
              <li><strong>Shrinkflation discounts.</strong> A lower price on a smaller size — the per-ounce or per-unit cost actually went up.</li>
              <li><strong>Third-party seller anchors.</strong> Marketplace listings where a different seller&apos;s inflated price is used as the comparison point.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">How to verify a deal in 60 seconds</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-6">
              <li><strong>Check price history.</strong> Price-tracking tools show what an item actually sold for over time — the single fastest way to expose an inflated &quot;was&quot; price.</li>
              <li><strong>Compare across retailers.</strong> If three other stores sell it at the &quot;sale&quot; price every day, it&apos;s not a sale — it&apos;s the market price.</li>
              <li><strong>Compute unit price.</strong> Divide by ounces, count, or capacity — the only honest comparison between sizes and bundle configurations.</li>
              <li><strong>Check the seller.</strong> On marketplaces, the discount on a third-party listing may be against a price that seller invented.</li>
              <li><strong>Search the model number.</strong> Retailers sometimes carry near-identical SKUs so prices can&apos;t be compared directly — the specs tell you if it&apos;s the same product.</li>
            </ol>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">What a real discount looks like</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>The price history shows a genuine drop from a sustained higher price — not a spike-and-return.</li>
              <li>It beats other retailers&apos; current prices on the same item, not just its own &quot;was&quot; price.</li>
              <li>Clearance driven by real pressure — seasonal reset, discontinued SKU, new model incoming — tends to be real because the discount has a reason to exist.</li>
              <li>Documented pricing errors (price glitches) are real but short-lived — and orders can be cancelled. See the <Link href="/guides/how-to-find-price-glitches" className="font-medium text-emerald-600 underline dark:text-emerald-400">price glitch guide</Link> for what to expect.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              No single test catches every fake discount — price history can be gamed, sellers rotate SKUs,
              and a real markdown can still be a bad buy at the wrong size or for the wrong product. The
              defense is habit: check history, compare across stores, and run the unit math. And for resellers
              — a &quot;70% off&quot; item nobody will buy at retail is worth less than a 15% markdown on
              something that actually sells. The{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              cares about the spread, not the sticker percentage.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals/over-50-off" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals over 50% off</Link> — deep markdowns worth verifying.</li>
              <li><Link href="/deals/price-drops" className="font-medium text-emerald-600 underline dark:text-emerald-400">Price drops</Link> — items tracked at new lows.</li>
              <li><Link href="/guides/how-resellers-find-deep-discounts" className="font-medium text-emerald-600 underline dark:text-emerald-400">How resellers find deep discounts</Link> — the sourcing system behind real markdowns.</li>
              <li><Link href="/guides/how-to-read-clearance-tags" className="font-medium text-emerald-600 underline dark:text-emerald-400">How to read clearance tags</Link> — tell early markdowns from final cuts in-store.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Real markdowns, tracked in one feed
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The deals feed aggregates live discounts across retailers — free to browse, updated continuously.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/deals/price-drops"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Browse price drops
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
