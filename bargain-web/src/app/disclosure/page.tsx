import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | BargainHuntrs",
  description:
    "BargainHuntrs participates in affiliate programs including Amazon Associates, eBay Partner Network, Walmart, CJ Affiliate, Impact, Rakuten Advertising, and Awin. Learn how affiliate links work on our site.",
  alternates: { canonical: "/disclosure" },
  robots: { index: true },
};

export default function DisclosurePage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Affiliate Disclosure
        </h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Last updated: October 2026
        </p>

        <section className="mt-8 space-y-6 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            In compliance with the Federal Trade Commission&apos;s guidelines
            (16 CFR Part 255, &quot;Guides Concerning the Use of Endorsements and
            Testimonials in Advertising&quot;), this page discloses how
            BargainHuntrs earns money when you click links on our site.
          </p>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Affiliate links
            </h2>
            <p className="mt-3">
              Some links on BargainHuntrs are affiliate links. If you click an
              affiliate link and make a purchase, we may earn a commission from
              the retailer. <strong>You never pay more</strong> — commissions
              come from the retailer&apos;s marketing budget, not from your
              pocket. In many cases our links surface extra discounts.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Programs we participate in
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Amazon Associates</strong> — BargainHuntrs is a
                participant in the Amazon Services LLC Associates Program, an
                affiliate advertising program designed to provide a means for
                sites to earn advertising fees by advertising and linking to
                Amazon.com. As an Amazon Associate, we earn from qualifying
                purchases.
              </li>
              <li><strong>eBay Partner Network</strong></li>
              <li><strong>Walmart Affiliate Program</strong></li>
              <li><strong>CJ Affiliate</strong></li>
              <li><strong>Impact</strong></li>
              <li><strong>Rakuten Advertising</strong></li>
              <li><strong>Awin</strong></li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Independence
            </h2>
            <p className="mt-3">
              Affiliate relationships do not influence which deals we surface
              or how we analyze them. Deals are listed because we believe they
              represent real savings — commission rates are not a ranking
              factor. When a listing is a paid merchant placement, it is
              labeled as sponsored.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Price and availability accuracy
            </h2>
            <p className="mt-3">
              Prices and availability shown on BargainHuntrs are snapshots and
              can change at any time on the retailer&apos;s site. The price and
              availability displayed on the retailer&apos;s site at the time of
              purchase will apply to your order. Product images used in deal
              listings may be provided via affiliate program product APIs.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Questions
            </h2>
            <p className="mt-3">
              BargainHuntrs is operated by Reid Family Estates, LLC. Questions
              about this disclosure? Reach us via our{" "}
              <a href="/contact" className="text-blue-600 hover:underline dark:text-blue-400">
                contact page
              </a>
              .
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
