"use client";

import { useEffect } from "react";

// Replaces the root layout on a fatal error — inline styles only, since the
// global stylesheet lives on the layout this file replaces.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              height: 48,
              width: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "#fafafa",
              color: "#09090b",
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            BH
          </div>
          <h1 style={{ marginTop: 20, fontSize: 28, fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#a1a1aa" }}>
            BargainHuntrs hit an unexpected error. This is usually temporary —
            try again.
          </p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 24,
              border: 0,
              borderRadius: 12,
              background: "#fafafa",
              color: "#09090b",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
