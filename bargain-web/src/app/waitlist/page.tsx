import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WaitlistForm from "./WaitlistForm";

export const metadata: Metadata = {
  title: "Join the Waitlist – BargainHuntrs",
  description:
    "Early access to BargainHuntrs is rolling out in batches. Drop your email and we'll let you know the moment your spot opens.",
};

const signals = [
  { stat: "10,000+", label: "people already on the waitlist" },
  { stat: "< 1 week", label: "average time from waitlist to invite" },
  { stat: "$0", label: "required to reserve your spot" },
];

const reasons = [
  {
    icon: "⚡",
    title: "Early access to glitch alerts",
    body: "Glitch detection is being rolled out to early users first. The sooner you're on the list, the sooner you start catching deals competitors miss.",
  },
  {
    icon: "🔒",
    title: "Locked-in founder pricing",
    body: "Waitlisters get 40% off their first three months when they activate. This offer won't be available at general launch.",
  },
  {
    icon: "🗺️",
    title: "Shape the product",
    body: "We interview waitlisters about their current tools, pain points, and wishlist features. Your feedback directly drives what we build next.",
  },
];

export default function WaitlistPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-6 py-20 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#e4e4e720_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e720_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(to_right,#27272a30_1px,transparent_1px),linear-gradient(to_bottom,#27272a30_1px,transparent_1px)]"
          />
          <div className="relative">
            <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-6">
              Early access
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              The deal hunters who get in early<br />get in cheap.
            </h1>
            <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
              We&apos;re rolling out in batches. Drop your email below to reserve your spot — and lock in
              40% off your first three months when your invite arrives.
            </p>
          </div>
        </section>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        <section className="border-y border-zinc-200 bg-zinc-50/80 px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="mx-auto max-w-3xl flex flex-wrap justify-center gap-12 text-center">
            {signals.map(({ stat, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tabular-nums">{stat}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Two-column: reasons + form ────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 lg:gap-12 items-start">

            {/* Left: Why join now */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-8">
                Why join the waitlist now?
              </h2>
              <div className="space-y-8">
                {reasons.map((r) => (
                  <div key={r.title} className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-xl dark:border-zinc-800 dark:bg-zinc-900">
                      {r.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{r.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600 leading-relaxed dark:text-zinc-400">{r.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Competitor comparison callout */}
              <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                  vs. what you&apos;re probably using now
                </p>
                <div className="space-y-2.5">
                  {[
                    ["Tactical Arbitrage", "Amazon-only, $59/mo, no glitch detection"],
                    ["BuyBotPro", "Finds nothing — only analyzes deals you bring it"],
                    ["BrickSeek", "Consumer tool, no profit math, US retail only"],
                    ["Keepa / CamelCamelCamel", "Pretty charts. Zero arbitrage intelligence."],
                  ].map(([tool, note]) => (
                    <div key={tool} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 text-rose-400 shrink-0">✕</span>
                      <span>
                        <strong className="text-zinc-700 dark:text-zinc-300">{tool}</strong>
                        {" — "}
                        <span className="text-zinc-500 dark:text-zinc-500">{note}</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 text-xs mt-3">
                    <span className="mt-0.5 text-emerald-500 shrink-0">✓</span>
                    <span>
                      <strong className="text-emerald-700 dark:text-emerald-400">BargainHuntrs</strong>
                      {" — "}
                      <span className="text-zinc-500 dark:text-zinc-500">
                        Glitch detection + cross-platform arbitrage + true profit math. Starting free.
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                  Reserve your spot
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  Takes 30 seconds. No payment info needed.
                </p>
                <WaitlistForm />
              </div>
            </div>

          </div>
        </section>

        {/* ── Contact info strip ───────────────────────────────────────── */}
        <section className="border-t border-zinc-200 px-6 py-16 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-3xl grid gap-8 sm:grid-cols-3 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-2xl dark:bg-zinc-900 dark:border-zinc-800">
                📬
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Email us</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                hello@bargainhuntrs.com
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                We respond within 24 hours on business days
              </p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-2xl dark:bg-zinc-900 dark:border-zinc-800">
                💬
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Community</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Join our Discord
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                2,300+ resellers sharing deals, tips & tricks
              </p>
            </div>
            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white border border-zinc-200 text-2xl dark:bg-zinc-900 dark:border-zinc-800">
                🔒
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">No spam</h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                We only email about your invite and major updates
              </p>
              <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">
                Unsubscribe anytime in one click
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
