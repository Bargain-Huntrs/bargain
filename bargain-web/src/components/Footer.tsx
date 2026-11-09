import Link from "next/link";

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 pt-14 pb-10 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl">

        {/* Top row */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 group w-fit">
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
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
              Arbitrage intelligence platform. We scan 500+ retailers in real time, catch pricing glitches within seconds, and show you the exact profit spread before you spend a dollar.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {/* Twitter/X */}
              <a
                href="https://x.com/bargain4huntrs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="BargainHuntrs on X"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Instagram */}
              <a
                href="https://www.instagram.com/bargainhuntrs/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="BargainHuntrs on Instagram"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              {/* Facebook */}
              <a
                href="https://www.facebook.com/bargainhuntrs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="BargainHuntrs on Facebook"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/#features" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Features</Link></li>
              <li><Link href="/stores" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Deals by Store</Link></li>
              <li><Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Pricing</Link></li>
              <li><Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Dashboard</Link></li>
              <li><Link href="/guides" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Guides</Link></li>
              <li><Link href="/#vs-competitors" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">vs. Competitors</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/about" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Contact</Link></li>
              <li><Link href="/waitlist" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Join Waitlist</Link></li>
              <li><Link href="/roadmap" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Feature Roadmap</Link></li>
              <li>
                <a
                  href="mailto:hello@bargainhuntrs.com"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  hello@bargainhuntrs.com
                </a>
              </li>
              <li>
                <Link
                  href="/community"
                  className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  Community
                </Link>
              </li>
            </ul>
          </div>

          {/* Account + Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-4">Account</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              <li><Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Dashboard</Link></li>
              <li><Link href="/settings/notifications" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Notifications</Link></li>
              <li><Link href="/referrals" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Referrals</Link></li>
            </ul>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-4">Legal</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Terms of Service</Link></li>
              <li><Link href="/disclosure" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Affiliate Disclosure</Link></li>
            </ul>
          </div>

        </div>

        {/* Bottom row */}
        <div className="mt-12 border-t border-zinc-100 dark:border-zinc-800 pt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              &copy; {year} BargainHuntrs, Inc. All rights reserved.
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              Powered by SI — Super Intelligence
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600">
              Not affiliated with Amazon, eBay, Walmart, or any tracked retailer.
            </p>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 max-w-2xl">
            BargainHuntrs is a participant in the Amazon Associates Program, an affiliate advertising program designed to provide a means for sites to earn advertising fees by advertising and linking to Amazon.com. As an Amazon Associate, we earn from qualifying purchases.
          </p>
        </div>

      </div>
    </footer>
  );
}
