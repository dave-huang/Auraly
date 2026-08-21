import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getToken } from './api';
import {
  deleteAccount as doDeleteAccount,
  fetchCurrentUser,
  signOut as doSignOut,
  type AuthUser,
} from './auth';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      setUser(await fetchCurrentUser());
    } catch {
      // Token invalid/expired (apiFetch already cleared it) or the API is
      // unreachable — either way, treat as signed out.
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await doSignOut();
    setUser(null);
  }, []);

  // Throws if the server refuses, and deliberately leaves the user signed in
  // when it does — a screen that says "deleted" over an account that still
  // exists is the worst outcome here.
  const deleteAccount = useCallback(async () => {
    await doDeleteAccount();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, setUser, signOut, deleteAccount, refresh }),
    [user, isLoading, signOut, deleteAccount, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
