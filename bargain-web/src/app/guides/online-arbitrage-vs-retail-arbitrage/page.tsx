import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Online Arbitrage vs Retail Arbitrage: Which Is Better? | BargainHuntrs",
  description:
    "Online arbitrage and retail arbitrage both flip retail discounts for profit — but the sourcing, costs, competition, and scale are completely different. An honest comparison to pick your lane.",
  alternates: { canonical: "/guides/online-arbitrage-vs-retail-arbitrage" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "Online Arbitrage vs Retail Arbitrage: Which Is Better?",
    description:
      "Sourcing, costs, competition, and scale — an honest comparison of the two arbitrage models.",
    url: "/guides/online-arbitrage-vs-retail-arbitrage",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Online vs Retail Arbitrage" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Online Arbitrage vs Retail Arbitrage: Which Is Better?",
    description: "Sourcing, costs, competition, and scale — the honest comparison.",
    images: ["/og-image.png"],
  },
};

export default function OnlineVsRetailArbitrage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Online Arbitrage vs Retail Arbitrage: Which Is Better?",
    description:
      "Sourcing, costs, competition, and scale — an honest comparison of the two arbitrage models.",
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
          <span className="text-zinc-900 dark:text-zinc-100">Online vs Retail Arbitrage</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Online Arbitrage vs Retail Arbitrage
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Same game — buy low at retail, sell higher elsewhere — completely different cost structures and competition.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The difference in one line</h2>
            <p>
              <strong>Retail arbitrage</strong> sources inventory by physically walking stores — clearance
              aisles, liquidation shelves, warehouse clubs. <strong>Online arbitrage</strong> sources the
              same kind of discounts from retailer websites, without leaving your desk. Everything else —
              where you sell, how you calculate profit, what kills your margin — is shared.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Sourcing: hunting vs. filtering</h2>
            <p>
              Retail sourcing is physical and local: your clearance finds depend on which stores are near
              you, when markdowns hit the shelf, and whether someone got there first. The upside is real —
              in-store clearance can reach depths online prices never touch, and much of it isn&apos;t listed
              online at all. The downside is time: a sourcing run is hours of driving and scanning.
            </p>
            <p className="mt-3">
              Online sourcing trades walking for filtering. Deal feeds, price-drop alerts, and search tools
              surface candidates continuously; your job becomes verification — checking the sell price,
              competition, and fees — instead of discovery. It scales better but competes harder: an online
              deal is visible to every other reseller with the same alerts.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Cost structure</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Retail arbitrage adds:</strong> gas, travel time, and often sales tax paid in-store (which is recoverable cost basis, not free money — track it).</li>
              <li><strong>Online arbitrage adds:</strong> inbound shipping to you, and the wait — inventory arrives days later and prices can move while it&apos;s in transit.</li>
              <li><strong>Both share:</strong> marketplace referral fees, fulfillment or outbound shipping, return/refund rates, and the cost of inventory that doesn&apos;t sell.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Where each wins</h2>
            <p><strong>Retail arbitrage wins when:</strong></p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>You have good stores nearby and can learn their markdown rhythm</li>
              <li>The item is bulky or fragile — you inspect it before buying</li>
              <li>You want in-store-only clearance that never appears online</li>
            </ul>
            <p className="mt-4"><strong>Online arbitrage wins when:</strong></p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Your time is the constraint — sourcing runs in minutes, not hours</li>
              <li>You want to scale beyond what local stores can supply</li>
              <li>You live far from the good clearance stores</li>
              <li>You&apos;re testing many product categories at once</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The hybrid most sellers land on</h2>
            <p>
              Most working resellers end up doing both: online sourcing for steady weekly flow, in-store
              runs when they&apos;re near a good store or during known clearance seasons. The models share
              the same profit math — check the{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              either way — so switching costs nothing but the sourcing habit.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              Neither model is passive income, and both have failure modes online advice glosses over:
              online deals sell out mid-checkout or get cancelled, in-store clearance competes with every
              other local picker, and in both cases prices can drop between your buy and your listing.
              Margins come from volume, speed, and disciplined math — not from picking the &quot;right&quot;
              model. Start with whichever sourcing method you can actually do this week.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live deals feed</Link> — online-arbitrage sourcing without the search.</li>
              <li><Link href="/guides/retail-arbitrage-for-beginners" className="font-medium text-emerald-600 underline dark:text-emerald-400">Retail arbitrage for beginners</Link> — the in-store playbook.</li>
              <li><Link href="/guides/amazon-arbitrage-guide" className="font-medium text-emerald-600 underline dark:text-emerald-400">Amazon arbitrage guide</Link> — the selling side, FBA fees included.</li>
              <li><Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Profit calculator</Link> — identical math for both models.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Online sourcing starts here
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The deals feed tracks live online markdowns across retailers — free to browse.
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
