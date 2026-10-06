import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getPublicDealRetailers, type PublicRetailer } from "@/lib/api";
import { retailerSlug, retailerDisplayName } from "@/lib/retailers";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Store Deals — Deals by Retailer",
  description:
    "Browse today's best deals by store. Live deals from Amazon, Walmart, Target, Best Buy, and hundreds more retailers — updated throughout the day.",
  alternates: { canonical: "/stores" },
  openGraph: {
    title: "Store Deals — Deals by Retailer",
    description:
      "Browse today's best deals by store. Live deals from Amazon, Walmart, Target, Best Buy, and hundreds more retailers.",
    url: "/stores",
  },
};

export default async function StoresIndexPage() {
  let retailers: PublicRetailer[] = [];
  let error = "";
  try {
    retailers = await getPublicDealRetailers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load stores";
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/deals"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            ← Back to all deals
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Deals by Store
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Every retailer with live deals right now. Our scanners track 500+
            stores — pick one to see its current bargains.
          </p>

          {error ? (
            <div className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
              {error}
            </div>
          ) : retailers.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No store deals available right now. Check back soon.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {retailers.map((r) => (
                <Link
                  key={r.retailer}
                  href={`/stores/${retailerSlug(r.retailer)}`}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {retailerDisplayName(r.retailer)}
                  </span>
                  <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {r.deals} live deal{r.deals !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <p className="mt-10 text-sm text-zinc-500 dark:text-zinc-400">
            Looking for store guides and pickup info?{" "}
            <Link href="/retailers" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
              Browse the retailer directory
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
