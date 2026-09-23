"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

type NavChild = { href: string; label: string; desc?: string };
type NavGroup = { label: string; href?: string; children: NavChild[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deals",
    href: "/deals",
    children: [
      { href: "/deals/today", label: "Today's Deals", desc: "Fresh finds from today's scan" },
      { href: "/deals/best", label: "Best Deals", desc: "Highest profit spread right now" },
      { href: "/deals/trending", label: "Trending", desc: "What hunters are watching" },
      { href: "/deals/clearance", label: "Clearance", desc: "Deep-cut clearance finds" },
      { href: "/deals/calendar", label: "Deal Calendar", desc: "Best times to buy by category" },
      { href: "/deals/amazon-deals", label: "Amazon Deals", desc: "Amazon arbitrage picks" },
      { href: "/deals/walmart-deals", label: "Walmart Deals", desc: "Walmart arbitrage picks" },
      { href: "/retailers", label: "All Retailers", desc: "500+ stores we scan" },
    ],
  },
  {
    label: "Categories",
    href: "/categories",
    children: [
      { href: "/categories", label: "All Categories", desc: "Every deal vertical in one place" },
      { href: "/auctions", label: "Gov. Auctions", desc: "Federal surplus — vehicles, equipment" },
      { href: "/real-estate/deals", label: "Real Estate", desc: "Distressed & below-market listings" },
      { href: "/coupons", label: "Coupons", desc: "Verified promo codes" },
    ],
  },
  {
    label: "Tools",
    children: [
      { href: "/tools/profit-calculator", label: "Profit Calculator", desc: "Margin, ROI & break-even" },
      { href: "/tools/listing-generator", label: "Listing Generator", desc: "eBay/Poshmark listing copy" },
      { href: "/tools/real-estate-calculator", label: "Real Estate Calc", desc: "ARV & flip math" },
      { href: "/guides", label: "Guides", desc: "Arbitrage playbooks" },
    ],
  },
  {
    label: "Community",
    href: "/community",
    children: [
      { href: "/community", label: "Community Feed", desc: "Deals shared by hunters" },
      { href: "/community/leaderboard", label: "Leaderboard", desc: "Top contributors" },
      { href: "/seller", label: "Become a Seller", desc: "Get verified & post deals" },
      { href: "/referrals", label: "Referrals", desc: "Earn free months" },
    ],
  },
];

const TOP_LINKS = [{ href: "/pricing", label: "Pricing" }];

function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function Header() {
  const { isAuthenticated, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // Which mobile accordion section is expanded
  const [openSection, setOpenSection] = useState<string | null>(null);

  return (
    <header className="w-full border-b border-zinc-200 bg-white/90 backdrop-blur px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/90 sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
          onClick={() => setMenuOpen(false)}
        >
          <svg width="28" height="28" viewBox="0 0 128 128" className="rounded-lg shrink-0" aria-label="BargainHuntrs">
            <rect width="128" height="128" rx="28" className="fill-zinc-900 dark:fill-emerald-500" />
            <text x="38" y="64" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, -apple-system, sans-serif" fontSize="48" fontWeight="900" className="fill-white dark:fill-white">B</text>
            <path d="M64 28 L54 62 L62 62 L58 100 L74 58 L66 58 L70 28 Z" className="fill-white dark:fill-white" />
            <text x="92" y="64" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, -apple-system, sans-serif" fontSize="48" fontWeight="900" className="fill-white dark:fill-white">H</text>
          </svg>
          <span className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50 group-hover:opacity-80 transition-opacity">
            BargainHuntrs
          </span>
        </Link>

        {/* Desktop nav — grouped dropdowns */}
        <nav className="hidden sm:flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="relative group">
              <Link
                href={group.href ?? group.children[0].href}
                className="flex items-center gap-1 rounded-lg px-3 py-2 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                {group.label}
                <Chevron />
              </Link>
              {/* Dropdown — hover + focus-within keeps it open for keyboard users */}
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all duration-150 absolute left-0 top-full pt-2 z-50">
                <div className="w-64 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                  {group.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block rounded-lg px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {child.label}
                      </span>
                      {child.desc && (
                        <span className="block text-xs text-zinc-500 dark:text-zinc-500">
                          {child.desc}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {TOP_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden sm:flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ) : isAuthenticated ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
          )}
        </div>

        {/* Mobile: hamburger */}
        <button
          className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer — accordion groups */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-2 pb-2 space-y-1 max-h-[70vh] overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <button
                onClick={() =>
                  setOpenSection((s) => (s === group.label ? null : group.label))
                }
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
              >
                {group.label}
                <Chevron open={openSection === group.label} />
              </button>
              {openSection === group.label && (
                <div className="pb-1">
                  {group.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-lg px-6 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {TOP_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2 mt-2">
            {loading ? null : isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="block w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
              >
                Get started free
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
