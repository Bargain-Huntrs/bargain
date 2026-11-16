"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import { authService } from "@/lib/authService";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.bargainhuntrs.com";

interface PasskeyButtonProps {
  /** "register" links a passkey to an existing/authenticated account;
   *  "login" authenticates an existing user with a passkey. */
  mode: "register" | "login";
  /** Email is required for login mode (to look up the credential). */
  email?: string;
  /** Optional label override. */
  label?: string;
  /** Called after a successful login-mode passkey auth. */
  onSuccess?: () => void;
  /** Called when an error occurs. */
  onError?: (message: string) => void;
  className?: string;
}

export default function PasskeyButton({
  mode,
  email,
  label,
  onSuccess,
  onError,
  className,
}: PasskeyButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handlePasskey() {
    onError?.("");
    setLoading(true);
    try {
      if (mode === "register") {
        await handleRegister();
      } else {
        await handleLogin();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Passkey operation failed";
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }

  async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = authService.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async function handleRegister() {
    const headers = await getAuthHeaders();
    // 1. Get registration options from the backend.
    const startRes = await fetch(`${API_URL}/api/v1/auth/webauthn/register/start`, {
      method: "POST",
      headers,
    });
    if (!startRes.ok) {
      const data = await startRes.json().catch(() => ({}));
      throw new Error(data?.detail || "Failed to start passkey registration");
    }
    const { options } = await startRes.json();

    // 2. Prompt the browser to create a passkey.
    const credential = await startRegistration({ optionsJSON: JSON.parse(options) });

    // 3. Send the credential to the backend for verification + storage.
    const finishRes = await fetch(`${API_URL}/api/v1/auth/webauthn/register/finish`, {
      method: "POST",
      headers,
      body: JSON.stringify({ credential: JSON.stringify(credential) }),
    });
    if (!finishRes.ok) {
      const data = await finishRes.json().catch(() => ({}));
      throw new Error(data?.detail || "Failed to verify passkey");
    }
    onError?.("");
    onSuccess?.();
  }

  async function handleLogin() {
    if (!email) {
      throw new Error("Email is required to sign in with a passkey");
    }

    // 1. Get authentication options from the backend.
    const startRes = await fetch(`${API_URL}/api/v1/auth/webauthn/login/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!startRes.ok) {
      const data = await startRes.json().catch(() => ({}));
      throw new Error(data?.detail || "Failed to start passkey login");
    }
    const { options } = await startRes.json();

    // 2. Prompt the browser to use a passkey.
    const credential = await startAuthentication({ optionsJSON: JSON.parse(options) });

    // 3. Verify with the backend and receive a JWT.
    const finishRes = await fetch(`${API_URL}/api/v1/auth/webauthn/login/finish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: JSON.stringify(credential), email }),
    });
    if (!finishRes.ok) {
      const data = await finishRes.json().catch(() => ({}));
      throw new Error(data?.detail || "Passkey login failed");
    }
    const data = await finishRes.json();
    if (data.accessToken && data.user) {
      // Store the session through authService so AuthContext gets the
      // same-tab auth-changed event (raw localStorage writes don't notify it).
      authService.storeSession(
        data.accessToken,
        data.refreshToken || "",
        data.user,
      );
      onSuccess?.();
      router.push("/dashboard");
    } else {
      throw new Error("Passkey login did not return a session");
    }
  }

  const defaultLabel = mode === "register" ? "Add a passkey" : "Sign in with passkey";

  return (
    <button
      type="button"
      onClick={handlePasskey}
      disabled={loading}
      className={
        className ||
        "flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700"
      }
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M12 12v8" />
        <path d="M8 20h8" />
      </svg>
      {loading ? "Waiting for passkey…" : label || defaultLabel}
    </button>
  );
}
