import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How to Check Store Inventory Before You Drive | BargainHuntrs",
  description:
    "Nothing wastes a sourcing trip like a deal that's out of stock. How to check local store inventory with retailer apps, inventory tools, and SKU lookups before you leave the house.",
  alternates: { canonical: "/guides/how-to-check-store-inventory" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "How to Check Store Inventory Before You Drive",
    description:
      "Retailer apps, inventory tools, and SKU lookups — verify local stock before the trip.",
    url: "/guides/how-to-check-store-inventory",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How to Check Store Inventory" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "How to Check Store Inventory Before You Drive",
    description: "Retailer apps, inventory tools, and SKU lookups — verify stock before the trip.",
    images: ["/og-image.png"],
  },
};

export default function CheckStoreInventory() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Check Store Inventory Before You Drive",
    description:
      "Retailer apps, inventory tools, and SKU lookups — verify local stock before the trip.",
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
          <span className="text-zinc-900 dark:text-zinc-100">How to Check Store Inventory</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How to Check Store Inventory Before You Drive
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          A posted deal means nothing if the shelf is empty. Verify stock first — here&apos;s how the checks actually work.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start with the retailer&apos;s own app</h2>
            <p>
              Most big-box retailer apps show per-store availability: switch your &quot;my store&quot; to the
              location you&apos;d visit, search the item, and the listing shows whether it&apos;s in stock,
              often with an aisle location. This is the most direct source — it reads the same inventory
              system the store itself uses.
            </p>
            <p className="mt-3">
              The catch: it&apos;s only as fresh as the last inventory sync. An item showing &quot;in
              stock&quot; can be sitting in someone&apos;s cart, misplaced in the wrong aisle, or counted but
              physically gone. Store inventory counts are estimates, not guarantees.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">SKU and UPC lookups</h2>
            <p>
              Every product has identifiers — SKU (store-specific), UPC (universal barcode), and model
              number. When a deal post mentions a price at a specific retailer, grab the SKU or UPC from the
              product page and search it directly in the retailer&apos;s site or app. Searching by identifier
              is more reliable than searching by name — the same product can appear under multiple listings
              with different stock statuses.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Third-party inventory trackers</h2>
            <p>
              Dedicated inventory-checking tools aggregate per-store stock data for major chains — you enter
              a SKU or UPC plus your zip code and get stock and price by location. Coverage and accuracy vary
              by retailer and by how recently each store synced; treat results as &quot;probably&quot; rather
              than &quot;definitely,&quot; especially for clearance items which sell through fast and update
              slowly.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The phone call that still works</h2>
            <p>
              For a high-value or one-off item, calling the store is still the most reliable check. Ask for
              the department, give the SKU, and ask them to physically check the shelf — a register lookup
              says what the system believes, a shelf check says what exists. Five minutes on the phone beats
              forty minutes of driving for an empty endcap.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Why &quot;in stock&quot; still fails</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Lag.</strong> Inventory systems sync on a delay — a hot clearance item can sell out between the sync and your arrival.</li>
              <li><strong>Misplaced stock.</strong> Counted but in the wrong spot — the back room, a random endcap, a cart of go-backs.</li>
              <li><strong>Hidden clearance.</strong> Unmarked markdowns ring up at system price, which doesn&apos;t appear in stock tools at all — see the <Link href="/guides/how-to-read-clearance-tags" className="font-medium text-emerald-600 underline dark:text-emerald-400">clearance tag guide</Link>.</li>
              <li><strong>Display and open-box units.</strong> Sometimes the last unit is the floor model — ask if you&apos;d take it.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              No inventory check is a guarantee — systems lag, stock moves, and clearance items are exactly
              the inventory least likely to be where the system says. The realistic goal is raising your
              hit rate, not eliminating dry trips: check the app, cross-check with a tracker if the trip is
              far, and call the store for anything you&apos;d be genuinely annoyed to miss. For resellers,
              remember the other half of the math — stock in hand only matters if the{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              says the flip clears your margin.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals/clearance" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live clearance deals</Link> — online markdowns, no driving required.</li>
              <li><Link href="/guides/how-to-read-clearance-tags" className="font-medium text-emerald-600 underline dark:text-emerald-400">How to read clearance tags</Link> — what to look for once you&apos;re in the aisle.</li>
              <li><Link href="/guides/warehouse-club-arbitrage" className="font-medium text-emerald-600 underline dark:text-emerald-400">Warehouse club arbitrage</Link> — club sourcing where the stock check matters most.</li>
              <li><Link href="/guides/best-times-to-find-deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Best times to find deals</Link> — time the trip to the markdown cycle.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Or skip the trip — shop online deals
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
