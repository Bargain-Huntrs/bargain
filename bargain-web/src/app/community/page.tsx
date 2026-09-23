"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  getCommunityDeals,
  getPublicCommunityDeals,
  submitCommunityDeal,
  voteCommunityDeal,
  getMyAura,
  type CommunityDeal,
} from "@/lib/api";

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

export default function CommunityPage() {
  const router = useRouter();
  const { loading, idToken } = useAuth();
  const [deals, setDeals] = useState<CommunityDeal[]>([]);
  const [aura, setAura] = useState<{
    aura_points: number;
    aura_tier: string;
    next_tier: string | null;
    points_to_next: number;
    deals_submitted: number;
    deals_approved: number;
    total_upvotes_received: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<"hot" | "new" | "top">("hot");
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    url: "",
    retailer: "",
    original_price: "",
    sale_price: "",
    category: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    try {
      if (idToken) {
        const [dealData, auraData] = await Promise.all([
          getCommunityDeals(idToken, { sort: sortBy, limit: 50 }),
          getMyAura(idToken).catch(() => null),
        ]);
        setDeals(dealData);
        if (auraData) setAura(auraData);
      } else {
        const dealData = await getPublicCommunityDeals({ sort: sortBy, limit: 50 });
        setDeals(dealData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community deals");
    }
  }, [idToken, sortBy]);

  useEffect(() => {
    if (!loading) loadData();
  }, [loading, loadData]);

  async function handleVote(dealId: string, vote: 1 | -1) {
    if (!idToken) {
      router.push("/login");
      return;
    }
    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        const prevVote = d.user_vote;
        let upvotes = d.upvotes;
        let downvotes = d.downvotes;
        // Remove previous vote
        if (prevVote === 1) upvotes--;
        if (prevVote === -1) downvotes--;
        // Add new vote (if not toggling off)
        const newVote = prevVote === vote ? null : vote;
        if (newVote === 1) upvotes++;
        if (newVote === -1) downvotes++;
        return {
          ...d,
          upvotes,
          downvotes,
          score: upvotes - downvotes,
          user_vote: newVote,
        };
      })
    );

    try {
      await voteCommunityDeal(idToken, dealId, vote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
      loadData(); // Revert on error
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setError("");
    setSubmitting(true);
    try {
      const result = await submitCommunityDeal(idToken, {
        title: form.title,
        url: form.url,
        retailer: form.retailer,
        original_price: form.original_price ? parseFloat(form.original_price) : undefined,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : undefined,
        category: form.category || undefined,
        description: form.description || undefined,
      });
      setForm({ title: "", url: "", retailer: "", original_price: "", sale_price: "", category: "", description: "" });
      setShowSubmitForm(false);
      await loadData();
      setAura((prev) => prev ? { ...prev, aura_points: result.aura_points, aura_tier: result.aura_tier } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit deal");
    } finally {
      setSubmitting(false);
    }
  }

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

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Aura Stats Banner */}
        {aura && (
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-black text-white">
                  {aura.aura_points}
                </div>
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Your Aura</p>
                  <p className={`text-xl font-bold ${TIER_COLOR[aura.aura_tier] || TIER_COLOR.hunter}`}>
                    {TIER_EMOJI[aura.aura_tier] || "🎯"} {aura.aura_tier.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{aura.deals_submitted}</p>
                  <p className="text-xs text-zinc-500">Deals Submitted</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{aura.deals_approved}</p>
                  <p className="text-xs text-zinc-500">Approved</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{aura.total_upvotes_received}</p>
                  <p className="text-xs text-zinc-500">Upvotes</p>
                </div>
              </div>
              {aura.next_tier && (
                <div className="text-right">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {aura.points_to_next} points to{" "}
                    <span className={`font-bold ${TIER_COLOR[aura.next_tier] || ""}`}>
                      {TIER_EMOJI[aura.next_tier]} {aura.next_tier.toUpperCase()}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Header + Submit Button */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Community Deals</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Submit deals, vote on the best finds, and climb the leaderboard
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/referrals"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            >
              🎁 Invite Friends
            </Link>
            <Link
              href="/community/leaderboard"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
            >
              🏆 Leaderboard
            </Link>
            <button
              onClick={() => (idToken ? setShowSubmitForm(!showSubmitForm) : router.push("/login"))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              + Submit a Deal
            </button>
          </div>
        </div>

        {/* Submit Form */}
        {showSubmitForm && (
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Submit a Deal</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Found a great deal? Share it with the community and earn 10 Aura points!
            </p>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Deal title *"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2"
              />
              <input
                type="url"
                placeholder="Deal URL *"
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2"
              />
              <input
                type="text"
                placeholder="Retailer (e.g. Amazon, Walmart) *"
                required
                value={form.retailer}
                onChange={(e) => setForm({ ...form, retailer: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="text"
                placeholder="Category (e.g. Electronics)"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Original price"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Sale price"
                value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:col-span-2"
              />
              <div className="flex gap-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Deal (+10 Aura)"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitForm(false)}
                  className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Sort Tabs */}
        <div className="mb-6 flex gap-2">
          {(["hot", "new", "top"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                sortBy === s
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {s === "hot" ? "🔥 Hot" : s === "new" ? "✨ New" : "📈 Top"}
            </button>
          ))}
        </div>

        {/* Deal Feed */}
        {deals.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">No community deals yet. Be the first to submit one!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} onVote={handleVote} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function DealCard({
  deal,
  onVote,
}: {
  deal: CommunityDeal;
  onVote: (dealId: string, vote: 1 | -1) => void;
}) {
  const timeAgo = getTimeAgo(deal.created_at);
  const discount = deal.discount_percent;

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Vote column + content */}
      <div className="flex gap-3">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => onVote(deal.id, 1)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
              deal.user_vote === 1
                ? "bg-orange-500 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-orange-100 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
            title="Upvote"
          >
            ▲
          </button>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{deal.score}</span>
          <button
            onClick={() => onVote(deal.id, -1)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
              deal.user_vote === -1
                ? "bg-blue-500 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-blue-100 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
            title="Downvote"
          >
            ▼
          </button>
        </div>

        {/* Deal content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 line-clamp-2">{deal.title}</h3>
            {discount && (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
                -{discount}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500 capitalize">{deal.retailer}</p>

          {deal.sale_price && (
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg font-black text-zinc-900 dark:text-zinc-50">
                ${deal.sale_price}
              </span>
              {deal.original_price && (
                <span className="text-sm text-zinc-400 line-through">${deal.original_price}</span>
              )}
            </div>
          )}

          {deal.description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{deal.description}</p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${TIER_COLOR[deal.user_tier] || TIER_COLOR.hunter}`}>
                {TIER_EMOJI[deal.user_tier] || "🎯"} {deal.user_tier}
              </span>
              <span className="text-xs text-zinc-400">· {timeAgo}</span>
            </div>
            <a
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View Deal →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
