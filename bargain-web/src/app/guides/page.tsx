import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Deal Hunting Guides — Learn to Find & Flip Deals | BargainHuntrs",
  description:
    "Free guides on finding price glitches, Amazon arbitrage, retail arbitrage, and the best times to find deals. Learn from BargainHuntrs experts.",
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Deal Hunting Guides — Learn to Find & Flip Deals",
    description: "Free guides on finding price glitches, Amazon arbitrage, and retail arbitrage.",
    url: "/guides",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Deal Hunting Guides" }],
  },
};

const guides = [
  {
    href: "/guides/how-to-find-price-glitches",
    title: "How to Find Price Glitches on Amazon & Walmart",
    description: "Learn how to find pricing errors and score 75%+ discounts on major retailers.",
    readTime: "8 min read",
  },
  {
    href: "/guides/amazon-arbitrage-guide",
    title: "Amazon Arbitrage: Complete Guide to Flipping Products",
    description: "Learn how to find underpriced products and resell them for profit on Amazon.",
    readTime: "12 min read",
  },
  {
    href: "/guides/retail-arbitrage-for-beginners",
    title: "Retail Arbitrage for Beginners",
    description: "Everything you need to start buying low and selling high. No experience required.",
    readTime: "10 min read",
  },
  {
    href: "/guides/best-times-to-find-deals",
    title: "Best Times to Find Deals Online (2026 Calendar)",
    description: "When do the best online deals happen? Learn the best days, times, and seasons.",
    readTime: "7 min read",
  },
  {
    href: "/guides/how-resellers-find-deep-discounts",
    title: "How Resellers Find 50%+ Discounts Before They Sell Out",
    description: "The real mechanics behind finding deep discounts early — alerts, markdown cycles, and deal feeds.",
    readTime: "8 min read",
  },
];

export default function GuidesIndex() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Deal Hunting Guides
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Learn how to find the best deals, spot price glitches, and flip products for profit.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="group rounded-xl border border-zinc-200 p-6 transition hover:border-blue-500 hover:shadow-lg dark:border-zinc-800 dark:hover:border-blue-500"
            >
              <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
                {guide.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {guide.description}
              </p>
              <p className="mt-4 text-xs text-zinc-400">{guide.readTime}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-xl bg-gradient-to-r from-blue-50 to-green-50 p-8 dark:from-blue-950 dark:to-green-950">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ready to start finding deals?
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Get real-time deal alerts from 500+ retailers. It&apos;s free.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign Up Free →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
