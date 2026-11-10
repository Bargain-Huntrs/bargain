// Auth state for the whole app — restores the keychain session at boot (the
// splash stays up until this resolves), then exposes sign in/up/out to screens.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  restore,
  signIn as svcSignIn,
  signUp as svcSignUp,
  signOut as svcSignOut,
  refreshUser,
  getFreshToken,
  type SessionUser,
} from '../services/auth';

type Status = 'restoring' | 'guest' | 'authed';

interface SignUpFields {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface AuthCtx {
  status: Status;
  user: SessionUser | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (f: SignUpFields) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  /** Fresh access token for authed API calls (refreshes the 1h JWT as needed). */
  freshToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    restore().then((s) => {
      if (cancelled) return;
      if (s) {
        setToken(s.token);
        setUser(s.user);
        setStatus('authed');
      } else {
        setStatus('guest');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await svcSignIn(email, password);
    setUser(u);
    setToken(await getFreshToken());
    setStatus('authed');
  }, []);

  const signUp = useCallback(async (f: SignUpFields) => {
    const u = await svcSignUp(f.email, f.password, f.firstName, f.lastName, f.phoneNumber);
    setUser(u);
    setToken(await getFreshToken());
    setStatus('authed');
  }, []);

  const signOut = useCallback(async () => {
    await svcSignOut();
    setUser(null);
    setToken(null);
    setStatus('guest');
  }, []);

  const reloadUser = useCallback(async () => {
    const t = await getFreshToken();
    if (!t) return;
    setToken(t);
    try {
      setUser(await refreshUser(t));
    } catch {
      /* keep cached profile on failure */
    }
  }, []);

  const freshToken = useCallback(async () => {
    const t = await getFreshToken();
    if (t) setToken(t);
    return t;
  }, []);

  const value = useMemo(
    () => ({ status, user, token, signIn, signUp, signOut, reloadUser, freshToken }),
    [status, user, token, signIn, signUp, signOut, reloadUser, freshToken],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
