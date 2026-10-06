"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import {
  createThreadComment,
  deleteCommunityThread,
  getCommunityThread,
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

export default function CommunityThread() {
  const router = useRouter();
  const { idToken, user } = useAuth();
  const [thread, setThread] = useState<DealThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentEmail, setCommentEmail] = useState("");
  const [posting, setPosting] = useState(false);

  const threadId =
    typeof window !== "undefined"
      ? window.location.pathname.split("/").filter(Boolean)[1] || ""
      : "";

  const load = useCallback(async () => {
    if (!threadId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const data = await getCommunityThread(threadId);
      const voted = getVotedIds();
      setThread({ ...data, voted: !!voted[data.id] });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVote() {
    if (!thread) return;
    setThread({ ...thread, voted: !thread.voted, upvotes: thread.upvotes + (thread.voted ? -1 : 1) });
    try {
      const res = await voteCommunityThread(idToken, thread.id, idToken ? undefined : getOrCreateVoterId());
      setVotedFlag(thread.id, res.voted);
      setThread((t) => (t ? { ...t, voted: res.voted, upvotes: res.upvotes } : t));
    } catch {
      load();
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!thread || !commentBody.trim()) return;
    setError("");
    setPosting(true);
    try {
      const comment = await createThreadComment(idToken, thread.id, {
        body: commentBody.trim(),
        author_name: idToken ? undefined : commentName.trim() || undefined,
        author_email: idToken ? undefined : commentEmail.trim() || undefined,
      });
      setThread((t) =>
        t
          ? {
              ...t,
              comments_count: t.comments_count + 1,
              comments: [...(t.comments || []), comment],
            }
          : t
      );
      setCommentBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete() {
    if (!thread || !idToken || !window.confirm("Delete this thread?")) return;
    try {
      await deleteCommunityThread(idToken, thread.id);
      router.push("/community");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete thread");
    }
  }

  const canDelete =
    !!thread &&
    !!user &&
    (user.role === "admin" || (!!thread.author_user_id && thread.author_user_id === user.id));

  const price = formatPrice(thread?.price_cents);
  const wasPrice = formatPrice(thread?.original_price_cents);
  const discount =
    thread?.price_cents != null &&
    thread?.original_price_cents != null &&
    thread.original_price_cents > thread.price_cents
      ? Math.round((1 - thread.price_cents / thread.original_price_cents) * 100)
      : null;

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/community" className="text-sm text-blue-600 hover:underline">
          ← Back to Community
        </Link>

        {loading ? (
          <p className="mt-8 text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : notFound || !thread ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Thread not found</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              It may have been removed, or the link is wrong.
            </p>
          </div>
        ) : (
          <>
            {/* Thread */}
            <div className="mt-6 flex gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={handleVote}
                  aria-label={thread.voted ? "Remove upvote" : "Upvote"}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
                    thread.voted
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-orange-100 hover:text-orange-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  ▲
                </button>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                  {thread.upvotes}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {thread.title}
                  </h1>
                  {discount != null && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600 dark:bg-red-950 dark:text-red-400">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {thread.author_name}
                  {thread.is_member && (
                    <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      member
                    </span>
                  )}
                  {" · "}
                  {getTimeAgo(thread.created_at)}
                  {thread.retailer && (
                    <span className="capitalize"> · {thread.retailer}</span>
                  )}
                </div>

                {(price || wasPrice) && (
                  <div className="mt-3 flex items-baseline gap-2">
                    {price && (
                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                        {price}
                      </span>
                    )}
                    {wasPrice && wasPrice !== price && (
                      <span className="text-sm text-zinc-400 line-through">{wasPrice}</span>
                    )}
                  </div>
                )}

                {thread.body && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {thread.body}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4">
                  {thread.url && (
                    <a
                      href={thread.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                      Get this deal →
                    </a>
                  )}
                  {canDelete && (
                    <button
                      onClick={handleDelete}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Delete thread
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="mt-8">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {thread.comments?.length || 0} Comment
                {(thread.comments?.length || 0) === 1 ? "" : "s"}
              </h2>

              <div className="mt-4 space-y-3">
                {(thread.comments || []).map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {c.author_name}
                      </span>
                      {c.is_member && (
                        <span className="ml-1 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          member
                        </span>
                      )}
                      {" · "}
                      {getTimeAgo(c.created_at)}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {c.body}
                    </p>
                  </div>
                ))}
                {(thread.comments || []).length === 0 && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    No comments yet — be the first.
                  </p>
                )}
              </div>

              {/* Comment form */}
              <form
                onSubmit={handleComment}
                className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Add a comment
                </h3>
                {error && (
                  <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                    {error}
                  </div>
                )}
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="What do you think? Is this deal still live?"
                  rows={3}
                  maxLength={5000}
                  required
                  className={`${inputCls} mt-3`}
                />
                {!idToken && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Display name *"
                      required
                      maxLength={120}
                      value={commentName}
                      onChange={(e) => setCommentName(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="email"
                      placeholder="Email (private, optional)"
                      value={commentEmail}
                      onChange={(e) => setCommentEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={posting || !commentBody.trim()}
                  className="mt-4 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {posting ? "Posting…" : "Post comment"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
