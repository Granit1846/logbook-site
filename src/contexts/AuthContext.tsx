import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getMaxWebApp, getTelegramWebApp, isRunningInMax, isRunningInTelegram } from '@/lib/telegram';
import type { Session, User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'jeriko1846@yandex.ru';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithTelegramUser: (user?: { id: number; first_name?: string; username?: string }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return { error: error?.message ?? null };
  };

  const signInWithTelegramUser = useCallback(async () => {
    const platform = isRunningInMax() ? 'max' : isRunningInTelegram() ? 'telegram' : null;
    const initData = platform === 'max' ? getMaxWebApp()?.initData : getTelegramWebApp()?.initData;
    if (!platform || !initData) return { error: 'Откройте приложение через кнопку в боте.' };
    try {
      // ASVS V2: server validates signed launch data; a client-provided user ID is ignored.
      const { data, error } = await supabase.functions.invoke('platform-auth', {
        body: { platform, initData },
      });
      if (error || !data?.tokenHash) return { error: 'Не удалось подтвердить вход. Откройте приложение заново из бота.' };
      const result = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'email' });
      return { error: result.error?.message ?? null };
    } catch {
      return { error: 'Не удалось подтвердить вход. Попробуйте открыть приложение заново.' };
    }
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      isAdmin: session?.user?.email === ADMIN_EMAIL,
      loading,
      signIn,
      signInWithTelegramUser,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
