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
        chat?: { id?: number };
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
      HapticFeedback?: {
        impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
        notificationOccurred?: (type: 'success' | 'warning' | 'error') => void;
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
  return Boolean(max?.initData || max?.platform || new URLSearchParams(window.location.hash.slice(1)).has('WebAppData'));
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    if (isRunningInMax()) {
      const max = getMaxWebApp();
      max?.HapticFeedback?.impactOccurred?.(style);
    } else if (isRunningInTelegram()) {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred?.(style);
    }
  } catch {
    // ignore
  }
}

export function triggerHapticNotification(type: 'success' | 'warning' | 'error') {
  try {
    if (isRunningInMax()) {
      const max = getMaxWebApp();
      max?.HapticFeedback?.notificationOccurred?.(type);
    } else if (isRunningInTelegram()) {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred?.(type);
    }
  } catch {
    // ignore
  }
}
