"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { href: "/deals", label: "Deals" },
  { href: "/retailers", label: "Retailers" },
  { href: "/deals/calendar", label: "Calendar" },
  { href: "/community", label: "Community" },
  { href: "/seller", label: "Seller" },
  { href: "/pricing", label: "Pricing" },
  { href: "/coupons", label: "Coupons" },
  { href: "/tools/profit-calculator", label: "Profit Calc" },
  { href: "/tools/listing-generator", label: "Listing Gen" },
  { href: "/real-estate", label: "Real Estate" },
  { href: "/contact", label: "Waitlist" },
];

export default function Header() {
  const { isAuthenticated, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
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
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Get started
              </Link>
            </>
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

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 pb-2 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
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
              <>
                <Link
                  href="/signup"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Get started free
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl border border-zinc-200 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
