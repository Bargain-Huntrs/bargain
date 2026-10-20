"use client";

import { useState } from "react";

export default function CopyCouponCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable — the code is visible for manual copy.
        }
      }}
      className="rounded-lg border border-dashed border-zinc-400 bg-zinc-50 px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-zinc-900 transition-colors hover:border-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-zinc-400"
    >
      {copied ? "Copied!" : code}
    </button>
  );
}
