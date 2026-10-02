"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  getCurrentUser,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNicheSubscriptions,
  subscribeToNiche,
  unsubscribeFromNiche,
  type NotificationPreferences,
  type Niche,
} from "@/lib/api";

interface UserData {
  id: string;
  email: string;
  subscription_tier: string;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_deal_alerts: true,
  sms_deal_alerts: false,
  discord_alerts: false,
  telegram_alerts: false,
  push_notifications: false,
  weekly_digest: false,
  glitch_alerts: false,
  alert_max_per_day: 0,
  quiet_start_hour: null,
  quiet_end_hour: null,
  alert_timezone: null,
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" }),
}));

function quietLabel(h: number | null | undefined): string {
  if (h == null) return "—";
  return HOUR_OPTIONS[h]?.label ?? String(h);
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const PREFERENCE_ITEMS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  hunterOnly?: boolean;
}[] = [
  {
    key: "email_deal_alerts",
    label: "Email deal alerts",
    description: "Get notified when new arbitrage deals match your niches.",
  },
  {
    key: "sms_deal_alerts",
    label: "SMS deal alerts",
    description: "Instant text notifications for high-priority deals.",
    hunterOnly: true,
  },
  {
    key: "discord_alerts",
    label: "Discord alerts",
    description: "Receive deal pings in your linked Discord channel.",
  },
  {
    key: "telegram_alerts",
    label: "Telegram alerts",
    description: "Get deal alerts via Telegram messages.",
  },
  {
    key: "push_notifications",
    label: "Push notifications",
    description: "Browser push alerts when deals are detected. Use the Enable button below.",
  },
  {
    key: "weekly_digest",
    label: "Weekly digest",
    description: "A weekly summary of the best deals and price glitches.",
  },
  {
    key: "glitch_alerts",
    label: "Glitch alerts (instant)",
    description: "Immediate alerts for pricing glitches and clearance errors.",
  },
];

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, loading, idToken } = useAuth();
  const push = usePushNotifications();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [availableNiches, setAvailableNiches] = useState<Niche[]>([]);
  const [subscribedNiches, setSubscribedNiches] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [togglingNiches, setTogglingNiches] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pushStatus, setPushStatus] = useState("");

  const isHunter = (userData?.subscription_tier || "free").toLowerCase() === "hunter";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?next=/settings/notifications");
      return;
    }

    if (idToken) {
      loadAll(idToken);
    }
  }, [user, loading, idToken, router]);

  async function loadAll(token: string) {
    setIsLoading(true);
    setError("");
    try {
      const [currentUser, prefs, nicheData] = await Promise.all([
        getCurrentUser(token),
        getNotificationPreferences(token).catch(() => DEFAULT_PREFERENCES),
        getNicheSubscriptions(token).catch(() => ({ available_niches: [], subscribed_niches: [] })),
      ]);

      setUserData({
        id: currentUser.id,
        email: currentUser.email,
        subscription_tier: currentUser.subscriptionTier || "free",
      });
      setPreferences({ ...DEFAULT_PREFERENCES, ...prefs });
      setAvailableNiches(nicheData.available_niches);
      setSubscribedNiches(nicheData.subscribed_niches || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notification settings");
    } finally {
      setIsLoading(false);
    }
  }

  function updatePreference(key: keyof NotificationPreferences, value: boolean) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  function updateLimit(key: keyof NotificationPreferences, value: number | null) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  async function savePreferences() {
    if (!idToken) return;
    setSavingPreferences(true);
    setError("");
    setSuccess("");
    try {
      // Quiet hours are interpreted in the user's timezone — record the
      // browser's zone so the server evaluates the window locally.
      const payload = { ...preferences };
      if (payload.quiet_start_hour != null || payload.quiet_end_hour != null) {
        payload.alert_timezone = browserTimezone();
      }
      const updated = await updateNotificationPreferences(idToken, payload);
      setPreferences({ ...DEFAULT_PREFERENCES, ...updated });
      setSuccess("Notification preferences saved.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSavingPreferences(false);
    }
  }

  async function toggleNiche(nicheKey: string) {
    if (!idToken) return;
    const isSubscribed = subscribedNiches.includes(nicheKey);
    setTogglingNiches((prev) => ({ ...prev, [nicheKey]: true }));
    setError("");
    try {
      if (isSubscribed) {
        await unsubscribeFromNiche(idToken, nicheKey);
        setSubscribedNiches((prev) => prev.filter((k) => k !== nicheKey));
      } else {
        await subscribeToNiche(idToken, nicheKey);
        setSubscribedNiches((prev) => [...prev, nicheKey]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isSubscribed ? "unsubscribe from" : "subscribe to"} niche`);
    } finally {
      setTogglingNiches((prev) => ({ ...prev, [nicheKey]: false }));
    }
  }

  async function handleEnablePush() {
    setPushStatus("Requesting permission...");
    const ok = await push.enable();
    if (ok) {
      setPushStatus("Push notifications enabled! Click Test to verify.");
      setPreferences((prev) => ({ ...prev, push_notifications: true }));
    } else {
      setPushStatus("Failed to enable. Make sure you allow notifications in your browser.");
    }
    setTimeout(() => setPushStatus(""), 5000);
  }

  async function handleDisablePush() {
    await push.disable();
    setPushStatus("Push notifications disabled.");
    setPreferences((prev) => ({ ...prev, push_notifications: false }));
    setTimeout(() => setPushStatus(""), 3000);
  }

  async function handleTestPush() {
    setPushStatus("Sending test...");
    const result = await push.sendTest();
    if (result?.status === "success") {
      setPushStatus("Test sent! Check your browser notifications.");
    } else {
      setPushStatus(`Test failed: ${result?.error || "unknown error"}`);
    }
    setTimeout(() => setPushStatus(""), 5000);
  }

  if (loading || isLoading) {
    return (
      <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-600 dark:text-zinc-400">Loading notification settings…</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-zinc-950">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Notification Settings
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Choose how and when you want to be alerted about deals.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="hidden rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:inline-block"
          >
            Back to dashboard
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            {success}
          </div>
        )}

        {/* Push notification setup */}
        <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            🔔 Push Notifications
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Get instant deal alerts in your browser — even when you&apos;re not on the site.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {!push.registered ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={push.loading}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {push.loading ? "Enabling…" : "Enable push notifications"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleTestPush}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Send test notification
                </button>
                <button
                  type="button"
                  onClick={handleDisablePush}
                  className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Disable
                </button>
              </>
            )}
          </div>

          {pushStatus && (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{pushStatus}</p>
          )}

          {push.permission === "denied" && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
              Notifications are blocked in your browser settings. Enable them in your browser&apos;s
              site permissions to use push notifications.
            </p>
          )}
        </section>

        {/* Deal alert channels */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Alert channels</h2>
            {!isHunter && (
              <Link
                href="/pricing"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Upgrade to Hunter →
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Toggle the channels you want to receive deal alerts on.
          </p>

          <div className="mt-6 space-y-4">
            {PREFERENCE_ITEMS.map(({ key, label, description, hunterOnly }) => {
              const disabled = hunterOnly && !isHunter;
              return (
                <label
                  key={key}
                  className={`flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50 ${
                    disabled ? "opacity-60" : "cursor-pointer"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
                      {hunterOnly && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Hunter
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!preferences[key]}
                    disabled={disabled}
                    onChange={(e) => updatePreference(key, e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-zinc-900 disabled:cursor-not-allowed dark:accent-zinc-50"
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={savePreferences}
              disabled={savingPreferences}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {savingPreferences ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </section>

        {/* Alert limits — personal cap + quiet hours */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Alert limits</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Cap how many deal alerts you get per day, and set quiet hours when no
            alerts go out. Alerts during quiet hours still appear on your dashboard.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Max alerts per day
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                value={preferences.alert_max_per_day ?? 0}
                onChange={(e) =>
                  updateLimit("alert_max_per_day", Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <span className="mt-1 block text-xs text-zinc-500">0 = unlimited</span>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Quiet hours start
              </span>
              <select
                value={preferences.quiet_start_hour ?? ""}
                onChange={(e) =>
                  updateLimit("quiet_start_hour", e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Off</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Quiet hours end
              </span>
              <select
                value={preferences.quiet_end_hour ?? ""}
                onChange={(e) =>
                  updateLimit("quiet_end_hour", e.target.value === "" ? null : Number(e.target.value))
                }
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">Off</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </label>
          </div>

          {(preferences.quiet_start_hour != null || preferences.quiet_end_hour != null) &&
            preferences.quiet_start_hour !== preferences.quiet_end_hour && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Quiet window: {quietLabel(preferences.quiet_start_hour)} – {quietLabel(preferences.quiet_end_hour)}{" "}
                ({browserTimezone()})
              </p>
            )}
        </section>

        {/* Niche subscriptions */}
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Niche subscriptions</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Select the deal categories you want alerts for. Leave all unchecked to receive every niche.
          </p>

          {availableNiches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">Loading niches…</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {availableNiches.map((n) => {
                const checked = subscribedNiches.includes(n.key);
                const busy = togglingNiches[n.key];
                return (
                  <label
                    key={n.key}
                    className={`flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 transition-colors dark:border-zinc-800 dark:bg-zinc-950/50 ${
                      busy ? "opacity-60" : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                    }`}
                    title={n.description}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => toggleNiche(n.key)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-zinc-900 dark:accent-zinc-50"
                    />
                    <div>
                      <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
                        <span>{n.emoji}</span>
                        <span>{n.name}</span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{n.description}</p>
                      {n.typical_margin && (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                          Typical margin: {n.typical_margin}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
