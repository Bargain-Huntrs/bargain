import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { stringifyJsonLd } from "@/lib/jsonld";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "How to Read Clearance Tags at Walmart, Target & More | BargainHuntrs",
  description:
    "Clearance tags hide information in plain sight — markdown dates, price-ending patterns, and sticker colors that tell you whether the price drops again. Learn to read them before you buy.",
  alternates: { canonical: "/guides/how-to-read-clearance-tags" },
  openGraph: {
    type: "article",
    siteName: "BargainHuntrs",
    title: "How to Read Clearance Tags at Walmart, Target & More",
    description:
      "Markdown dates, price-ending patterns, and sticker colors — what clearance tags actually tell you.",
    url: "/guides/how-to-read-clearance-tags",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How to Read Clearance Tags" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "How to Read Clearance Tags at Walmart, Target & More",
    description: "Markdown dates, price endings, and sticker colors — what clearance tags actually tell you.",
    images: ["/og-image.png"],
  },
};

export default function ClearanceTagsGuide() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Read Clearance Tags at Walmart, Target & More",
    description:
      "Markdown dates, price-ending patterns, and sticker colors that tell you whether the price drops again.",
    author: { "@type": "Organization", name: "BargainHuntrs" },
    publisher: { "@type": "Organization", name: "BargainHuntrs" },
    datePublished: "2026-11-18",
    dateModified: "2026-11-18",
  };

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(jsonLd) }}
      />
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/guides" className="hover:text-zinc-900 dark:hover:text-zinc-100">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-zinc-900 dark:text-zinc-100">How to Read Clearance Tags</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How to Read Clearance Tags
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          The sticker on the shelf tells you more than the price — if you know what to look for.
        </p>

        <div className="mt-10 space-y-10 text-zinc-700 dark:text-zinc-300 [&>section>p]:leading-7">
          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">What a clearance tag actually encodes</h2>
            <p>
              Retail markdowns aren&apos;t random. Most big chains run clearance on a schedule — a first
              markdown, a second markdown, sometimes a final clearance price — and the tag usually carries
              clues about where an item sits in that cycle. The three things worth checking on any clearance
              sticker:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>The markdown date.</strong> Many stores print the date the price was last changed, sometimes in small type or as a code. A tag marked weeks ago is closer to its next drop than one marked yesterday.</li>
              <li><strong>The original price.</strong> Compare it against the sticker — a 15% markdown is usually an early-stage discount, not the bottom.</li>
              <li><strong>The sticker color and style.</strong> Stores use different sticker generations as markdowns progress. Employees can often tell you which color is &quot;final.&quot;</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Price-ending patterns (use with caution)</h2>
            <p>
              Deal communities have long tracked price endings — the idea that a price ending in certain
              digits signals whether an item is at its final markdown. The widely repeated version: at some
              retailers, prices ending in round numbers (.00) tend to be early markdowns while odd endings
              can signal a deeper or final cut.
            </p>
            <p className="mt-3">
              Treat these as folklore, not law. Pricing systems change, patterns vary by region and category,
              and no chain publishes a decoder ring. The ending digits are at most a hint — the markdown date
              and the discount percentage against original price are far more reliable signals.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The scanner beats the sticker</h2>
            <p>
              The most reliable trick costs nothing: scan the item with the retailer&apos;s own app or an
              in-store price scanner. The sticker is updated when an employee gets to it — the register price
              is updated the moment the markdown posts. It&apos;s common to find items ringing up below the
              tag price, sometimes far below, especially in departments mid-reset.
            </p>
            <p className="mt-3">
              If you&apos;re sourcing to resell, this gap between sticker and system price is where a lot of
              margin hides — items other shoppers walk past because the tag doesn&apos;t look like a deal yet.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Markdown timing patterns worth knowing</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><strong>Seasonal resets.</strong> Holiday and seasonal goods get aggressive cuts in the weeks after the season ends — patience pays if stock lasts.</li>
              <li><strong>Department reset days.</strong> Many stores mark down by department on recurring days. Store employees and regular shoppers usually know the rhythm — asking politely costs nothing.</li>
              <li><strong>End-of-rack and open-box.</strong> Discontinued SKUs, returned items, and display models often take steeper cuts than stocked goods because the store wants them gone, not warehoused.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">When to buy vs. wait</h2>
            <p>
              The tension in clearance hunting: wait for a deeper markdown and risk someone else buying it,
              or buy now and watch the price drop next week. A working rule:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>If the discount already clears your target (say, 50%+ for resale inventory), buy — the marginal extra savings rarely justify losing the unit.</li>
              <li>If it&apos;s an early markdown on a slow-moving item with plenty of stock, note the date and check back on the store&apos;s markdown cycle.</li>
              <li>For single-unit finds (open-box, one-off shelf pulls), the decision is always now-or-never — scan the price and decide on the spot.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">The honest part</h2>
            <p>
              Store policies, sticker systems, and markdown schedules change without notice, and they vary by
              location — what held true at one store last year may not hold at yours today. Nothing here is a
              guarantee of a deeper discount; it&apos;s a way to make a better guess. And if you&apos;re buying
              to resell, run the numbers in a{" "}
              <Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">profit calculator</Link>{" "}
              before assuming any markdown equals margin.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Start here</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li><Link href="/deals/clearance" className="font-medium text-emerald-600 underline dark:text-emerald-400">Live clearance deals</Link> — online clearance, tracked continuously.</li>
              <li><Link href="/guides/retail-arbitrage-for-beginners" className="font-medium text-emerald-600 underline dark:text-emerald-400">Retail arbitrage for beginners</Link> — turn clearance finds into flips.</li>
              <li><Link href="/guides/best-times-to-find-deals" className="font-medium text-emerald-600 underline dark:text-emerald-400">Best times to find deals</Link> — the calendar side of markdown timing.</li>
              <li><Link href="/tools/profit-calculator" className="font-medium text-emerald-600 underline dark:text-emerald-400">Profit calculator</Link> — check whether a tag price leaves real margin.</li>
            </ul>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Skip the aisle — see clearance online
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            The clearance feed pulls marked-down deals across retailers in one place, free to browse.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/deals/clearance"
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Browse clearance deals
            </Link>
            <Link
              href="/signup"
              className="rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Get deal alerts free
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
