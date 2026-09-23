"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getLeaderboard, getPublicLeaderboard } from "@/lib/api";

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

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-500 text-2xl",
  2: "text-zinc-400 text-2xl",
  3: "text-orange-700 text-2xl",
};

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  name: string;
  email?: string;
  aura_points: number;
  aura_tier: string;
  deals_submitted: number;
  is_you: boolean;
}

export default function LeaderboardPage() {
  const { loading, idToken } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    const fetcher = idToken ? getLeaderboard(idToken, 100) : getPublicLeaderboard(100);
    fetcher
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leaderboard"));
  }, [loading, idToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              🏆 Aura Leaderboard
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Top deal hunters ranked by Aura points. Monthly $100 voucher draw for active hunters.
            </p>
          </div>
          <Link
            href="/community"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            ← Back to Deals
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Top 3 Podium */}
        {entries.length >= 3 && (
          <div className="mb-8 grid grid-cols-3 gap-4">
            {[1, 0, 2].map((idx) => {
              const e = entries[idx];
              if (!e) return null;
              const podiumOrder = idx === 0 ? 1 : idx === 1 ? 0 : 2;
              return (
                <div
                  key={e.user_id}
                  style={{ order: podiumOrder }}
                  className={`flex flex-col items-center rounded-2xl border p-6 ${
                    idx === 0
                      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
                      : idx === 1
                      ? "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800"
                      : "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950"
                  } ${idx === 0 ? "mt-0" : "mt-8"}`}
                >
                  <div className="text-4xl mb-2">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  </div>
                  <p className="font-bold text-zinc-900 dark:text-zinc-50 truncate max-w-full">
                    {e.is_you ? "You" : e.name}
                  </p>
                  <p className={`text-2xl font-black ${TIER_COLOR[e.aura_tier] || TIER_COLOR.hunter}`}>
                    {e.aura_points}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {TIER_EMOJI[e.aura_tier]} {e.aura_tier}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{e.deals_submitted} deals</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Full Leaderboard Table */}
        <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                No hunters on the board yet. Submit a deal to claim your spot!
              </p>
              <Link
                href="/community"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
              >
                Submit a Deal
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500">Hunter</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500">Aura</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500">Tier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500">Deals</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.user_id}
                    className={`border-b border-zinc-100 dark:border-zinc-800/50 ${
                      e.is_you ? "bg-blue-50 dark:bg-blue-950/30" : ""
                    }`}
                  >
                    <td className="px-6 py-3">
                      <span className={`font-bold ${RANK_STYLES[e.rank] || "text-zinc-600 dark:text-zinc-400"}`}>
                        {e.rank <= 3 ? (e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉") : `#${e.rank}`}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {e.is_you ? "You" : e.name}
                      </span>
                      {e.is_you && (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                          YOU
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="font-black text-zinc-900 dark:text-zinc-50">{e.aura_points}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`text-sm font-medium ${TIER_COLOR[e.aura_tier] || TIER_COLOR.hunter}`}>
                        {TIER_EMOJI[e.aura_tier]} {e.aura_tier}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-sm text-zinc-600 dark:text-zinc-400">
                      {e.deals_submitted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Voucher Draw Info */}
        <div className="mt-8 rounded-2xl border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-950">
          <h3 className="font-bold text-purple-900 dark:text-purple-300">🎁 Monthly $100 Voucher Draw</h3>
          <p className="mt-2 text-sm text-purple-700 dark:text-purple-400">
            Every month, one active hunter wins a $100 voucher. Your Aura points are your entries —
            the more deals you submit and the more upvotes you get, the better your chances.
            Winners are announced on the first of each month.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
