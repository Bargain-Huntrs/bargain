"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getFeatureRequests,
  getOrCreateVoterId,
  getVotedIds,
  setVotedFlag,
  submitFeatureRequest,
  voteFeatureRequest,
  type FeatureRequest,
} from "@/lib/api";

const COLUMNS: { key: FeatureRequest["status"]; label: string; hint: string; accent: string }[] = [
  { key: "in_progress", label: "In Progress", hint: "Being built right now", accent: "text-blue-600 dark:text-blue-400" },
  { key: "planned", label: "Planned", hint: "On the roadmap", accent: "text-purple-600 dark:text-purple-400" },
  { key: "under_review", label: "Under Review", hint: "Vote to prioritize", accent: "text-zinc-600 dark:text-zinc-400" },
  { key: "shipped", label: "Shipped", hint: "Live on the site", accent: "text-emerald-600 dark:text-emerald-400" },
];

export default function RoadmapClient() {
  const { idToken, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "general",
    author_name: "",
    author_email: "",
  });

  const load = useCallback(async () => {
    try {
      const data = await getFeatureRequests();
      const voted = getVotedIds();
      setRequests(data.map((r) => ({ ...r, voted: !!voted[r.id] })));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roadmap");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function handleVote(id: string) {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, voted: !r.voted, votes: r.votes + (r.voted ? -1 : 1) } : r
      )
    );
    try {
      const res = await voteFeatureRequest(idToken, id, idToken ? undefined : getOrCreateVoterId());
      setVotedFlag(id, res.voted);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, voted: res.voted, votes: res.votes } : r))
      );
    } catch {
      load();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await submitFeatureRequest(idToken, {
        title: form.title.trim(),
        body: form.body.trim() || undefined,
        category: form.category,
        author_name: idToken ? undefined : form.author_name.trim() || undefined,
        author_email: idToken ? undefined : form.author_email.trim() || undefined,
      });
      setForm({ title: "", body: "", category: "general", author_name: "", author_email: "" });
      setShowForm(false);
      setSubmitted(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">Feature Roadmap</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            What we&apos;re building next. Vote on the ideas you want — votes set priority.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          + Request a Feature
        </button>
      </div>

      {submitted && (
        <div className="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Thanks! Your request is in the review queue — it&apos;ll appear under
          “Under Review” once approved.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Request a feature</h2>
          <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <input
              type="text"
              placeholder="What should we build? *"
              required
              minLength={5}
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${inputCls} sm:col-span-2`}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputCls}
            >
              <option value="general">General</option>
              <option value="deals">Deals &amp; scanning</option>
              <option value="alerts">Alerts &amp; notifications</option>
              <option value="community">Community</option>
              <option value="resale">Resale tools</option>
              <option value="mobile">Mobile / app</option>
            </select>
            <textarea
              placeholder="Details — how would this help you?"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
              maxLength={5000}
              className={inputCls}
            />
            {!idToken && (
              <>
                <input
                  type="text"
                  placeholder="Display name"
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
              </>
            )}
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Request"}
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

      {loading ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = requests.filter((r) => r.status === col.key);
            return (
              <section key={col.key}>
                <header className="mb-3 flex items-baseline justify-between">
                  <h2 className={`text-sm font-bold uppercase tracking-wide ${col.accent}`}>
                    {col.label}
                  </h2>
                  <span className="text-xs text-zinc-400">
                    {items.length} · {col.hint}
                  </span>
                </header>
                <div className="space-y-3">
                  {items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-400 dark:border-zinc-800">
                      Nothing here yet.
                    </p>
                  )}
                  {items.map((r) => (
                    <article
                      key={r.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleVote(r.id)}
                          aria-label={r.voted ? "Remove vote" : "Vote for this feature"}
                          className={`flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                            r.voted
                              ? "bg-blue-600 text-white"
                              : "bg-zinc-100 text-zinc-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          <span aria-hidden>▲</span>
                          {r.votes}
                        </button>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {r.title}
                          </h3>
                          {r.body && (
                            <p className="mt-1 text-xs text-zinc-500 line-clamp-3 dark:text-zinc-400">
                              {r.body}
                            </p>
                          )}
                          <p className="mt-2 text-[11px] text-zinc-400">
                            {r.category}
                            {r.author_name ? ` · by ${r.author_name}` : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-zinc-400">
        Have a bigger idea or found a bug?{" "}
        <Link href="/contact" className="text-blue-600 hover:underline">
          Contact us
        </Link>{" "}
        or use the Feedback tab on any page.
      </p>
    </main>
  );
}
