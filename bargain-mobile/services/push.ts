// Push alerts — wired to bargain-api's REAL routes, not a stub:
//   GET    /api/v1/notifications/preferences      → push state on the user row
//   POST   /api/v1/notifications/push/register    → stores the device token
//   DELETE /api/v1/notifications/push/unregister  → clears it + flips the pref
//   POST   /api/v1/notifications/push/test        → fires a real test push
//
// The backend sends via firebase_admin.messaging.send(token=...), which takes
// an FCM *registration* token — so this uses getDevicePushTokenAsync (the
// native FCM token on Android), NOT getExpoPushTokenAsync, which only Expo's
// own push service can send to.
//
// expo-notifications is lazy-required + every step is guarded: a binary built
// before the module existed, Expo Go, simulators, or a build without FCM
// wired all degrade to friendly errors instead of crashes.

import { api } from './api';

export interface NotificationPrefs {
  email_deal_alerts: boolean;
  sms_deal_alerts: boolean;
  discord_alerts: boolean;
  telegram_alerts: boolean;
  push_notifications: boolean;
  weekly_digest: boolean;
  glitch_alerts: boolean;
  alert_max_per_day: number;
  quiet_start_hour: number | null;
  quiet_end_hour: number | null;
  alert_timezone: string | null;
}

type NotifModule = typeof import('expo-notifications');
let mod: NotifModule | null | undefined;

function notifications(): NotifModule | null {
  if (mod === undefined) {
    try {
      mod = require('expo-notifications') as NotifModule;
    } catch {
      mod = null; // native module not linked in this binary
    }
  }
  return mod ?? null;
}

export async function fetchNotificationPrefs(jwt: string): Promise<NotificationPrefs> {
  return api<NotificationPrefs>('/api/v1/notifications/preferences', { method: 'GET', token: jwt });
}

/**
 * Foreground banners + notification-tap deep links. Deal pushes carry
 * data.url (e.g. https://www.bargainhuntrs.com/deals/<id>) — a tap routes to
 * the matching native detail screen when the URL carries an id, else the
 * feed. Call once at app start; a no-op without the module.
 */
export function wireNotificationHandlers(navigate: (path: string) => void): void {
  const N = notifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    N.addNotificationResponseReceivedListener((res) => {
      try {
        const url = String(res?.notification?.request?.content?.data?.url ?? '');
        const m = url.match(/\/deals?\/([A-Za-z0-9_-]{3,})/);
        navigate(m ? `/deal/${m[1]}` : '/(tabs)');
      } catch {
        /* malformed payload — ignore */
      }
    });
  } catch {
    /* handler API differences across versions — non-fatal */
  }
}

/**
 * Permission → native device token → POST /push/register.
 * Throws an Error with a user-facing reason on every failure mode.
 */
export async function registerDevicePush(jwt: string): Promise<void> {
  const N = notifications();
  if (!N) {
    throw new Error('Push needs a newer build of the app — it works on the store build.');
  }
  let perms = await N.getPermissionsAsync().catch(() => null);
  if (!perms || (perms.status !== 'granted' && perms.canAskAgain !== false)) {
    perms = await N.requestPermissionsAsync().catch(() => null);
  }
  if (!perms || perms.status !== 'granted') {
    throw new Error('Notifications are off for BargainHuntrs — enable them in system Settings.');
  }
  const t = await N.getDevicePushTokenAsync().catch((e) => {
    throw new Error(
      `Could not mint a device token — ${e instanceof Error ? e.message : 'push not configured in this build.'}`,
    );
  });
  if (!t?.data) throw new Error('Could not mint a device token on this build.');
  await api('/api/v1/notifications/push/register', { token: jwt, body: { token: t.data } });
}

export async function unregisterDevicePush(jwt: string): Promise<void> {
  await api('/api/v1/notifications/push/unregister', { method: 'DELETE', token: jwt });
}

/** POST /push/test — the backend fires a real push at the stored token. */
export async function sendTestPush(jwt: string): Promise<void> {
  await api('/api/v1/notifications/push/test', {
    token: jwt,
    body: {
      title: 'BargainHuntrs test alert',
      body: 'Push is wired — deal alerts will land here.',
    },
  });
}
