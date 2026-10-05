"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getAiStatus,
  postAiCopilot,
  type CopilotDealRef,
  type CopilotHistoryItem,
} from "@/lib/api";

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  deals?: CopilotDealRef[];
}

const SUGGESTIONS = [
  "Find me deals on headphones under $50",
  "Any glitch deals right now?",
  "Best kitchen deals under $30",
];

/**
 * Floating deal-assistant chat panel for the deals feed.
 *
 * Renders a launcher button bottom-right; opens a compact chat window that
 * calls POST /api/v1/ai/copilot. Degrades gracefully: hidden entirely when
 * the deployment has no AI configured, sign-in prompt when logged out.
 */
export default function DealAssistant() {
  const router = useRouter();
  const { idToken } = useAuth();
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAiStatus()
      .then((s) => setAiConfigured(s.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  // Don't render the launcher at all when AI isn't configured on the backend.
  if (aiConfigured !== true) return null;

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    if (!idToken) {
      router.push("/login");
      return;
    }
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const history: CopilotHistoryItem[] = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await postAiCopilot(idToken, message, history);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, deals: res.deals },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error && err.message
              ? `Sorry — ${err.message}`
              : "Sorry, the deal assistant is unavailable right now. Try again in a bit.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Deal assistant"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-xl text-white shadow-lg transition-transform hover:scale-105 hover:bg-emerald-700"
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[28rem] w-[21rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              🤖 Deal Assistant
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Ask for deals in plain English — powered by live deal data.
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
            {!idToken ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Sign in to chat with the deal assistant.
                </p>
                <button
                  onClick={() => router.push("/login")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Try asking:
                    </p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      {m.deals && m.deals.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {m.deals.slice(0, 5).map((d) => (
                            <Link
                              key={d.id}
                              href={d.url}
                              className="block rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 hover:border-emerald-400 dark:border-zinc-600 dark:bg-zinc-900 dark:hover:border-emerald-500"
                            >
                              <p className="line-clamp-1 font-semibold text-zinc-900 dark:text-zinc-50">
                                {d.title}
                              </p>
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                {d.buy_price != null && `$${d.buy_price.toFixed(2)}`}
                                {d.discount_pct != null && ` · ${d.discount_pct}% off`}
                                {d.retailer && ` · ${d.retailer.replace(/_/g, " ")}`}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="mb-3 flex justify-start">
                    <div className="rounded-xl bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      Thinking…
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {idToken && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-700"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Find me deals on…"
                maxLength={500}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
