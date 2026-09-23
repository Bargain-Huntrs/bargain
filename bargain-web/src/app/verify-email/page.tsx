"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authService } from "@/lib/authService";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("err");
      setMessage("No verification token found in this link.");
      return;
    }
    authService.verifyEmail(token).then((r) => {
      setState(r.success ? "ok" : "err");
      if (!r.success) setMessage(r.error || "Verification failed");
    });
  }, [token]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center">
      {state === "loading" && (
        <>
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Verifying your email…</h1>
        </>
      )}
      {state === "ok" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">✓</div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Email verified</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Your account is fully active. Happy hunting.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Go to Hunter HQ
          </Link>
        </>
      )}
      {state === "err" && (
        <>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/40">✕</div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Verification failed</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50"
          >
            Go to Hunter HQ to resend
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <Suspense fallback={<div className="text-center text-zinc-500">Loading…</div>}>
            <VerifyContent />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}
