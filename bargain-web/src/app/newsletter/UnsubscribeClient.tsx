"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unsubscribed" }
  | { kind: "not_subscribed" }
  | { kind: "error"; msg: string };

export default function UnsubscribeClient() {
  const params = useSearchParams();
  const emailParam = (params.get("email") || "").trim();
  const [email, setEmail] = useState(emailParam);
  const [state, setState] = useState<State>(
    emailParam ? { kind: "idle" } : { kind: "error", msg: "" }
  );

  async function doUnsubscribe(target: string) {
    if (!target.includes("@")) {
      setState({ kind: "error", msg: "Enter a valid email address." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const resp = await fetch(`${API_URL}/api/v1/newsletter/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        setState(
          data.status === "unsubscribed"
            ? { kind: "unsubscribed" }
            : { kind: "not_subscribed" }
        );
      } else {
        setState({ kind: "error", msg: data.detail || "Something went wrong." });
      }
    } catch {
      setState({ kind: "error", msg: "Network error — please try again." });
    }
  }

  // Auto-fire when arriving via the email unsubscribe link (?email=...).
  useEffect(() => {
    if (emailParam) {
      void doUnsubscribe(emailParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailParam]);

  if (state.kind === "unsubscribed") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-8 py-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-xl text-white">
          ✓
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">You&apos;re unsubscribed</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {emailParam || email} has been removed from the deal digest. You won&apos;t get
          any more BargainHuntrs emails.
        </p>
        <p className="mt-3 text-xs text-zinc-400">
          Changed your mind? Re-subscribe any time from the homepage popup.
        </p>
      </div>
    );
  }

  if (state.kind === "not_subscribed") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 px-8 py-10 text-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Not subscribed</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {emailParam || email} isn&apos;t on the deal-digest list — nothing to remove.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 px-8 py-10">
      {state.kind === "loading" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
          Unsubscribing {emailParam || email}…
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void doUnsubscribe(email);
          }}
          className="space-y-3"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
            Enter the email you want to stop the deal digest for.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            required
          />
          {state.kind === "error" && state.msg && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{state.msg}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Unsubscribe
          </button>
        </form>
      )}
    </div>
  );
}
