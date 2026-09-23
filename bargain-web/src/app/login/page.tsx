"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/authService";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PasskeyButton from "@/components/PasskeyButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await authService.login({ email, password });
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Logo mark */}
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-sm font-black text-white dark:bg-zinc-50 dark:text-zinc-900">
                BH
              </span>
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {/* Auth mode toggle */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
              <span className="rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50">
                Sign in
              </span>
              <Link
                href="/signup"
                className="rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Get started
              </Link>
            </div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sign in to your BargainHuntrs account
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit} suppressHydrationWarning>
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Password
                  </label>
                  <a href="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Passkey divider + button */}
            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  or
                </span>
              </div>
            </div>

            <div className="mt-4">
              <PasskeyButton
                mode="login"
                email={email}
                onError={setError}
                onSuccess={() => router.push("/dashboard")}
              />
              {!email && (
                <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-600">
                  Enter your email above to sign in with a passkey.
                </p>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
              >
                Get started free
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
            By signing in you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-50">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-50">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
