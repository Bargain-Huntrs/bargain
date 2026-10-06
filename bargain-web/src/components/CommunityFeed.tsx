"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  createCommunityThread,
  getCommunityThreads,
  getOrCreateVoterId,
  getVotedIds,
  setVotedFlag,
  voteCommunityThread,
  type DealThread,
} from "@/lib/api";

function getTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatPrice(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CommunityFeed() {
  const { idToken, user, loading: authLoading } = useAuth();
  const [threads, setThreads] = useState<DealThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    url: "",
    body: "",
    retailer: "",
    price: "",
    original_price: "",
    author_name: "",
    author_email: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await getCommunityThreads({ sort, limit: 50 });
      const voted = getVotedIds();
      setThreads(data.map((t) => ({ ...t, voted: !!voted[t.id] })));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load community threads");
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleVote(threadId: string) {
    // Optimistic toggle
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, voted: !t.voted, upvotes: t.upvotes + (t.voted ? -1 : 1) }
          : t
      )
    );
    try {
      const res = await voteCommunityThread(idToken, threadId, idToken ? undefined : getOrCreateVoterId());
      setVotedFlag(threadId, res.voted);
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, voted: res.voted, upvotes: res.upvotes } : t))
      );
    } catch {
      load(); // revert on error
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const priceCents = form.price ? Math.round(parseFloat(form.price) * 100) : undefined;
      const origCents = form.original_price
        ? Math.round(parseFloat(form.original_price) * 100)
        : undefined;
      await createCommunityThread(idToken, {
        title: form.title.trim(),
        url: form.url.trim() || undefined,
        body: form.body.trim() || undefined,
        retailer: form.retailer.trim() || undefined,
        price_cents: priceCents,
        original_price_cents: origCents,
        author_name: idToken ? undefined : form.author_name.trim() || undefined,
        author_email: idToken ? undefined : form.author_email.trim() || undefined,
      });
      setForm({
        title: "", url: "", body: "", retailer: "", price: "",
        original_price: "", author_name: "", author_email: "",
      });
      setShowForm(false);
      setSort("new");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post thread");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Community Deals</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Deals and finds shared by hunters — vote up the best ones. No account needed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/community/leaderboard"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            🏆 Leaderboard
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            + Post a Deal
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Submit form */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Post a deal or find</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Share a link to the deal, or just describe what you found.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Title * (e.g. “DeWalt 20V kit — $99 at Home Depot”)"
              required
              minLength={5}
              maxLength={300}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${inputCls} sm:col-span-2`}
            />
            <input
              type="url"
              placeholder="Deal link (https://…)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className={`${inputCls} sm:col-span-2`}
            />
            <input
              type="text"
              placeholder="Retailer (e.g. Amazon, Walmart)"
              value={form.retailer}
              onChange={(e) => setForm({ ...form, retailer: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Price $"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputCls}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Was $"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className={inputCls}
              />
            </div>
            <textarea
              placeholder="Details — coupon codes, expiry, why it's a good deal…"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              maxLength={5000}
              className={`${inputCls} sm:col-span-2`}
            />
            {!idToken && (
              <>
                <input
                  type="text"
                  placeholder="Display name *"
                  required
                  maxLength={120}
                  value={form.author_name}
                  onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="email"
                  placeholder="Email * (private — never shown)"
                  required
                  value={form.author_email}
                  onChange={(e) => setForm({ ...form, author_email: e.target.value })}
                  className={inputCls}
                />
                <p className="text-xs text-zinc-500 sm:col-span-2">
                  Posting as {user ? "a member" : "a guest"} —{" "}
                  <Link href="/signup" className="text-blue-600 hover:underline">
                    create a free account
                  </Link>{" "}
                  to earn Aura for your finds.
                </p>
              </>
            )}
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Posting…" : "Post to Community"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sort tabs */}
      <div className="mb-6 flex gap-2">
        {(["hot", "new"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              sort === s
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {s === "hot" ? "🔥 Hot" : "✨ New"}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-500 dark:text-zinc-400">
            No community threads yet — be the first to post a deal!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <ThreadCard key={t.id} thread={t} onVote={handleVote} />
          ))}
        </div>
      )}
    </main>
  );
}

function ThreadCard({
  thread,
  onVote,
}: {
  thread: DealThread;
  onVote: (id: string) => void;
}) {
  const price = formatPrice(thread.price_cents);
  const wasPrice = formatPrice(thread.original_price_cents);
  const discount =
    thread.price_cents != null &&
    thread.original_price_cents != null &&
    thread.original_price_cents > thread.price_cents
      ? Math.round((1 - thread.price_cents / thread.original_price_cents) * 100)
      : null;

  return (
    <div className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      {/* Vote arrow */}
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <button
          onClick={() => onVote(thread.id)}
          aria-label={thread.voted ? "Remove upvote" : "Upvote"}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold transition-colors ${
            thread.voted
              ? "bg-orange-500 text-white"
              : "bg-zinc-100 text-zinc-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          ▲
        </button>
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{thread.upvotes}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/community/${thread.id}`}
            className="font-bold text-zinc-900 line-clamp-2 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400"
          >
            {thread.title}
          </Link>
          {discount != null && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
              -{discount}%
            </span>
          )}
        </div>

        {(price || thread.retailer) && (
          <div className="mt-1 flex items-baseline gap-2 text-sm">
            {price && (
              <span className="font-black text-zinc-900 dark:text-zinc-50">{price}</span>
            )}
            {wasPrice && wasPrice !== price && (
              <span className="text-zinc-400 line-through">{wasPrice}</span>
            )}
            {thread.retailer && (
              <span className="text-xs text-zinc-500 capitalize">@ {thread.retailer}</span>
            )}
          </div>
        )}

        {thread.body && (
          <p className="mt-1.5 text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">
            {thread.body}
          </p>
        )}

        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {thread.author_name}
            {thread.is_member && (
              <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                member
              </span>
            )}
          </span>
          <span>· {getTimeAgo(thread.created_at)}</span>
          <Link
            href={`/community/${thread.id}`}
            className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
          >
            💬 {thread.comments_count} comment{thread.comments_count === 1 ? "" : "s"}
          </Link>
          {thread.url && (
            <a
              href={thread.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="ml-auto font-medium text-blue-600 hover:text-blue-700"
            >
              Get deal →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
