"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { plans, type Plan } from "./plans";
import { authService } from "@/lib/authService";
import { trackBeginCheckout } from "@/lib/ads";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

async function startCheckout(planId: Plan["planId"]): Promise<{ url?: string | null; free?: boolean }> {
  const token = authService.getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1/subscriptions/create-checkout-session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan_id: planId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail || "Failed to start checkout");
  }
  return res.json();
}

export function PricingPlans() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleSelect(plan: Plan) {
    setError("");
    // Free plan never needs Stripe — just sign up / activate.
    if (plan.planId === "free") {
      router.push("/signup");
      return;
    }

    // Paid plans require an authenticated user so we can attach the
    // Stripe customer to their account.
    if (!authService.isAuthenticated()) {
      router.push(`/login?next=/pricing`);
      return;
    }

    setLoadingPlan(plan.name);
    try {
      const result = await startCheckout(plan.planId);
      if (result.free) {
        router.push("/dashboard");
      } else if (result.url) {
        trackBeginCheckout({ method: "stripe", plan: plan.planId });
        // Redirect to Stripe Checkout.
        window.location.href = result.url;
      } else {
        router.push("/billing");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              plan.highlight
                ? "border-zinc-900 bg-zinc-900 dark:border-zinc-50 dark:bg-zinc-50"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap ${
                    plan.highlight ? "bg-emerald-500" : "bg-zinc-700"
                  }`}
                >
                  {plan.badge}
                </span>
              </div>
            )}

            <h2
              className={`text-lg font-bold ${
                plan.highlight ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {plan.name}
            </h2>

            <p
              className={`mt-0.5 text-xs font-medium ${
                plan.highlight ? "text-emerald-400 dark:text-emerald-600" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {plan.tagline}
            </p>

            <div className="mt-3 flex items-baseline gap-0.5">
              <span
                className={`text-4xl font-bold tabular-nums ${
                  plan.highlight ? "text-white dark:text-zinc-900" : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {plan.price}
              </span>
              <span
                className={`text-xs ${
                  plan.highlight ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500"
                }`}
              >
                {plan.period}
              </span>
            </div>

            <p
              className={`mt-3 text-xs leading-relaxed ${
                plan.highlight ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {plan.description}
            </p>

            <button
              type="button"
              onClick={() => handleSelect(plan)}
              disabled={loadingPlan === plan.name}
              className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-50 ${
                plan.highlight
                  ? "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              }`}
            >
              {loadingPlan === plan.name ? "Redirecting…" : plan.cta}
            </button>

            <ul className="mt-6 space-y-2.5">
              {plan.features.map((feat) => (
                <li key={feat.label} className="flex items-center justify-between text-xs gap-2">
                  <span
                    className={
                      plan.highlight ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-500 dark:text-zinc-400"
                    }
                  >
                    {feat.label}
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      feat.value === "—"
                        ? "text-zinc-300 dark:text-zinc-700"
                        : feat.value === "✓"
                        ? "text-emerald-500"
                        : plan.highlight
                        ? "text-white dark:text-zinc-900"
                        : "text-zinc-900 dark:text-zinc-50"
                    }`}
                  >
                    {feat.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-6 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
        All prices in USD. Monthly billing. 7-day money-back guarantee on first paid month.
      </p>
    </section>
  );
}

export { plans };
