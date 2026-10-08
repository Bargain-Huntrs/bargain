"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { setupPoolPaymentMethod } from "@/lib/api";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function SetupForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (error) setErr(error.message || "Card setup failed — try another card");
    else onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {err && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!stripe || busy}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save card"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Modal: save a card for dropship-pool auth-holds. Nothing is charged at
 *  setup — the hold only captures if the pool fills. */
export default function PoolPaymentSetup({
  token,
  onComplete,
  onClose,
}: {
  token: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [clientSecret, setClientSecret] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const done = useRef(false);

  useEffect(() => {
    setupPoolPaymentMethod(token)
      .then((r) => setClientSecret(r.client_secret))
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Couldn't start card setup"));
  }, [token]);

  const handleDone = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onComplete();
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add payment method"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Add a card for pool holds
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          No charge now. When you commit to a pool we place a hold that captures
          only if the pool fills — if it expires, the hold releases automatically.
        </p>
        {!stripePromise ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400">
            Card payments aren&apos;t configured on this environment yet — you can
            still commit to pools; the hold just won&apos;t be secured until a card
            is added.
          </div>
        ) : loadErr ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {loadErr}
          </div>
        ) : !clientSecret ? (
          <div className="py-8 text-center text-sm text-zinc-500">Loading secure form…</div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <SetupForm onDone={handleDone} onCancel={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
