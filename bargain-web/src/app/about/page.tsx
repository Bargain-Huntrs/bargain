import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About BargainHuntrs — Deal Discovery & Arbitrage Intelligence",
  description:
    "BargainHuntrs is a deal discovery and arbitrage intelligence platform operated by Reid Family Estates, LLC. Learn about our mission, editorial standards, and how we find deals.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "About BargainHuntrs",
    description:
      "Deal discovery and arbitrage intelligence, operated by Reid Family Estates, LLC.",
    url: "/about",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "About BargainHuntrs" }],
  },
};

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          About BargainHuntrs
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Find it. Flip it. Profit. BargainHuntrs is a deal discovery and retail
          arbitrage intelligence platform built for deal hunters, resellers,
          and anyone who refuses to pay full price.
        </p>

        <section className="mt-10 space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              What we do
            </h2>
            <p className="mt-3">
              We monitor hundreds of retailers, marketplaces, and deal feeds to
              surface genuine discounts, price errors, and arbitrage
              opportunities — then add the analysis that makes them actionable:
              margin estimates, resale demand signals, price-history context,
              and community verification. Subscribers get real-time alerts so
              they can act before deals expire or go out of stock.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              How we find deals
            </h2>
            <p className="mt-3">
              Our system continuously scans retailer pricing, community deal
              boards, and marketplace listings. Every surfaced deal is enriched
              with our own analysis — we estimate resale margins, check price
              history, flag stock risk, and score opportunity quality. We do
              not simply republish other sites&apos; deal lists; our value is the
              verification and analysis layer on top.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Editorial standards
            </h2>
            <p className="mt-3">
              Deal listings are curated and analyzed by our team and community.
              We mark expired or unverified deals, correct price data when it
              changes, and remove listings that turn out to be misleading. Our
              guides are written to teach real deal-hunting skills — price
              glitches, arbitrage fundamentals, and seasonal timing — not to
              push specific products.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              How we make money
            </h2>
            <p className="mt-3">
              BargainHuntrs earns revenue three ways: optional paid
              subscriptions for advanced alerts and analysis, affiliate
              commissions when you buy through links on our site (at no extra
              cost to you), and clearly-labeled merchant placements. Affiliate
              relationships never change the price you pay, and deals are
              surfaced on merit — see our{" "}
              <Link href="/disclosure" className="text-blue-600 hover:underline dark:text-blue-400">
                Affiliate Disclosure
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Who we are
            </h2>
            <p className="mt-3">
              BargainHuntrs is operated by Reid Family Estates, LLC, doing
              business as BargainHuntrs. Questions, corrections, or partnership
              inquiries:{" "}
              <Link href="/contact" className="text-blue-600 hover:underline dark:text-blue-400">
                contact us
              </Link>
              .
            </p>
          </div>
        </section>

        <div className="mt-12 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 p-8 dark:from-blue-950 dark:to-green-950">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Start hunting deals
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Browse today&apos;s deals or set up alerts for the categories you
            resell.
          </p>
          <div className="mt-4 flex gap-4">
            <Link
              href="/deals"
              className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Browse Deals
            </Link>
            <Link
              href="/guides"
              className="inline-block rounded-lg border border-blue-600 px-6 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              Read Guides
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
