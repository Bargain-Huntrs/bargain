import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { ArbitrageDeal } from "@/lib/api";
import SeoDealCard from "@/components/SeoDealCard";
import AffiliateDisclosure from "@/components/AffiliateDisclosure";
import { stringifyJsonLd } from "@/lib/jsonld";

export interface SeoPageConfig {
  title: string;
  description: string;
  backLink?: string;
  backLabel?: string;
  source: string;
  showRank?: boolean;
  faqs?: { question: string; answer: string }[];
  relatedLinks?: { href: string; label: string }[];
  introContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  jsonLd?: object | object[];
}

export default function SeoPageLayout({
  config,
  deals,
  error,
}: {
  config: SeoPageConfig;
  deals: ArbitrageDeal[];
  error?: string;
}) {
  const jsonLdArray = config.jsonLd
    ? Array.isArray(config.jsonLd)
      ? config.jsonLd
      : [config.jsonLd]
    : [];

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      {jsonLdArray.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(ld) }}
        />
      ))}

      <Header />

      <main className="flex-1">
        {/* Page header */}
        <section className="px-6 py-10 border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl">
            <Link
              href={config.backLink || "/deals"}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {config.backLabel || "< Back to all deals"}
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {config.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
              {config.description}
            </p>
          </div>
        </section>

        {/* Intro content */}
        {config.introContent && (
          <section className="px-6 py-6">
            <div className="mx-auto max-w-4xl text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-50 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-50 [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-emerald-600 dark:[&_a]:text-emerald-400 [&_a]:underline">
              {config.introContent}
            </div>
          </section>
        )}

        {/* Deals grid */}
        <section className="px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl">
            {error ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                {error}
              </div>
            ) : deals.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No deals available right now. Check back soon — our scanners update throughout the day.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {deals.length} deal{deals.length !== 1 ? "s" : ""} found
                  </p>
                  <Link
                    href="/deals"
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-emerald-500 dark:hover:text-white"
                  >
                    Browse All Deals
                  </Link>
                </div>
                <AffiliateDisclosure className="mb-4" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {deals.map((deal, idx) => (
                    <SeoDealCard
                      key={deal.id}
                      deal={deal}
                      source={config.source}
                      showRank={config.showRank}
                      rank={config.showRank ? idx + 1 : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Bottom content */}
        {config.bottomContent && (
          <section className="px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-4xl text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-900 dark:[&_h2]:text-zinc-50 [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-900 dark:[&_h3]:text-zinc-50 [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_a]:text-emerald-600 dark:[&_a]:text-emerald-400 [&_a]:underline">
              {config.bottomContent}
            </div>
          </section>
        )}

        {/* Related links */}
        {config.relatedLinks && config.relatedLinks.length > 0 && (
          <section className="px-6 py-8 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Browse more deals
              </h2>
              <div className="flex flex-wrap gap-2">
                {config.relatedLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        {config.faqs && config.faqs.length > 0 && (
          <section className="px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                {config.faqs.map((faq, i) => (
                  <div key={i}>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
