// Session service — access + refresh JWTs live in the OS keychain
// (expo-secure-store) with an AsyncStorage fallback for environments where
// the native module isn't linked (same pattern as clipstakes-mobile).
// User profile + the onboarding flag are plain AsyncStorage — not credentials.
//
// bargain-api auth flow (FastAPI, /api/v1/auth):
//   POST /login | /register → {accessToken(1h), refreshToken(14d), user}
//   POST /refresh {token: refreshToken} → {accessToken, expiresIn}
//   GET  /me (Bearer accessToken) → profile
// The refresh token is also stored server-side on the user row — a 401 from
// /refresh means the session was rotated/revoked; the app signs out.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api, fetchMe, type MeProfile } from './api';
import { cacheClear } from './cache';

const TOKEN_KEY = 'bargain.token';
const REFRESH_KEY = 'bargain.refresh';
const USER_KEY = 'bargain.user';
export const ONBOARD_KEY = 'bargain.onboarded.v1';

export type SessionUser = MeProfile;

// ---- storage --------------------------------------------------------------

async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(key);
    if (v !== null) return v;
    // fall through — may have been written by the AsyncStorage fallback
  } catch {
    /* native module missing — use AsyncStorage */
  }
  return AsyncStorage.getItem(key);
}

async function secureDel(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
  await AsyncStorage.removeItem(key).catch(() => {});
}

// ---- jwt ------------------------------------------------------------------

/** Decode the exp claim — tokens are self-issued {sub,exp,type?} JWTs. */
export function isJwtExpired(token: string, skewMs = 30000): boolean {
  try {
    const payload = JSON.parse(
      decodeURIComponent(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    );
    return !payload.exp || payload.exp * 1000 < Date.now() + skewMs;
  } catch {
    return true;
  }
}

// ---- session --------------------------------------------------------------

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: MeProfile & { phoneNumber?: string | null };
}

async function storeSession(res: AuthResponse): Promise<SessionUser> {
  await secureSet(TOKEN_KEY, res.accessToken);
  if (res.refreshToken) await secureSet(REFRESH_KEY, res.refreshToken);
  const user = res.user as SessionUser;
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
  return user;
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const res = await api<AuthResponse>('/api/v1/auth/login', { body: { email, password } });
  return storeSession(res);
}

/**
 * Register — bargain-api requires an E.164 phone number on signup (the site
 * verifies it via Firebase; the token is optional, so mobile signs up with a
 * valid-format number and phone_verified stays false until verified on web).
 */
export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phoneNumber: string,
): Promise<SessionUser> {
  const res = await api<AuthResponse>('/api/v1/auth/register', {
    body: { email, password, firstName, lastName, phoneNumber },
  });
  return storeSession(res);
}

/** Swap the 14-day refresh token for a fresh 1-hour access token. */
async function refreshAccess(): Promise<string | null> {
  const refreshToken = await secureGet(REFRESH_KEY);
  if (!refreshToken || isJwtExpired(refreshToken)) return null;
  try {
    const res = await api<{ accessToken: string }>('/api/v1/auth/refresh', {
      body: { token: refreshToken },
    });
    await secureSet(TOKEN_KEY, res.accessToken);
    return res.accessToken;
  } catch (e: any) {
    if (e?.status === 401) return null; // revoked/rotated — hard sign-out
    throw e; // network — caller decides
  }
}

/**
 * A usable access token: returns the stored one when fresh, otherwise tries
 * /refresh. Null means signed out for real.
 */
export async function getFreshToken(): Promise<string | null> {
  const token = await secureGet(TOKEN_KEY);
  if (token && !isJwtExpired(token)) return token;
  try {
    return await refreshAccess();
  } catch {
    return token; // network down — return the stale token, calls will retry
  }
}

export interface StoredSession {
  token: string;
  user: SessionUser | null;
  /** true when the token is present but /me couldn't confirm it. */
  unverified?: boolean;
}

/**
 * Restore at boot: read the keychain tokens + cached profile, refresh the
 * access token if stale, then confirm with GET /me. A 401 clears the session;
 * a network failure keeps it (unverified) so the app still opens offline.
 */
export async function restore(): Promise<StoredSession | null> {
  const token = await getFreshToken();
  if (!token) {
    await signOut();
    return null;
  }
  const cached = await AsyncStorage.getItem(USER_KEY)
    .then((raw) => (raw ? (JSON.parse(raw) as SessionUser) : null))
    .catch(() => null);
  try {
    const user = await fetchMe(token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
    return { token, user };
  } catch (e: any) {
    if (e?.status === 401) {
      await signOut();
      return null;
    }
    return { token, user: cached, unverified: true };
  }
}

export async function refreshUser(token: string): Promise<SessionUser | null> {
  const user = await fetchMe(token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => {});
  return user;
}

export async function signOut(): Promise<void> {
  await secureDel(TOKEN_KEY);
  await secureDel(REFRESH_KEY);
  await AsyncStorage.removeItem(USER_KEY).catch(() => {});
  await cacheClear('watchlist').catch(() => {}); // user-scoped snapshots
}

export const getToken = () => getFreshToken();
