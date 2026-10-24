import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AffiliateDisclosure from "@/components/AffiliateDisclosure";

export const metadata: Metadata = {
  title: "Mobile App Privacy Policy – BargainHuntrs",
  description:
    "Privacy policy for the BargainHuntrs installable app and mobile experience — what we collect, push notifications, affiliate click tracking, and how to delete your data.",
};

const LAST_UPDATED = "October 24, 2026";

export default function AppPrivacyPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Mobile App Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-sm text-zinc-600 dark:text-zinc-400 leading-7">

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">1. Scope</h2>
              <p>
                This Mobile App Privacy Policy applies to the BargainHuntrs installable web app
                (PWA) and any BargainHuntrs mobile application (collectively, the
                &quot;App&quot;), operated by BargainHuntrs, Inc. (&quot;we&quot;, &quot;us&quot;,
                &quot;our&quot;). It supplements our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                , which governs all BargainHuntrs services including the website and API.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">2. Information the App collects</h2>
              <p>
                <strong className="text-zinc-800 dark:text-zinc-200">Account information.</strong>{" "}
                Name, email address, phone number, and sign-in credentials (including
                passkey/WebAuthn credentials and Firebase authentication tokens).
              </p>
              <p className="mt-3">
                <strong className="text-zinc-800 dark:text-zinc-200">Deal activity.</strong>{" "}
                Deals you view, save, watch, or click; pools you join or commit units to; coupon
                codes you view, copy, or submit; searches and filters you use; and your alert
                preferences.
              </p>
              <p className="mt-3">
                <strong className="text-zinc-800 dark:text-zinc-200">Push-notification data.</strong>{" "}
                If you enable notifications, we store a Firebase Cloud Messaging device token to
                deliver deal alerts you subscribe to. You can disable notifications in the App or
                your browser/OS settings at any time.
              </p>
              <p className="mt-3">
                <strong className="text-zinc-800 dark:text-zinc-200">Device &amp; usage data.</strong>{" "}
                Device model, OS and browser version, app version, IP address, pages and features
                used, and crash diagnostics.
              </p>
              <p className="mt-3">
                <strong className="text-zinc-800 dark:text-zinc-200">Payment information.</strong>{" "}
                Subscriptions and card authorization holds (for example, Dropship pool commits) are
                processed by Stripe. We receive payment status and the last four digits of your
                card — we never see or store full card numbers.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">3. How the App uses information</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide deal feeds, arbitrage analysis, coupons, pools, and alerts;</li>
                <li>Attribute affiliate clicks so partner networks can credit commissions;</li>
                <li>Send push notifications and transactional SMS/email (alerts, verification codes);</li>
                <li>Process subscriptions and pool commitments via Stripe;</li>
                <li>Secure your account, prevent fraud and abuse;</li>
                <li>Analyze aggregated usage to improve the App.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">4. Affiliate tracking</h2>
              <p>
                When you tap a deal or retailer link in the App, the click is tracked so partner
                affiliate networks can attribute the referral to BargainHuntrs. Those networks may
                set or read cookies and use tracking scripts on the retailer site. We may earn a
                commission at no extra cost to you.
              </p>
              <div className="mt-3">
                <AffiliateDisclosure />
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">5. Sharing</h2>
              <p>
                We share app data only as needed to provide the service: affiliate networks (click
                attribution), Stripe (payments and authorization holds), Firebase/Google (sign-in
                and push delivery), Telnyx (transactional SMS), email delivery providers, and
                hosting/analytics infrastructure — plus law enforcement or regulators where
                required by law. We do <strong>not</strong> sell your personal information.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">6. Retention &amp; deletion</h2>
              <p>
                We keep your information while your account is active and as needed for legal and
                record-keeping purposes. To delete your account and personal data, email{" "}
                <a
                  href="mailto:privacy@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  privacy@bargainhuntrs.com
                </a>{" "}
                from your account address. Uninstalling the App does not delete your account — use
                a deletion request.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">7. Your privacy rights</h2>
              <p>
                Depending on your state (including California under the CCPA/CPRA), you may have
                rights to access, correct, delete, or port your personal information, and to opt
                out of certain sharing. Submit requests to{" "}
                <a
                  href="mailto:privacy@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  privacy@bargainhuntrs.com
                </a>
                . Full details are in our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">8. Children &amp; security</h2>
              <p>
                The App is not directed to children under 13, and we do not knowingly collect their
                personal information. We use encryption in transit, access controls, and secure
                hosting to protect your data.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">9. Changes &amp; contact</h2>
              <p>
                The current version of this policy is always posted at{" "}
                <Link
                  href="/privacy-app"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  bargainhuntrs.com/privacy-app
                </Link>
                . Questions:{" "}
                <a
                  href="mailto:privacy@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  privacy@bargainhuntrs.com
                </a>{" "}
                or{" "}
                <a
                  href="mailto:hello@bargainhuntrs.com"
                  className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
                >
                  hello@bargainhuntrs.com
                </a>
                .
              </p>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
