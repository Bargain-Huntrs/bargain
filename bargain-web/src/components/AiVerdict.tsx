"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getAiDealVerdict, getAiStatus, type AiDealVerdict } from "@/lib/api";

const VERDICT_STYLES: Record<string, { label: string; classes: string }> = {
  buy: {
    label: "BUY",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  wait: {
    label: "WAIT",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  monitor: {
    label: "MONITOR",
    classes: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  skip: {
    label: "SKIP",
    classes: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};

/**
 * "AI Verdict" button + expandable verdict card for the deal detail page.
 *
 * Calls GET /api/v1/ai/deal-verdict/{id} (cached server-side). Hidden when
 * the deployment has no AI configured; prompts sign-in when logged out since
 * the endpoint requires auth.
 */
export default function AiVerdict({ dealId }: { dealId: string }) {
  const router = useRouter();
  const { idToken, loading: authLoading } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [verdict, setVerdict] = useState<AiDealVerdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiStatus()
      .then((s) => setAvailable(s.configured))
      .catch(() => setAvailable(false));
  }, []);

  if (available !== true) return null;

  const load = async () => {
    if (verdict || loading) return;
    if (!idToken) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setVerdict(await getAiDealVerdict(idToken, dealId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI verdict unavailable right now"
      );
    } finally {
      setLoading(false);
    }
  };

  const style = verdict ? VERDICT_STYLES[verdict.verdict] ?? VERDICT_STYLES.monitor : null;

  return (
    <div className="mt-4">
      {!verdict ? (
        <button
          onClick={load}
          disabled={loading || authLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950"
        >
          {loading ? "Analyzing…" : "✨ Get AI Verdict"}
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/60">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${style!.classes}`}>
              {style!.label}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {verdict.confidence}% confidence
              {verdict.source === "rules" && " · quick analysis"}
            </span>
          </div>

          <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
            {verdict.summary}
          </p>

          {verdict.fair_price && (
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold">Fair price: </span>
              {verdict.fair_price}
            </p>
          )}
          {verdict.resale_margin && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold">Resale margin: </span>
              {verdict.resale_margin}
            </p>
          )}

          {verdict.risks && verdict.risks.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {verdict.risks.map((r, i) => (
                <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠ {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && !verdict && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
