import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PricingPlans } from "./PricingPlans";
import { plans } from "./plans";

export const metadata: Metadata = {
  title: "Pricing – BargainHuntrs",
  description:
    "Start free, upgrade when you're ready. Simple pricing for deal hunters.",
  alternates: { canonical: "/pricing" },
};

// ─── Data ──────────────────────────────────────────────────────────────────

const comparisonRows = [
  { feature: "Browse all deals", free: true, hunter: true },
  { feature: "Coupon codes", free: true, hunter: true },
  { feature: "Email alerts", free: true, hunter: true },
  { feature: "Instant alerts (real-time)", free: false, hunter: true },
  { feature: "SMS alerts", free: false, hunter: true },
  { feature: "Watchlist items", free: "10", hunter: "Unlimited" },
  { feature: "Price history", free: "30 days", hunter: "Full" },
  { feature: "Priority deals feed", free: false, hunter: true },
  { feature: "Early access to glitches", free: false, hunter: true },
  { feature: "Support", free: "Community", hunter: "Email" },
];

const faqs = [
  {
    q: "Is the Free plan really free?",
    a: "Yes, forever. No credit card required. You can browse every deal, use coupon codes, and get daily email alerts without paying a cent.",
  },
  {
    q: "What do I get with Hunter?",
    a: "Instant real-time alerts via email and SMS, unlimited watchlist items, full price history, priority access to the best deals, and early alerts when we spot price glitches — all before free users see them.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel with one click, no questions asked. You'll keep Hunter access until the end of your billing period, then drop back to Free.",
  },
  {
    q: "Is there a free trial for Hunter?",
    a: "Your first month of Hunter is backed by a 7-day money-back guarantee. If you haven't found a deal worth the subscription, we'll refund you in full.",
  },
  {
    q: "Will you add more plans later?",
    a: "We may add Pro and Team plans in the future with advanced features like API access and multi-seat accounts. Existing Hunter subscribers will always keep their pricing.",
  },
  {
    q: "How are deals found?",
    a: "We monitor prices across hundreds of online retailers and surface the best bargains, price drops, coupons, and limited-time promotions to our users.",
  },
];

// ─── Cell helper ───────────────────────────────────────────────────────────

function Cell({ value, highlighted }: { value: boolean | string; highlighted?: boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className={`text-emerald-500 font-semibold text-sm`}>✓</span>
    ) : (
      <span className="text-zinc-300 dark:text-zinc-700 text-sm">—</span>
    );
  }
  return (
    <span
      className={`text-xs font-medium tabular-nums ${
        highlighted ? "text-white dark:text-zinc-900" : "text-zinc-700 dark:text-zinc-300"
      }`}
    >
      {value}
    </span>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="px-6 py-20 text-center bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-6">
            Pricing
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Start free.<br />Upgrade when it pays for itself.
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Other deal tools charge $59+ before you&apos;ve found a single bargain.{" "}
            <strong className="text-zinc-900 dark:text-zinc-50">We start at free.</strong>{" "}
            Upgrade to Hunter for the price of two coffees a month.
          </p>
        </section>

        {/* ── Plan cards ───────────────────────────────────────────────── */}
        <PricingPlans />

        {/* ── Detailed comparison table ─────────────────────────────────── */}
        <section className="border-t border-zinc-200 px-6 py-20 dark:border-zinc-800 overflow-x-auto">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-10 text-center">
              What&apos;s included
            </h2>
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider w-1/2">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      className={`py-3 px-3 text-center text-xs font-bold uppercase tracking-wider ${
                        plan.highlight
                          ? "text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500"
                      }`}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b ${
                      i % 2 === 0
                        ? "border-zinc-100 dark:border-zinc-800/60"
                        : "border-zinc-200/60 dark:border-zinc-800"
                    }`}
                  >
                    <td className="py-3 pr-6 text-xs text-zinc-600 dark:text-zinc-400">
                      {row.feature}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Cell value={row.free} />
                    </td>
                    <td className="py-3 px-3 text-center bg-zinc-900/[0.03] dark:bg-zinc-50/[0.02]">
                      <Cell value={row.hunter} highlighted />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Risk reversal banner ─────────────────────────────────────── */}
        <section className="border-t border-zinc-200 dark:border-zinc-800 bg-emerald-50 dark:bg-emerald-950/20 px-6 py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              7-day money-back guarantee.
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
              Try Hunter for your first month. If you haven&apos;t found a single deal worth
              the $9.99, we&apos;ll refund you in full. No questions, no forms, no fight.
            </p>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="border-t border-zinc-200 px-6 py-16 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-8">
              Frequently asked questions
            </h2>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <dt className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{faq.q}</dt>
                  <dd className="mt-1 text-sm text-zinc-600 leading-snug dark:text-zinc-400">
                    {faq.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-50 px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white dark:text-zinc-900">
            Find your first deal today.
          </h2>
          <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-600 max-w-lg mx-auto">
            Start free, no credit card needed. Upgrade to Hunter the moment you realize
            you&apos;re missing deals. Or{" "}
            <Link
              href="/contact"
              className="font-medium underline underline-offset-4 text-zinc-300 dark:text-zinc-700 hover:text-white dark:hover:text-zinc-900 transition-colors"
            >
              get in touch
            </Link>{" "}
            — we&apos;ll help you decide.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            >
              Start for free
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-zinc-700 dark:border-zinc-300 px-7 py-3.5 text-sm font-semibold text-zinc-300 dark:text-zinc-700 transition-colors hover:border-zinc-500 hover:text-white dark:hover:text-zinc-900"
            >
              Talk to us first
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
