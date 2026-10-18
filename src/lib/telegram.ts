// Telegram WebApp bridge and helpers

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: TelegramUser;
          query_id?: string;
          auth_date?: number;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        expand: () => void;
        close: () => void;
        ready: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
      };
    };
    TelegramWebviewProxy?: unknown;
    WebApp?: {
      initData?: string;
      initDataUnsafe?: {
        user?: TelegramUser;
        query_id?: string;
        auth_date?: number;
        hash?: string;
        start_param?: string;
      };
      platform?: string;
      version?: string;
      ready?: () => void;
      expand?: () => void;
      close?: () => void;
      setHeaderColor?: (color: string) => void;
      setBackgroundColor?: (color: string) => void;
      BackButton?: {
        isVisible: boolean;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
        show: () => void;
        hide: () => void;
      };
    };
  }
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function getMaxWebApp() {
  if (typeof window !== 'undefined' && window.WebApp) {
    return window.WebApp;
  }
  return null;
}

export function isRunningInTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = window.Telegram?.WebApp;
  return Boolean(tg && (tg.initData || tg.platform !== 'unknown'));
}

export function isRunningInMax(): boolean {
  if (typeof window === 'undefined') return false;
  const max = window.WebApp;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return Boolean(max && (max.initData || max.initDataUnsafe?.user || max.platform)) || /MAX/i.test(ua);
}

export function getAppPlatformUser(): TelegramUser | null {
  // 1. Telegram WebApp user
  const tgUser = getTelegramWebApp()?.initDataUnsafe?.user;
  if (tgUser && tgUser.id) return tgUser;

  // 2. MAX WebApp user
  const max = getMaxWebApp();
  const maxUser = max?.initDataUnsafe?.user;
  if (maxUser && maxUser.id) return maxUser;

  // 3. MAX WebApp chat (например, ID диалога или чата)
  if (max?.initDataUnsafe?.chat?.id) {
    const cid = Number(max.initDataUnsafe.chat.id);
    if (!isNaN(cid) && cid !== 0) {
      return { id: cid, first_name: 'MAX' };
    }
  }

  // 4. Параметры URL (search и hash: userId, user_id, uid, chatId, chat_id, id)
  if (typeof window !== 'undefined') {
    try {
      const fullUrl = window.location.href;
      const searchParams = new URLSearchParams(window.location.search);
      const hashPart = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashPart.includes('?') ? hashPart.substring(hashPart.indexOf('?') + 1) : hashPart);

      const findParam = (key: string) => searchParams.get(key) || hashParams.get(key);
      const rawId = findParam('userId') || findParam('user_id') || findParam('uid') || findParam('chatId') || findParam('chat_id') || findParam('pilotId') || findParam('id');
      if (rawId) {
        const parsed = parseInt(rawId.replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          return { id: parsed, first_name: 'Пилот' };
        }
      }
    } catch {}
  }

  // 5. Если запущен внутри MAX мессенджера — проверяем сохранённый ID пилота
  if (isRunningInMax() && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('logbook_last_pilot_id');
      if (saved) {
        const parsed = parseInt(saved.replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) {
          return { id: parsed, first_name: 'Пилот' };
        }
      }
    } catch {}
  }

  return null;
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  const tg = getTelegramWebApp();
  if (tg?.HapticFeedback) {
    try {
      tg.HapticFeedback.impactOccurred(style);
    } catch {
      // ignore
    }
  }
}

export function triggerHapticNotification(type: 'success' | 'warning' | 'error') {
  const tg = getTelegramWebApp();
  if (tg?.HapticFeedback) {
    try {
      tg.HapticFeedback.notificationOccurred(type);
    } catch {
      // ignore
    }
  }
}

