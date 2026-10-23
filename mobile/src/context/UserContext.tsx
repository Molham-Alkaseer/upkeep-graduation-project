import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from 'i18next';
import { apiMe, type MeUser } from '../api';
import { syncLanguageWithAccountPreference } from '../i18n/accountLanguageSync';

type UserContextValue = {
  user: MeUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const { user: u } = await apiMe();
      setUser(u);
      void syncLanguageWithAccountPreference(u.preferred_language ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : i18n.t('errors.accountLoadFailed');
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, loading, error, refresh }),
    [user, loading, error, refresh],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
