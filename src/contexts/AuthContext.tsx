import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'jeriko1846@yandex.ru';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithTelegramUser: (tgUser: { id: number; first_name?: string; username?: string }) => Promise<{ error: string | null }>;
  signInWithPilotId: (pilotId: number | string) => Promise<{ error: string | null }>;
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return { error: error?.message ?? null };
  };

  const signInWithTelegramUser = async (tgUser: { id: number; first_name?: string; username?: string }) => {
    try {
      const { data, error } = await supabase.rpc('logbook_telegram_confirm_auth', {
        p_code: 'tma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        p_telegram_id: tgUser.id,
        p_first_name: tgUser.first_name || '',
        p_username: tgUser.username || ''
      });
      if (error) {
        return { error: error.message };
      }
      const authData = data as { email?: string; password?: string } | null;
      if (authData?.email && authData?.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authData.email,
          password: authData.password
        });
        return { error: signInError?.message ?? null };
      }
      return { error: 'Не удалось получить данные аккаунта Telegram' };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Ошибка авторизации через Telegram' };
    }
  };

  const signInWithPilotId = async (rawId: number | string) => {
    const id = typeof rawId === 'string' ? parseInt(rawId.replace(/\D/g, ''), 10) : rawId;
    if (!id || isNaN(id)) {
      return { error: 'Укажите корректный ID пилота (например, 891159880)' };
    }
    return signInWithTelegramUser({ id, first_name: 'Пилот' });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, isAdmin: session?.user?.email === ADMIN_EMAIL, loading, signIn, signInWithTelegramUser, signInWithPilotId, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
