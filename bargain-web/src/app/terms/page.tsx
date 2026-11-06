import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service – BargainHuntrs",
  description: "The terms that govern your use of the BargainHuntrs platform.",
  alternates: { canonical: "/terms" },
};

const LAST_UPDATED = "July 16, 2026";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-sm text-zinc-600 dark:text-zinc-400 leading-7">

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">1. Acceptance of terms</h2>
              <p>
                By creating an account or using BargainHuntrs (&quot;the Service&quot;), you agree to these
                Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.
                These Terms form a binding contract between you and BargainHuntrs, Inc.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">2. Description of the Service</h2>
              <p>
                BargainHuntrs is a software platform that monitors publicly available retail pricing
                data, surfaces arbitrage opportunities and pricing anomalies, and delivers alerts to
                subscribers. The Service is an informational tool only. We do not guarantee that any
                deal, price, or inventory information is accurate, current, or available at time of
                purchase.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">3. Eligibility</h2>
              <p>
                You must be at least 18 years old and capable of entering a binding contract to use
                the Service. By using BargainHuntrs, you represent that you meet these requirements.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">4. Accounts</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                <li>You are responsible for all activity that occurs under your account.</li>
                <li>You must notify us immediately of any unauthorized use of your account.</li>
                <li>One account per person. We reserve the right to suspend duplicate accounts.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">5. Subscriptions and billing</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Paid plans are billed monthly in advance. By subscribing, you authorize us to charge
                  your payment method on a recurring basis until you cancel.
                </li>
                <li>
                  Upgrades take effect immediately and are prorated. Downgrades take effect at the end
                  of the current billing period.
                </li>
                <li>
                  We offer a 7-day money-back guarantee on your first paid month. To request a refund,
                  contact{" "}
                  <a
                    href="mailto:hello@bargainhuntrs.com"
                    className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                  >
                    hello@bargainhuntrs.com
                  </a>{" "}
                  within 7 days of your first charge.
                </li>
                <li>
                  We reserve the right to change pricing with 30 days&apos; notice. You will be notified
                  via email before any price change takes effect.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">6. Acceptable use</h2>
              <p className="mb-3">You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Use the Service in any way that violates applicable laws or regulations, including
                  consumer protection and anti-fraud laws.
                </li>
                <li>
                  Scrape, crawl, or programmatically extract data from the Service beyond normal use
                  of our documented API (if applicable to your plan).
                </li>
                <li>
                  Attempt to reverse engineer, decompile, or otherwise extract the source code of the
                  Service.
                </li>
                <li>
                  Share your account credentials with others or resell access to the Service without
                  written permission.
                </li>
                <li>
                  Use the Service to harass, defame, or harm any individual or entity.
                </li>
                <li>
                  Circumvent any rate limits, access controls, or security measures.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">7. No purchase recommendations</h2>
              <p>
                BargainHuntrs provides pricing data and analytical information for informational
                purposes only. Nothing in the Service constitutes financial, investment, or purchasing
                advice. You are solely responsible for any purchase or resale decisions you make based
                on information from the Service. We are not liable for any loss, loss of profit, or
                unsold inventory resulting from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">8. Third-party retailers</h2>
              <p>
                BargainHuntrs is not affiliated with, endorsed by, or in partnership with Amazon, eBay,
                Walmart, Target, Best Buy, or any other retailer whose data we monitor. Retailer prices,
                availability, and policies change constantly. We make no warranty that any price or
                inventory data displayed in the Service is accurate at the time you act on it.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">9. Intellectual property</h2>
              <p>
                All content, design, algorithms, and software comprising the Service are owned by
                BargainHuntrs, Inc. or its licensors. You may not copy, reproduce, distribute, or
                create derivative works from any part of the Service without our express written
                permission.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">10. Termination</h2>
              <p>
                You may cancel your account at any time from your account settings or by contacting
                support. We reserve the right to suspend or terminate accounts that violate these
                Terms, with or without notice. Upon termination, your right to use the Service ends
                immediately.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">11. Disclaimers</h2>
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
                INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
                PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
                UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">12. Limitation of liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, BARGAINHUNTRS, INC. SHALL NOT BE LIABLE FOR
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS
                OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE
                SERVICE. OUR TOTAL LIABILITY TO YOU SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE
                12 MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">13. Governing law</h2>
              <p>
                These Terms are governed by the laws of the State of Delaware, United States, without
                regard to conflict of law principles. Any disputes shall be resolved in the courts of
                Delaware.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">14. Changes to these Terms</h2>
              <p>
                We may update these Terms at any time. We will notify you of material changes via
                email at least 7 days before they take effect. Continued use of the Service after the
                effective date constitutes acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">15. Contact</h2>
              <p>
                Questions about these Terms?{" "}
                <a
                  href="mailto:hello@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  hello@bargainhuntrs.com
                </a>
              </p>
            </section>

          </div>

          <div className="mt-12 border-t border-zinc-200 dark:border-zinc-800 pt-6 flex gap-4 text-sm">
            <Link href="/privacy" className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
