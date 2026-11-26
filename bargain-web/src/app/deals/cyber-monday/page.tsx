import type { Metadata } from "next";
import Link from "next/link";
import { getPublicDeals, getPublicCoupons, type ArbitrageDeal, type Coupon } from "@/lib/api";
import { discountPercent, savingsAmount } from "@/lib/seo-helpers";
import SeoPageLayout from "@/components/SeoPageLayout";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Cyber Monday Deals 2026 — Online-Only Markdowns & Promo Codes | BargainHuntrs",
  description:
    "The best Cyber Monday deals and promo codes, updated live. Online-only markdowns stacked on weekend clearance — electronics, home, fashion and more.",
  alternates: { canonical: "/deals/cyber-monday" },
  openGraph: {
    type: "website",
    siteName: "BargainHuntrs",
    title: "Cyber Monday Deals 2026 — Online-Only Markdowns & Promo Codes | BargainHuntrs",
    description:
      "The best Cyber Monday deals and promo codes, updated live. Online-only markdowns stacked on weekend clearance.",
    url: "/deals/cyber-monday",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Cyber Monday Deals" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@bargain4huntrs",
    creator: "@bargain4huntrs",
    title: "Cyber Monday Deals 2026 — Online-Only Markdowns & Promo Codes | BargainHuntrs",
    description:
      "The best Cyber Monday deals and promo codes, updated live. Online-only markdowns stacked on weekend clearance.",
    images: ["/og-image.png"],
  },
};

const RELATED_LINKS = [
  { href: "/deals/today", label: "Today's Best Deals" },
  { href: "/deals/price-drops", label: "Biggest Price Drops" },
  { href: "/deals/clearance", label: "Clearance Deals" },
  { href: "/deals/over-50-off", label: "Over 50% Off" },
  { href: "/deals/under-10", label: "Deals Under $10" },
  { href: "/coupons", label: "All Promo Codes" },
];

const FAQS = [
  {
    question: "When is Cyber Monday 2026?",
    answer:
      "Cyber Monday 2026 is Monday, November 30 — the Monday after Thanksgiving. Many retailers launch online-only deals starting Sunday night, and the best prices often carry over from the Black Friday weekend.",
  },
  {
    question: "Are Cyber Monday deals better than Black Friday?",
    answer:
      "For online shopping, often yes. Cyber Monday concentrates online-only markdowns on top of weekend clearance, and retailers frequently deepen discounts Monday morning to hit sales targets. Electronics, small appliances, and fashion tend to see the strongest Cyber Monday pricing.",
  },
  {
    question: "How do I stack savings on Cyber Monday?",
    answer:
      "Combine three layers: the retailer's Cyber Monday markdown, a promo code from our live coupon list at checkout, and cashback through a rewards portal. Promo codes from this page come directly from affiliate networks — they're real codes issued by the retailers.",
  },
  {
    question: "How often is this Cyber Monday page updated?",
    answer:
      "Our scanners detect new deals and price drops continuously throughout Cyber Monday weekend. Promo codes are refreshed as affiliate networks issue them — including codes embargoed until Cyber Monday itself, which appear here the moment they go live.",
  },
];

function isActiveCoupon(c: Coupon): boolean {
  if (c.status && c.status !== "active") return false;
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return false;
  return true;
}

function couponLabel(c: Coupon): string {
  if (c.discount_type === "percentage") return `${c.discount_value}% off`;
  if (c.discount_type === "fixed") return `$${c.discount_value} off`;
  if (c.discount_type === "free_shipping") return "Free shipping";
  return "Deal";
}

export default async function CyberMondayDealsPage() {
  let deals: ArbitrageDeal[] = [];
  let coupons: Coupon[] = [];
  let error = "";
  try {
    const data = await getPublicDeals(200, 0);
    deals = data
      .sort((a, b) => discountPercent(b) - discountPercent(a) || savingsAmount(b) - savingsAmount(a))
      .slice(0, 48);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load deals";
  }
  try {
    const data = await getPublicCoupons(50, 0);
    coupons = data.filter(isActiveCoupon).slice(0, 12);
  } catch {
    // Coupons are a bonus section — page still works without them
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Cyber Monday Deals 2026",
    url: "https://www.bargainhuntrs.com/deals/cyber-monday",
    description: "The best Cyber Monday deals and promo codes, updated live.",
  };

  return (
    <SeoPageLayout
      config={{
        title: "Cyber Monday Deals",
        description:
          "The second wave of deal week: online-only markdowns stacked on weekend clearance. Updated live throughout Cyber Monday.",
        source: "cyber_monday",
        faqs: FAQS,
        relatedLinks: RELATED_LINKS,
        jsonLd: [faqJsonLd, itemListJsonLd],
        introContent: (
          <>
            <p>
              <strong>Cyber Monday</strong> is the online-only second wave of deal week — markdowns
              that stack on top of whatever survived the Black Friday weekend. Our scanners keep
              running: every price drop and clearance item detected across retailers lands here
              automatically, sorted by the steepest discount first.
            </p>
            {coupons.length > 0 && (
              <div className="not-prose mt-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Live promo codes
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Real codes issued through retailer affiliate networks — stack them at checkout on
                  top of the deals below.
                </p>
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {coupons.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
                          {c.code}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {couponLabel(c)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                        {c.title || `${c.retailer} promo`}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                        {c.retailer}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  <Link
                    href="/coupons"
                    className="font-medium text-emerald-600 underline underline-offset-2 hover:text-emerald-500 dark:text-emerald-400"
                  >
                    See all promo codes →
                  </Link>
                </p>
              </div>
            )}
          </>
        ),
        bottomContent: (
          <>
            <h2>Cyber Monday strategy</h2>
            <h3>The second wave is real</h3>
            <p>
              Retailers plan Cyber Monday as a separate event — not just leftover Black Friday
              stock. Online-only markdowns go live Sunday night into Monday morning, and many
              stores deepen weekend discounts to hit sales targets. If a deal survived the weekend,
              Monday's price is often the floor.
            </p>
            <h3>Stack every layer</h3>
            <p>
              The biggest Cyber Monday savings come from stacking: the retailer's markdown plus a
              promo code at checkout plus cashback through a rewards portal. The codes listed above
              come directly from affiliate networks — they're issued by the retailers themselves,
              not scraped from coupon farms.
            </p>
            <h3>Electronics and small appliances lead</h3>
            <p>
              Historically, Cyber Monday hits hardest on electronics, small kitchen appliances, and
              fashion. TVs and laptops that held price through the weekend often drop Monday. Sort
              the deals above by discount — the steepest cuts surface first.
            </p>
            <h3>Price glitches don't wait</h3>
            <p>
              Deal week is when pricing mistakes happen most — mistyped decimals, broken promo
              stacking, clearance items double-marked-down. Our scanners flag these the moment they
              appear. Check back through the day; the best glitches rarely last an hour.
            </p>
          </>
        ),
      }}
      deals={deals}
      error={error}
    />
  );
}
