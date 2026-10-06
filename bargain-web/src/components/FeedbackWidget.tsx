"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { submitFeatureRequest } from "@/lib/api";

/**
 * Floating "Feedback" tab pinned to the right edge of every page.
 * Opens a modal that posts to the public feature-request board (/api/v1/feedback)
 * — the same board rendered at /roadmap.
 */
export default function FeedbackWidget() {
  const { idToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "general",
    author_name: "",
    author_email: "",
  });

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
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    if (done) {
      setDone(false);
      setForm({ title: "", body: "", category: "general", author_name: "", author_email: "" });
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

  return (
    <>
      {/* Edge tab — vertically centered on the right edge */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open feedback form"
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-lg bg-zinc-900 px-2 py-3 text-xs font-bold tracking-widest text-white shadow-lg transition-colors hover:bg-blue-600 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-blue-500 dark:hover:text-white"
        style={{ writingMode: "vertical-rl" }}
      >
        FEEDBACK
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="py-6 text-center">
                <p className="text-3xl" aria-hidden>🎉</p>
                <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  Thanks for the feedback!
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  It&apos;s in the review queue on our public roadmap.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <Link
                    href="/roadmap"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    View Roadmap
                  </Link>
                  <button
                    onClick={close}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                      Request a feature
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      Posts to our public{" "}
                      <Link href="/roadmap" className="text-blue-600 hover:underline">
                        roadmap
                      </Link>{" "}
                      where others can vote on it.
                    </p>
                  </div>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {error && (
                  <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="What should we build? *"
                    required
                    minLength={5}
                    maxLength={160}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className={inputCls}
                  />
                  <textarea
                    placeholder="Details — how would this help you?"
                    rows={3}
                    maxLength={5000}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className={inputCls}
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
                  {!idToken && (
                    <div className="grid gap-3 sm:grid-cols-2">
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
                        placeholder="Email * (private)"
                        required
                        value={form.author_email}
                        onChange={(e) => setForm({ ...form, author_email: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? "Sending…" : "Submit to Roadmap"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
