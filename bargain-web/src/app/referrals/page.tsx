"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getReferralStats, getReferralLeaderboard, type ReferralLeaderboardEntry } from "@/lib/api";

const TIER_EMOJI: Record<string, string> = {
  hunter: "🎯",
  elite: "⚡",
  goat: "👑",
};

const TIER_COLOR: Record<string, string> = {
  hunter: "text-zinc-600 dark:text-zinc-400",
  elite: "text-purple-600 dark:text-purple-400",
  goat: "text-amber-600 dark:text-amber-400",
};

export default function ReferralsPage() {
  const router = useRouter();
  const { loading, idToken } = useAuth();
  const [referralLink, setReferralLink] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralCount, setReferralCount] = useState<number>(0);
  const [auraEarned, setAuraEarned] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<ReferralLeaderboardEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);

  const loadData = useCallback(async () => {
    try {
      if (idToken) {
        const [stats, leaders] = await Promise.all([
          getReferralStats(idToken),
          getReferralLeaderboard(50),
        ]);
        setReferralCode(stats.referral_code);
        setReferralLink(stats.referral_link);
        setReferralCount(stats.referral_count);
        setAuraEarned(stats.total_aura_earned);
        setLeaderboard(leaders);
      } else {
        setLeaderboard(await getReferralLeaderboard(50));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load referral data");
    } finally {
      setFetching(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, loadData]);

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link");
    }
  }

  function shareOnX() {
    const text = encodeURIComponent(
      "Join me on BargainHuntrs and start finding arbitrage deals. Use my referral link:"
    );
    const url = encodeURIComponent(referralLink || "https://www.bargainhuntrs.com");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
  }

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">Invite Friends</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Invite friends, earn Aura points, and climb the leaderboard.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Referral Link Card */}
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Your referral link</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Share this link with friends. You&apos;ll earn <strong>100 Aura</strong> when they sign up, and they&apos;ll get <strong>50 Aura</strong>.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!idToken ? (
              <button
                onClick={() => router.push("/login")}
                className="flex-1 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700"
              >
                Sign in to get your referral link
              </button>
            ) : (
              <>
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              onClick={copyLink}
              className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={shareOnX}
              className="rounded-xl border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              Share on X
            </button>
              </>
            )}
          </div>

          {idToken && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Referral code</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{referralCode}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Friends joined</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{referralCount}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Aura earned</p>
              <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-50">{auraEarned}</p>
            </div>
          </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Referrers</h2>
            <Link
              href="/community/leaderboard"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Aura leaderboard →
            </Link>
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No referrals yet. Be the first to invite a friend!</p>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {leaderboard.map((entry) => (
                <div
                  key={entry.user_id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
                      {entry.rank}
                    </span>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{entry.name}</p>
                      <p className={`text-xs ${TIER_COLOR[entry.aura_tier] || TIER_COLOR.hunter}`}>
                        {TIER_EMOJI[entry.aura_tier] || "🎯"} {entry.aura_tier.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900 dark:text-zinc-50">{entry.referral_count}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">referrals</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
