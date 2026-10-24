import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy – BargainHuntrs",
  description: "How BargainHuntrs collects, uses, and protects your personal information.",
};

const LAST_UPDATED = "October 24, 2026";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-sm text-zinc-600 dark:text-zinc-400 leading-7">

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">1. Who we are</h2>
              <p>
                BargainHuntrs (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is an arbitrage intelligence platform
                that helps resellers find profitable price discrepancies across retail channels. Our
                platform is operated by BargainHuntrs, Inc. You can reach us at{" "}
                <a
                  href="mailto:hello@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  hello@bargainhuntrs.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">2. Information we collect</h2>
              <p className="mb-3">We collect only what we need to provide the service:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Account information:</strong>{" "}
                  Your name and email address when you sign up.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Watchlist data:</strong>{" "}
                  Product URLs, target prices, and item names you add to your watchlist.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Usage data:</strong>{" "}
                  Pages visited, features used, and actions taken — used to improve the product.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Payment information:</strong>{" "}
                  Processed by our payment provider (Stripe). We never store full card numbers on our servers.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Communications:</strong>{" "}
                  Messages you send us via email or the contact form.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">3. How we use your information</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>To create and manage your account.</li>
                <li>To provide watchlist monitoring, price alerts, and arbitrage intelligence features.</li>
                <li>To send you alerts you explicitly opted into (email, SMS).</li>
                <li>To process payments and manage subscriptions.</li>
                <li>To respond to support requests.</li>
                <li>To improve the platform based on aggregate usage patterns.</li>
                <li>To send product updates — you can unsubscribe at any time.</li>
              </ul>
              <p className="mt-3">
                We do <strong className="text-zinc-700 dark:text-zinc-300">not</strong> sell your personal
                information to third parties. Ever.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">4. Cookies and tracking</h2>
              <p className="mb-3">
                We use essential cookies to keep you logged in and maintain your session. In
                addition, the following tracking technologies may run on our site:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Analytics:</strong>{" "}
                  Google Analytics 4 (gtag.js) may be used to understand aggregate traffic
                  patterns. Google processes this data under its own privacy policy.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Affiliate attribution:</strong>{" "}
                  Deal and retailer links on this site are tracked so partner networks (including
                  Impact, Awin, Amazon Associates, and similar programs) can attribute clicks and
                  purchases to BargainHuntrs. These networks may set or read cookies and use
                  tracking scripts to credit commissions. See our{" "}
                  <a href="/disclosure" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">Affiliate Disclosure</a>.
                </li>
              </ul>
              <p className="mt-3">
                You can control cookies through your browser settings; blocking essential cookies
                may prevent login and other core features from working.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">5. Data sharing</h2>
              <p className="mb-3">
                We share your data only with the following categories of service providers, and only
                as necessary to operate the platform:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Hosting / infrastructure:</strong>{" "}
                  Cloud providers that store our database and serve the application.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Payment processing:</strong>{" "}
                  Stripe processes all payment transactions under their own privacy policy.
                </li>
                <li>
                  <strong className="text-zinc-700 dark:text-zinc-300">Email delivery:</strong>{" "}
                  A transactional email provider to send you alerts and account emails.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">6. Data retention</h2>
              <p>
                We retain your account data for as long as your account is active. If you delete your
                account, we remove your personal data within 30 days, except where retention is
                required by law (e.g. billing records, which are kept for 7 years per standard
                accounting requirements).
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">7. Your rights</h2>
              <p className="mb-3">You have the right to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Access the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and associated data.</li>
                <li>Export your watchlist data in a machine-readable format.</li>
                <li>Opt out of marketing communications at any time.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email{" "}
                <a
                  href="mailto:hello@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  hello@bargainhuntrs.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">8. Security</h2>
              <p>
                We use industry-standard measures to protect your data: HTTPS for all connections,
                bcrypt hashing for passwords, and strict access controls on our infrastructure.
                No method of transmission over the internet is 100% secure, but we take reasonable
                precautions to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">9. Children</h2>
              <p>
                BargainHuntrs is not directed to children under 13. We do not knowingly collect
                personal information from children. If you believe a child has provided us personal
                data, contact us and we will delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">10. Changes to this policy</h2>
              <p>
                We may update this policy from time to time. We&apos;ll notify you of material changes
                via email or an in-app notice at least 7 days before they take effect. Continued use
                of the platform after the effective date constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">11. Contact</h2>
              <p>
                Questions about this policy?{" "}
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
            <Link href="/terms" className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4">
              Terms of Service
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
