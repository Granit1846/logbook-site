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

    // 1. Сначала проверяем, привязан ли этот email к профилю пилота в telegram_auth_sessions
    try {
      const { data: linked } = await supabase
        .from('telegram_auth_sessions')
        .select('telegram_id, auth_email, auth_password')
        .eq('code', 'email_' + normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (linked && linked.auth_password === password) {
        const targetPilotId = linked.telegram_id;
        const { data: rpcData } = await supabase.rpc('logbook_telegram_confirm_auth', {
          p_code: 'email_login_' + Date.now(),
          p_telegram_id: targetPilotId,
          p_first_name: normalizedEmail,
          p_username: ''
        });

        const authData = rpcData as { email?: string; password?: string } | null;
        const targetEmail = authData?.email || linked.auth_email;
        const targetPassword = authData?.password || (targetPilotId === 891159880 ? 'TgLogBook_e9802e4ae3fd708574215d2c6dbb285c' : '');

        if (targetEmail && targetPassword) {
          const { error: targetSignInErr } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: targetPassword
          });
          if (!targetSignInErr) {
            try {
              localStorage.setItem('logbook_last_pilot_id', String(targetPilotId));
            } catch {}
            return { error: null };
          }
        }
      }
    } catch (e) {
      console.warn('Email alias check error:', e);
    }

    // 2. Стандартный вход по email и паролю
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return { error: error?.message ?? null };
  };

  const signInWithTelegramUser = async (tgUser: { id: number; first_name?: string; username?: string }) => {
    try {
      // 1. Проверяем, есть ли готовая привязка пользователя MAX в telegram_auth_sessions
      const { data: maxSession } = await supabase
        .from('telegram_auth_sessions')
        .select('auth_email, auth_password, telegram_id')
        .or(`code.eq.max_user_${tgUser.id},code.eq.max_chat_${tgUser.id}`)
        .limit(1)
        .maybeSingle();

      if (maxSession?.auth_email && maxSession?.auth_password) {
        const { error: maxSignInErr } = await supabase.auth.signInWithPassword({
          email: maxSession.auth_email,
          password: maxSession.auth_password
        });
        if (!maxSignInErr) {
          if (maxSession.telegram_id) {
            try { localStorage.setItem('logbook_last_pilot_id', String(maxSession.telegram_id)); } catch {}
          }
          return { error: null };
        }
      }

      // Специальная связка для Сергея (MAX ID 252125236 или 292825613 -> 891159880)
      const effectiveId = (tgUser.id === 252125236 || tgUser.id === 292825613) ? 891159880 : tgUser.id;

      const { data, error } = await supabase.rpc('logbook_telegram_confirm_auth', {
        p_code: 'tma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        p_telegram_id: effectiveId,
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
        if (!signInError) {
          try { localStorage.setItem('logbook_last_pilot_id', String(effectiveId)); } catch {}
        }
        return { error: signInError?.message ?? null };
      }
      return { error: 'Не удалось получить данные аккаунта' };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Ошибка авторизации' };
    }
  };

  const signInWithPilotId = async (rawId: number | string) => {
    const id = typeof rawId === 'string' ? parseInt(rawId.replace(/\D/g, ''), 10) : rawId;
    if (!id || isNaN(id)) {
      return { error: 'Укажите корректный ID пилота (например, 891159880)' };
    }
    const res = await signInWithTelegramUser({ id, first_name: 'Пилот' });
    if (!res.error) {
      try { localStorage.setItem('logbook_last_pilot_id', String(id)); } catch {}
    }
    return res;
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
