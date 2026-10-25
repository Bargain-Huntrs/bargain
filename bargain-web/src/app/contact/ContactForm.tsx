"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "support", label: "Support / account help" },
  { value: "partnership", label: "Partnership / business" },
  { value: "seller", label: "Selling on BargainHuntrs" },
  { value: "press", label: "Press / media" },
  { value: "other", label: "Something else" },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

export default function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [form, setForm] = useState({ name: "", email: "", topic: "general", message: "" });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setState("submitting");

    try {
      const response = await fetch(`${API_URL}/api/v1/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Submission failed");
      setState("success");
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-8 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-lg">
          ✓
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Message sent.</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
          Thanks, <strong>{form.name}</strong> — we&apos;ll get back to you at{" "}
          <strong>{form.email}</strong> within 24 hours on business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} suppressHydrationWarning className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="name">
            Your name <span className="text-rose-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Alex Johnson"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-600"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="email">
            Email address <span className="text-rose-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="alex@yourdomain.com"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="topic">
          What&apos;s this about?
        </label>
        <select
          id="topic"
          name="topic"
          value={form.topic}
          onChange={handleChange}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5" htmlFor="message">
          Message <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="How can we help?"
          value={form.message}
          onChange={handleChange}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-600 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={state === "submitting" || !form.name || !form.email || !form.message}
        className="w-full rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm"
      >
        {state === "submitting" ? "Sending…" : "Send message →"}
      </button>

      {state === "error" && (
        <p className="text-center text-xs text-rose-500">
          Something went wrong. Try again or email us at hello@bargainhuntrs.com.
        </p>
      )}
    </form>
  );
}
