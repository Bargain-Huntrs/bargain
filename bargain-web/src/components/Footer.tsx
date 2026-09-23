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
                href="#"
                aria-label="BargainHuntrs on X"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              {/* Discord */}
              <a
                href="#"
                aria-label="BargainHuntrs Discord"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
              {/* Reddit */}
              <a
                href="#"
                aria-label="BargainHuntrs on Reddit"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-zinc-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-50 mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              <li><Link href="/#features" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Features</Link></li>
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
              <li><Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Contact</Link></li>
              <li><Link href="/waitlist" className="hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">Join Waitlist</Link></li>
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
