"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authService } from "@/lib/authService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

type Phase = "loading" | "signed-out" | "ready" | "deleting" | "done" | "error";

/**
 * Self-service account deletion — Google Play requires a web-accessible
 * deletion path alongside the in-app one. Signed-in visitors delete
 * immediately via DELETE /api/v1/auth/me (the same anonymize endpoint the
 * app calls); everyone else gets sign-in + email-request instructions.
 */
export default function DeleteAccountClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [confirmed, setConfirmed] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = authService.getUser();
    if (authService.isAuthenticated()) {
      setEmail(user?.email ?? null);
      setPhase("ready");
    } else {
      setPhase("signed-out");
    }
  }, []);

  async function handleDelete() {
    setError("");
    setPhase("deleting");
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authService.getToken()}`,
        },
      });
      if (!res.ok) {
        if (res.status === 401) {
          authService.logout();
          setPhase("signed-out");
          setError("Your session expired — sign in again to delete your account.");
          return;
        }
        throw new Error(`Request failed (${res.status})`);
      }
      authService.logout();
      setPhase("done");
    } catch (e) {
      setPhase("ready");
      setError(
        e instanceof TypeError
          ? "Network error — check your connection and try again."
          : (e as Error).message || "Something went wrong. Please try again or email privacy@bargainhuntrs.com.",
      );
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {phase === "loading" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Checking your sign-in…</p>
      )}

      {phase === "signed-out" && (
        <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 leading-7">
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
          <p>
            To delete your BargainHuntrs account,{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
            >
              sign in
            </Link>{" "}
            first, then return to this page — a delete button will appear here.
            The same account you use in the mobile app works here.
          </p>
          <p>
            Prefer email? Send a deletion request from your account address to{" "}
            <a
              href="mailto:privacy@bargainhuntrs.com"
              className="font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
            >
              privacy@bargainhuntrs.com
            </a>{" "}
            and we&apos;ll confirm once it&apos;s done.
          </p>
        </div>
      )}

      {(phase === "ready" || phase === "deleting") && (
        <div className="space-y-5 text-sm text-zinc-600 dark:text-zinc-400 leading-7">
          {email && (
            <p>
              Signed in as{" "}
              <strong className="text-zinc-900 dark:text-zinc-50">{email}</strong>
            </p>
          )}
          <p>This permanently deletes your account. We will:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Remove your sign-in, profile, and personal details;</li>
            <li>Delete your watchlist, saved deals, alerts, and lists;</li>
            <li>Cancel any active subscription so you&apos;re never billed again;</li>
            <li>Stop all email, SMS, and push notifications.</li>
          </ul>
          <p>
            Community posts you made stay visible, credited to &quot;Deleted user&quot;,
            and anonymized payment records are kept where the law requires. This
            cannot be undone — you can always create a new account later.
          </p>
          {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300 accent-red-600"
            />
            <span className="text-zinc-700 dark:text-zinc-300">
              I understand this permanently deletes my account and personal data.
            </span>
          </label>
          <button
            type="button"
            disabled={!confirmed || phase === "deleting"}
            onClick={handleDelete}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "deleting" ? "Deleting…" : "Permanently delete my account"}
          </button>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 leading-7">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Your account has been deleted.
          </p>
          <p>
            Your sign-in, profile, watchlist, alerts, and preferences were removed
            and any subscription was cancelled. You&apos;ve been signed out of this
            device.
          </p>
          <Link
            href="/"
            className="inline-block font-medium text-zinc-900 dark:text-zinc-50 underline underline-offset-4"
          >
            Return to BargainHuntrs
          </Link>
        </div>
      )}
    </div>
  );
}
