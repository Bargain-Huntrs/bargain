import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact Us – BargainHuntrs",
  description:
    "Questions, partnerships, press, or support — get in touch with the BargainHuntrs team. We respond within 24 hours on business days.",
};

const channels = [
  {
    icon: "📬",
    title: "Email us",
    body: "hello@bargainhuntrs.com",
    sub: "We respond within 24 hours on business days",
  },
  {
    icon: "💬",
    title: "Community",
    body: "Join our Discord",
    sub: "2,300+ resellers sharing deals, tips & tricks",
  },
  {
    icon: "🏪",
    title: "Sell with us",
    body: "Seller portal",
    sub: "Submit coupon codes and price drops directly",
  },
];

export default function ContactPage() {
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
              Contact
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
              Talk to a human.
            </h1>
            <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto">
              Questions about your account, a deal, selling with us, or press —
              send it over and we&apos;ll get back to you fast.
            </p>
          </div>
        </section>

        {/* ── Two-column: channels + form ───────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl grid gap-16 lg:grid-cols-2 lg:gap-12 items-start">

            {/* Left: channels */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-8">
                Other ways to reach us
              </h2>
              <div className="space-y-8">
                {channels.map((c) => (
                  <div key={c.title} className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-xl dark:border-zinc-800 dark:bg-zinc-900">
                      {c.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{c.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.body}</p>
                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-600">{c.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                  Looking for early access instead?
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  The waitlist is a separate list —{" "}
                  <a href="/waitlist" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    join it here
                  </a>{" "}
                  to lock in founder pricing.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                  Send us a message
                </h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                  We read every message. Expect a reply within one business day.
                </p>
                <ContactForm />
              </div>
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
