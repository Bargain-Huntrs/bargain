"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "bargain-cookie-notice-dismissed";

/**
 * Minimal cookie/tracking notice. The site loads GA4 and affiliate
 * attribution scripts unconditionally, so this informs visitors and
 * persists dismissal in localStorage. Not a consent-management platform —
 * it does not gate the trackers.
 */
export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          We use cookies for sign-in, analytics (Google Analytics), and
          affiliate link attribution.{" "}
          <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/disclosure" className="underline hover:text-zinc-900 dark:hover:text-zinc-50">
            Affiliate Disclosure
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
