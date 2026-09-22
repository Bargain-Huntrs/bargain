import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { REAL_ESTATE_TOOLS } from "@/lib/real-estate-tools";

export const dynamic = "force-static";

const TITLE = "Real Estate Deals — Off-Market Bargains & Deal Calculator | BargainHuntrs";
const DESCRIPTION =
  "Hunt real estate bargains the same way you hunt retail deals. Free 70% rule, flip ROI, and rental yield calculators plus tools for finding off-market and distressed properties.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "off market real estate deals",
    "real estate deal calculator",
    "70% rule calculator",
    "MAO calculator",
    "maximum allowable offer",
    "flip calculator",
    "rental yield calculator",
    "distressed property deals",
    "REO deals",
    "wholesale real estate",
  ],
  alternates: { canonical: "/real-estate" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: TITLE,
    description: DESCRIPTION,
    url: "/real-estate",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Real Estate Deals" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

const DEAL_SOURCES = [
  {
    title: "Bank REO listings",
    description:
      "Foreclosed homes owned by lenders — HUD Home Store, HomePath (Fannie Mae), and HomeSteps (Freddie Mac) publish discounted inventory publicly.",
  },
  {
    title: "Auction sites",
    description:
      "Auction.com, Hubzu, and Xome list bank-owned and foreclosure auction properties, often below comparable MLS pricing.",
  },
  {
    title: "Wholesalers & private sellers",
    description:
      "Wholesalers assign contracts on distressed homes they negotiated below market. You buy the deal, not the listing service.",
  },
  {
    title: "County records",
    description:
      "Foreclosure filings, tax sales, and probate records are public — the earliest possible signal of a motivated seller.",
  },
];

const FAQS = [
  {
    question: "Is BargainHuntrs a real estate brokerage?",
    answer:
      "No. BargainHuntrs is not a real estate broker, agent, or party to any transaction. We publish free tools and educational content. Any property advertised here is listed by its seller, and all negotiations happen directly between buyer and seller.",
  },
  {
    question: "What is the 70% rule in real estate?",
    answer:
      "The 70% rule says an investor should pay no more than 70% of a property's after-repair value (ARV) minus repair costs. Example: a house worth $300,000 fixed-up that needs $40,000 in work has a max allowable offer of $300,000 × 0.70 − $40,000 = $170,000.",
  },
  {
    question: "How do I find off-market deals without the MLS?",
    answer:
      "The main sources are bank REO listings, auction platforms, wholesalers, driving for dollars, and public county records (foreclosure filings, tax sales, probate). Our free deal calculator helps you run the numbers on whatever you find.",
  },
];

export default function RealEstateLandingPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-6 py-14 text-center bg-gradient-to-b from-white via-zinc-50/60 to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
          <span className="inline-block rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-5">
            New — Real Estate
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-[1.1]">
            Real Estate Bargains,{" "}
            <span className="text-emerald-600 dark:text-emerald-400">Hunted</span>
          </h1>
          <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            The best property deals never hit the MLS. They&apos;re in REO lists,
            auctions, wholesale contracts, and county filings. We&apos;re bringing
            the same deal-hunting engine to real estate — starting with the
            calculator every investor needs.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/tools/real-estate-calculator"
              className="rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            >
              Open the deal calculator
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-zinc-300 px-7 py-3.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Get deal alerts free
            </Link>
          </div>
        </section>

        {/* Calculator feature */}
        <section className="px-6 py-12">
          <div className="mx-auto max-w-5xl grid gap-6 md:grid-cols-3">
            {[
              {
                title: "70% Rule / MAO",
                body: "Enter the after-repair value and rehab cost — get the max you should offer instantly. Adjust the rule percentage for your market.",
              },
              {
                title: "Flip ROI",
                body: "Purchase + rehab + holding + closing costs vs. sale price. See net profit and true ROI before you commit a dollar.",
              },
              {
                title: "Rental Yield",
                body: "Monthly rent vs. all-in cost with vacancy and expense assumptions. Cap rate, cash flow, and the 1% rule check.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{f.title}</h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500 max-w-2xl mx-auto">
            Estimates only — not an appraisal, not financial advice. Always verify
            with your own comps and professionals.
          </p>
        </section>

        {/* Where deals come from */}
        <section className="px-6 py-12 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
              Where off-market deals actually come from
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
              No MLS required. These sources publish discounted inventory publicly —
              most buyers just never look.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {DEAL_SOURCES.map((s) => (
                <div
                  key={s.title}
                  className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
                >
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Investor tools (affiliate slots) */}
        <section className="px-6 py-12 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
              Tools the pros use to find deals
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
              For comps, motivated-seller lists, and driving-for-dollars. Run every
              find through our free calculator before you offer.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {REAL_ESTATE_TOOLS.map((tool) => (
                <a
                  key={tool.name}
                  href={tool.href}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="group rounded-xl border border-zinc-200 p-5 transition hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:hover:border-emerald-500"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900 group-hover:text-emerald-600 dark:text-zinc-50 dark:group-hover:text-emerald-400">
                      {tool.name}
                    </h3>
                    {tool.badge && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">{tool.blurb}</p>
                  <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Visit site →
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-10 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {FAQS.map((faq, i) => (
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
      </main>

      <Footer />
    </div>
  );
}
