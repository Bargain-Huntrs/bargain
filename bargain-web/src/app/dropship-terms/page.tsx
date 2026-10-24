import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Dropship Pools – Group Purchase Terms – BargainHuntrs",
  description:
    "Terms for BargainHuntrs Dropship Pools — how group buys work, card authorization holds, all-or-nothing fills, inventory ownership, and resale risk.",
};

const LAST_UPDATED = "October 24, 2026";

export default function DropshipTermsPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dropship Pools — Group Purchase Terms
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-10 text-sm text-zinc-600 dark:text-zinc-400 leading-7">

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">1. What a pool is — and what it is not</h2>
              <p>
                Dropship Pools let BargainHuntrs members (&quot;hunters&quot;) commit to buying a
                share of a bulk inventory order so the group can reach a supplier&apos;s minimum
                order quantity (MOQ) at a wholesale unit price. When you commit, you are agreeing
                to <strong>buy physical inventory for your own resale business</strong>.
              </p>
              <ul className="mt-3 list-disc pl-5 space-y-2">
                <li>
                  A pool is <strong>a group purchase of goods — not an investment</strong>. There
                  are no returns paid to you by BargainHuntrs, no profit-sharing, no pooled funds,
                  and no security being offered. Any profit comes solely from your own resale of
                  the units you buy.
                </li>
                <li>
                  BargainHuntrs coordinates the group order with the supplier. Units you purchase
                  are <strong>yours</strong> — title and risk pass to you as described below.
                </li>
                <li>
                  These terms supplement our{" "}
                  <Link href="/terms" className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4">
                    Terms of Service
                  </Link>
                  , which govern your account and include limitation-of-liability and
                  dispute-resolution provisions.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">2. How committing works</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Each pool lists the product, unit cost at the group rate, the MOQ required to fill,
                  a closing deadline, the fulfillment channel, and estimated freight/delivery timing.
                </li>
                <li>
                  You commit a number of units (subject to a per-hunter cap).{" "}
                  <strong>Commits are locked once placed</strong> — they cannot be edited; contact
                  support immediately if you committed in error.
                </li>
                <li>
                  Pools are <strong>all-or-nothing</strong>: if the MOQ is not reached by the
                  deadline, the pool expires, all reservations cancel automatically, and{" "}
                  <strong>you are charged nothing</strong>.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">3. Payment authorization holds</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  If you have a card on file, committing places a{" "}
                  <strong>pre-authorization hold</strong> (not a charge) for your committed
                  amount through Stripe.
                </li>
                <li>
                  <strong>You are charged only if the pool fills.</strong> If the pool expires or
                  is cancelled, the hold is released. Your bank controls how quickly released
                  holds disappear from your statement (typically a few business days).
                </li>
                <li>
                  Card authorization holds expire after approximately 7 days. For longer-running
                  pools, we may need to re-authorize before fill — you&apos;ll be notified if your
                  hold lapses.
                </li>
                <li>
                  If you commit without a card on file, your reservation is{" "}
                  <strong>unsecured</strong>: you must add a card before the pool fills or your
                  commit may be cancelled when the pool reaches MOQ.
                </li>
                <li>
                  The unit cost shown at commit is the total price for your units. Any platform or
                  processing fee will be itemized before you confirm.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">4. Fill, procurement &amp; fulfillment</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  When a pool fills, we place the group order with the supplier at the posted
                  group rate and your card is charged for your committed units.
                </li>
                <li>
                  Freight mode, origin warehouse, and delivery windows shown on the deal sheet are{" "}
                  <strong>estimates</strong> — supplier delays, customs, and carrier issues can
                  change timing. We will post updates on the pool when material changes occur.
                </li>
                <li>
                  Fulfillment runs through the channel posted on the pool (for example, your own
                  Amazon FBA, Walmart WFS, or your own store). You are responsible for having the
                  required marketplace accounts, API access, and compliance status on that
                  channel.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">5. Risk — read this before committing</h2>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <ul className="list-disc pl-5 space-y-2 text-amber-800 dark:text-amber-200">
                  <li>
                    <strong>Resale is not guaranteed.</strong> Target sell prices, margins, and
                    ROI figures on deal sheets are estimates. Market prices move; your units may
                    sell slowly, below estimate, or not at all.
                  </li>
                  <li>
                    <strong>You are buying inventory, not a return.</strong> You bear the full
                    market risk of resale, including price drops, marketplace fees, returns,
                    storage costs, and account suspensions on your sales channel.
                  </li>
                  <li>
                    Nothing on a deal sheet is financial, investment, tax, or legal advice. Do not
                    commit money you cannot afford to have tied up in inventory.
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">6. Cancellations &amp; refunds</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Unfilled pools:</strong> nothing is ever charged — holds release
                  automatically on expiry or cancellation.
                </li>
                <li>
                  <strong>After fill and charge:</strong> the purchase is final. Because the group
                  rate depends on aggregate volume, individual units cannot be cancelled or
                  returned to the pool.
                </li>
                <li>
                  <strong>Supplier failure:</strong> if the supplier fails to deliver your units
                  (non-delivery, material shortfall, or supplier cancellation), we will refund the
                  charged amount for the affected units to the original payment method.
                </li>
                <li>
                  <strong>Defects and discrepancies:</strong> report defective, damaged, or
                  materially not-as-described units promptly; remedies follow the supplier&apos;s
                  warranty terms, which we will help administer.
                </li>
                <li>
                  <strong>Chargebacks:</strong> filing a chargeback for a successfully filled and
                  delivered order is a violation of these terms and may result in account
                  suspension.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">7. Your responsibilities</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Keep a valid payment method on file and fund committed units;</li>
                <li>Maintain the marketplace/store accounts needed for your chosen channel and comply with their policies;</li>
                <li>Comply with all laws applicable to reselling the products (safety, labeling, taxes);</li>
                <li>Do not use pools to launder funds, defraud the group, or manipulate the platform.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">8. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, BargainHuntrs is not liable for resale
                outcomes, market-price changes, supplier delays, marketplace actions (including
                account or listing suspensions), or indirect/consequential damages. Our aggregate
                liability for pool claims is limited to the amount you paid us for the units at
                issue, as further provided in the{" "}
                <Link href="/terms" className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4">
                  Terms of Service
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-3">9. Changes &amp; contact</h2>
              <p>
                The current version of these terms is always posted at{" "}
                <Link href="/dropship-terms" className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4">
                  bargainhuntrs.com/dropship-terms
                </Link>
                . Questions:{" "}
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
