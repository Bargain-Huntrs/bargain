"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authService, AUTH_CHANGED_EVENT, type AuthUser } from "@/lib/authService";

interface AuthContextType {
  user: AuthUser | null;
  idToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  idToken: null,
  isAuthenticated: false,
  loading: true,
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadAuth() {
    const token = authService.getToken();
    const currentUser = authService.getUser();
    setIdToken(token);
    setUser(currentUser);
    setLoading(false);
  }

  useEffect(() => {
    queueMicrotask(loadAuth);

    function handleStorage(event: StorageEvent) {
      if (event.key === "bargain_auth_token" || event.key === "bargain_user_data") {
        loadAuth();
      }
    }

    // `storage` only fires in OTHER tabs — same-tab logins signal via the
    // custom event so the context doesn't serve a stale user=null after
    // router.push("/dashboard").
    function handleAuthChanged() {
      loadAuth();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, []);

  function logout() {
    authService.logout();
    setUser(null);
    setIdToken(null);
  }

  function refresh() {
    loadAuth();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        isAuthenticated: !!idToken && !!user,
        loading,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
