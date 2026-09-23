"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type Category = {
  href: string;
  icon: string;
  title: string;
  desc: string;
  tag?: string;
};

const GROUPS: { label: string; blurb: string; items: Category[] }[] = [
  {
    label: "Retail deals",
    blurb: "Price glitches, clearance, and arbitrage scanned across 500+ retailers.",
    items: [
      { href: "/deals", icon: "🏷️", title: "All Deals", desc: "Every live deal on the feed, filterable by store and source", tag: "Live" },
      { href: "/deals/today", icon: "📅", title: "Today's Deals", desc: "Fresh finds from today's scan" },
      { href: "/deals/best", icon: "🏆", title: "Best Deals", desc: "Highest profit spread right now" },
      { href: "/deals/trending", icon: "📈", title: "Trending", desc: "What hunters are watching" },
      { href: "/deals/clearance", icon: "🧹", title: "Clearance", desc: "Deep-cut clearance finds" },
      { href: "/deals/amazon-deals", icon: "📦", title: "Amazon Deals", desc: "Amazon arbitrage picks" },
      { href: "/deals/walmart-deals", icon: "🛒", title: "Walmart Deals", desc: "Walmart arbitrage picks" },
      { href: "/deals/calendar", icon: "🗓️", title: "Deal Calendar", desc: "Best times to buy by category" },
      { href: "/retailers", icon: "🏬", title: "All Retailers", desc: "500+ stores we scan" },
    ],
  },
  {
    label: "Beyond retail",
    blurb: "Other ways to find an edge — property, auctions, and stackable codes.",
    items: [
      { href: "/real-estate/deals", icon: "🏠", title: "Real Estate", desc: "Distressed & below-market listings", tag: "Live" },
      { href: "/auctions", icon: "🔨", title: "Auctions & Surplus", desc: "Government & retail auctions" },
      { href: "/coupons", icon: "🎟️", title: "Coupons", desc: "Verified promo codes & stacking" },
    ],
  },
  {
    label: "Community",
    blurb: "Deals found and shared by hunters — vote, earn Aura, climb the board.",
    items: [
      { href: "/community", icon: "👥", title: "Community Finds", desc: "Deals posted by hunters" },
      { href: "/community/leaderboard", icon: "🥇", title: "Leaderboard", desc: "Top contributors this week" },
      { href: "/seller", icon: "🏪", title: "Become a Seller", desc: "Submit codes & price drops" },
    ],
  },
  {
    label: "Tools & guides",
    blurb: "Free calculators and playbooks to run the numbers before you buy.",
    items: [
      { href: "/tools/profit-calculator", icon: "🧮", title: "Profit Calculator", desc: "Margin, ROI & break-even" },
      { href: "/tools/listing-generator", icon: "📦", title: "Listing Generator", desc: "eBay/Poshmark listing copy" },
      { href: "/tools/real-estate-calculator", icon: "🏘️", title: "Real Estate Calc", desc: "ARV & flip math" },
      { href: "/guides", icon: "📖", title: "Guides", desc: "Arbitrage playbooks" },
    ],
  },
];

export default function CategoriesClient() {
  return (
    <div className="flex min-h-full flex-col bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <section className="border-b border-zinc-200 bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 px-6 py-14 text-center dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            Every category,{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
              one hunt.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
            Retail glitches, clearance, real estate, auctions, coupons, and community finds —
            each lives on its own page. Pick a lane and dig in.
          </p>
        </section>

        {GROUPS.map((g) => (
          <section key={g.label} className="border-b border-zinc-200 px-6 py-10 last:border-0 dark:border-zinc-800">
            <div className="mx-auto max-w-5xl">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {g.label}
              </h2>
              <p className="mt-1 mb-5 text-sm text-zinc-600 dark:text-zinc-400">{g.blurb}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {g.items.map((c) => (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="group rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{c.icon}</span>
                      {c.tag && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                          {c.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">{c.title}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{c.desc}</p>
                    <p className="mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Browse
                      <span className="ml-1 inline-block text-zinc-400 transition-transform group-hover:translate-x-0.5">→</span>
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
