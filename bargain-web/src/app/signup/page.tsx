"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/authService";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PasskeyButton from "@/components/PasskeyButton";
import PhoneVerify from "@/components/PhoneVerify";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      setReferralCode(ref);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setErrorStatus(null);
    setLoading(true);
    const result = await authService.register({
      email, password, referralCode,
      firstName, lastName,
      phoneNumber: phone,
      phoneIdToken: phoneToken ?? undefined,
    });
    if (result.success) {
      setRegistered(true);
    } else {
      setError(result.error || "Signup failed");
      setErrorStatus(result.status ?? null);
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
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Sign in
              </Link>
              <span className="rounded-lg bg-white px-3 py-2 text-center text-sm font-semibold text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50">
                Get started
              </span>
            </div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Create your account
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Start finding arbitrage deals today
              </p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
                {errorStatus === 409 && (
                  <span className="ml-1">
                    <Link href="/login" className="underline font-medium">
                      Log in instead
                    </Link>
                  </span>
                )}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit} suppressHydrationWarning>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                  >
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Mobile number <span className="text-zinc-400">(for SMS deal alerts)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="+15551234567"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneToken(null); }}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                />
                {phoneToken ? (
                  <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">✓ Phone verified via SMS</p>
                ) : (
                  phone && (
                    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                      <PhoneVerify
                        phone={phone}
                        compact
                        onVerified={setPhoneToken}
                      />
                    </div>
                  )
                )}
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-600">
                  Include country code — e.g. +1 for US. Verify via SMS for instant glitch alerts.
                </p>
              </div>

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
                <label
                  htmlFor="password"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-600"
                />
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-600">
                  8+ characters with upper & lowercase letters and a number.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
              <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
                We'll email you a verification link after signup.
              </p>
            </form>

            {/* Passkey option — only available after the account is created. */}
            {registered ? (
              <div className="mt-6">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      Secure your account
                    </span>
                  </div>
                </div>
                <PasskeyButton
                  mode="register"
                  label="Add a passkey for faster sign-in"
                  onError={setError}
                  onSuccess={() => router.push("/dashboard")}
                />
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="mt-3 w-full text-center text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Skip for now
                </button>
              </div>
            ) : (
              <div className="mt-6">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                      or
                    </span>
                  </div>
                </div>
                <PasskeyButton
                  mode="login"
                  email={email}
                  label="Sign in with a passkey"
                  onError={setError}
                  onSuccess={() => router.push("/dashboard")}
                />
                {!email && (
                  <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-600">
                    Already have a passkey? Enter your email to sign in.
                  </p>
                )}
              </div>
            )}

            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
            By signing up you agree to our{" "}
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
