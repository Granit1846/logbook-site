import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Gauge, Info, Plane, RefreshCw, Settings, UserCircle, X } from 'lucide-react';
import { FlightsTab } from './FlightsTab';
import { ResourcesTab } from './ResourcesTab';
import { useAuth } from '@/contexts/AuthContext';
import { TelegramMiniAppService, type CloudProfileData } from '@/lib/tmaService';
import { getTelegramWebApp, isRunningInTelegram, triggerHaptic } from '@/lib/telegram';

export const TelegramMiniApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'flights' | 'resources'>('flights');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(() => TelegramMiniAppService.getActiveBoard());
  const [cloudProfiles, setCloudProfiles] = useState<CloudProfileData[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lastPilotId, setLastPilotId] = useState(() => {
    try {
      return localStorage.getItem('logbook_last_pilot_id') || '';
    } catch {
      return '';
    }
  });
  const [pilotIdInput, setPilotIdInput] = useState(() => {
    try {
      return localStorage.getItem('logbook_last_pilot_id') || '';
    } catch {
      return '';
    }
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const { user, loading: authLoading, signIn, signInWithTelegramUser, signInWithPilotId, signOut } = useAuth();
  const inTelegram = isRunningInTelegram();
  const localProfiles = useMemo(() => TelegramMiniAppService.getBoards(), []);

  const loadCloudProfiles = useCallback(async () => {
    if (!user) {
      setCloudProfiles([]);
      setCloudError('');
      return;
    }
    setCloudLoading(true);
    setCloudError('');
    try {
      const profiles = await TelegramMiniAppService.getCloudProfiles();
      setCloudProfiles(profiles);
      if (profiles.length > 0) {
        const cloudMetaBoard = (user?.user_metadata as Record<string, unknown> | undefined)?.selected_board as string | undefined;
        const saved = cloudMetaBoard || TelegramMiniAppService.getActiveBoard();
        const board = profiles.some((profile) => profile.boardNumber === saved) ? saved : profiles[0].boardNumber;
        TelegramMiniAppService.setActiveBoard(board);
        setSelectedBoard(board);
      }
    } catch (error) {
      setCloudProfiles([]);
      setCloudError(error instanceof Error ? error.message : 'Не удалось загрузить данные из Supabase');
    } finally {
      setCloudLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadCloudProfiles(); }, [loadCloudProfiles]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser && !user && !authLoading && !authBusy) {
      setAuthBusy(true);
      signInWithTelegramUser(tgUser)
        .then((res) => {
          if (res.error) setAuthError(res.error);
        })
        .finally(() => setAuthBusy(false));
      return;
    }

    // Проверяем параметры автологина из URL (например, при открытии из MAX)
    if (!user && !authLoading && !authBusy && typeof window !== 'undefined') {
      try {
        const fullUrl = window.location.href;
        let authParam = '';

        const urlParams = new URLSearchParams(window.location.search);
        authParam = urlParams.get('auth') || '';

        const hashIdx = fullUrl.indexOf('#');
        if (!authParam && hashIdx !== -1) {
          const hashPart = fullUrl.substring(hashIdx);
          const hashQ = hashPart.indexOf('?');
          if (hashQ !== -1) {
            const hashParams = new URLSearchParams(hashPart.substring(hashQ));
            authParam = hashParams.get('auth') || '';
          }
        }

        if (authParam) {
          setAuthBusy(true);
          const base64 = authParam.replace(/-/g, '+').replace(/_/g, '/');
          const decoded = decodeURIComponent(escape(atob(base64)));
          const parsed = JSON.parse(decoded);
          if (parsed.e && parsed.p) {
            const idMatch = String(parsed.e).match(/^tg_(\d+)@telegram\.logbook$/);
            if (idMatch) {
              try {
                localStorage.setItem('logbook_last_pilot_id', idMatch[1]);
                setLastPilotId(idMatch[1]);
                setPilotIdInput(idMatch[1]);
              } catch {}
            }
            signIn(parsed.e, parsed.p)
              .then((res) => {
                if (res.error) {
                  setAuthError(res.error);
                } else {
                  // Очищаем токен из адресной строки
                  const cleanHash = (window.location.hash || '').split('?')[0] || '#app';
                  window.history.replaceState(null, '', window.location.pathname + cleanHash);
                }
              })
              .finally(() => setAuthBusy(false));
          } else {
            setAuthBusy(false);
          }
        }
      } catch (err) {
        console.warn('Auto-login error:', err);
        setAuthBusy(false);
      }
    }
  }, [user, authLoading, signInWithTelegramUser, signIn, authBusy]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        tg.setHeaderColor?.('#1C1C1E');
        tg.setBackgroundColor?.('#1C1C1E');
      } catch {
        // ignore if not supported by the client
      }
    }
  }, []);

  const profileOptions = user
    ? cloudProfiles.map((profile) => ({ id: profile.id, name: profile.name, boardNumber: profile.boardNumber }))
    : localProfiles;
  const activeCloudProfile = cloudProfiles.find((profile) => profile.boardNumber === selectedBoard);
  const tabLabel = activeTab === 'flights' ? 'Полёты' : 'Ресурсы';
  const accountLabel = authLoading ? 'Проверка аккаунта…' : user?.email || (inTelegram ? 'Вход не выполнен' : 'Локальный режим');

  const selectBoard = (boardNumber: string) => {
    triggerHaptic('light');
    TelegramMiniAppService.setActiveBoard(boardNumber);
    setSelectedBoard(boardNumber);
  };

  const closeDialog = () => {
    setSettingsOpen(false);
    setInfoOpen(false);
  };

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    const result = await signIn(email.trim(), password);
    setAuthBusy(false);
    if (result.error) setAuthError(result.error);
    else setPassword('');
  };

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md select-none flex-col bg-[#1C1C1E] text-[#F0F0F0]">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#3A3A3C] bg-[#2A2A2D] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <button onClick={() => { triggerHaptic('light'); if (inTelegram) getTelegramWebApp()?.close(); else { window.location.hash = ''; window.location.href = window.location.pathname; } }} className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5" aria-label="Назад"><ChevronLeft className="h-6 w-6" /></button>
          <span className="truncate text-[15px] font-semibold tracking-wide">{selectedBoard || '—'} / {tabLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { triggerHaptic('light'); setSettingsOpen(true); }} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5" aria-label="Настройки"><Settings className="h-5 w-5 text-[#999]" /></button>
          <button onClick={() => { triggerHaptic('light'); setInfoOpen(true); }} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/5" aria-label="Информация"><Info className="h-5 w-5 text-[#999]" /></button>
        </div>
      </header>

      <div className="mx-3 mt-3 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-[#888]"><UserCircle className="h-3.5 w-3.5 text-[#229ED9]" /><span className="truncate">{accountLabel}</span></div>
        <label className="relative block">
          <span className="sr-only">Активный профиль</span>
          <select value={selectedBoard} onChange={(event) => selectBoard(event.target.value)} disabled={profileOptions.length === 0} className="h-11 w-full appearance-none rounded-lg border border-[#3A3A3C] bg-[#1C1C1E] px-3 pr-10 text-[13px] font-semibold text-[#F0F0F0] outline-none focus:border-[#229ED9] disabled:text-[#666]">
            {profileOptions.length === 0 && <option value="">Нет профилей в Supabase</option>}
            {profileOptions.map((profile) => <option key={profile.id} value={profile.boardNumber}>{profile.name} · борт {profile.boardNumber}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
        </label>
        {!user && (
          <button
            type="button"
            onClick={async () => {
              triggerHaptic('light');
              const tgUser = getTelegramWebApp()?.initDataUnsafe?.user;
              if (lastPilotId) {
                setAuthBusy(true);
                setAuthError('');
                const res = await signInWithPilotId(lastPilotId);
                setAuthBusy(false);
                if (res.error) {
                  setSettingsOpen(true);
                  setAuthError(res.error);
                }
              } else if (tgUser) {
                setAuthBusy(true);
                setAuthError('');
                const res = await signInWithTelegramUser(tgUser);
                setAuthBusy(false);
                if (res.error) {
                  setSettingsOpen(true);
                  setAuthError(res.error);
                }
              } else {
                setSettingsOpen(true);
              }
            }}
            disabled={authBusy}
            className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-[#FFD60A]/30 bg-[#FFD60A]/10 px-3 py-2 text-left text-[11px] text-[#FFD60A] transition-colors hover:bg-[#FFD60A]/20 disabled:opacity-50"
          >
            <span>
              {authBusy
                ? 'Выполняется вход в профиль…'
                : lastPilotId
                ? `Войти в профиль пилота (${lastPilotId})`
                : 'Войти в профиль пилота (по ID)'}
            </span>
            <span className="font-semibold underline">
              {authBusy ? '⏳' : lastPilotId ? 'Войти в 1 клик ➔' : 'Ввести ID ➔'}
            </span>
          </button>
        )}
      </div>

      <div className="mx-3 mt-2 flex rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-1.5">
        <button onClick={() => { triggerHaptic('light'); setActiveTab('flights'); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold" style={{ backgroundColor: activeTab === 'flights' ? '#229ED9' : 'transparent', color: activeTab === 'flights' ? '#fff' : '#999' }}><Plane className="h-4 w-4" /> Полёты</button>
        <button onClick={() => { triggerHaptic('light'); setActiveTab('resources'); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold" style={{ backgroundColor: activeTab === 'resources' ? '#229ED9' : 'transparent', color: activeTab === 'resources' ? '#fff' : '#999' }}><Gauge className="h-4 w-4" /> Ресурсы</button>
      </div>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'flights'
          ? <FlightsTab activeBoard={selectedBoard} />
          : <ResourcesTab profile={activeCloudProfile} loading={cloudLoading} error={cloudError} onRefresh={() => void loadCloudProfiles()} />}
      </main>

      {(settingsOpen || infoOpen) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={closeDialog}>
          <section className="w-full max-w-md rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={settingsOpen ? 'Настройки Mini App' : 'О приложении'}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">{settingsOpen ? 'Настройки' : 'Что умеет Mini App'}</h2><button onClick={closeDialog} className="flex h-10 w-10 items-center justify-center rounded-lg text-[#999] hover:bg-white/5" aria-label="Закрыть"><X className="h-5 w-5" /></button></div>

            {settingsOpen ? (
              <div className="space-y-3 text-[12px] text-[#BBB]">
                {user ? (
                  <>
                    <div className="rounded-xl bg-[#1C1C1E] p-3"><span className="block text-[10px] uppercase text-[#777]">Активный аккаунт</span><span className="mt-1 block break-all font-semibold text-[#F0F0F0]">{user.email}</span></div>
                    <button onClick={() => void loadCloudProfiles()} disabled={cloudLoading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${cloudLoading ? 'animate-spin' : ''}`} />Обновить данные из Supabase</button>
                    <button
                      onClick={async () => {
                        setCloudLoading(true);
                        try {
                          const result = await TelegramMiniAppService.repairCloudFlightDates();
                          alert(result.dates || result.mergedDays
                            ? `Даты восстановлены: ${result.dates}, объединено дней: ${result.mergedDays}. Теперь запустите синхронизацию в LogBook.`
                            : 'Даты полётов в облаке уже в порядке.');
                        } catch (error) {
                          alert(error instanceof Error ? error.message : 'Не удалось восстановить даты полётов');
                        } finally {
                          setCloudLoading(false);
                        }
                      }}
                      disabled={cloudLoading}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#229ED9]/40 bg-[#229ED9]/10 font-semibold text-[#73C7F0] disabled:opacity-50"
                    >
                      Восстановить даты полётов
                    </button>
                    <button
                      onClick={async () => {
                        triggerHaptic('medium');
                        if (!window.confirm('Очистить записи полётов (дни/запуски) в облаке Supabase? Сами профили и ресурсы останутся нетронутыми.')) return;
                        try {
                          setCloudLoading(true);
                          const res = await TelegramMiniAppService.clearCloudDays();
                          triggerHaptic('heavy');
                          alert(`Облачные дни успешно очищены (ревизия ${res.revision})! Теперь синхронизация в приложении пройдет чисто.`);
                          void loadCloudProfiles();
                        } catch (e: unknown) {
                          const msg = e instanceof Error ? e.message : String(e);
                          alert(`Ошибка очистки: ${msg}`);
                        } finally {
                          setCloudLoading(false);
                        }
                      }}
                      disabled={cloudLoading}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FF453A]/40 bg-[#FF453A]/10 font-semibold text-[#FF453A] transition-colors hover:bg-[#FF453A]/20 disabled:opacity-50"
                    >
                      Очистить облачные дни (временная)
                    </button>
                    <button onClick={() => void signOut()} className="h-11 w-full rounded-xl border border-[#3A3A3C] text-[#CCC]">Выйти из аккаунта</button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2 rounded-xl bg-[#1C1C1E] p-3 border border-[#229ED9]/30">
                      <span className="block text-[11px] font-semibold text-[#229ED9]">
                        ✈️ Профиль пилота LogBook (MAX / Telegram)
                      </span>
                      <p className="text-[11px] text-[#AAA]">
                        Мгновенный вход в ваш аккаунт со всеми бортами и налётами:
                      </p>
                      {lastPilotId && (
                        <button
                          type="button"
                          onClick={async () => {
                            triggerHaptic('light');
                            setAuthBusy(true);
                            setAuthError('');
                            const res = await signInWithPilotId(lastPilotId);
                            setAuthBusy(false);
                            if (res.error) {
                              setAuthError(res.error);
                            } else {
                              setSettingsOpen(false);
                            }
                          }}
                          disabled={authBusy}
                          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] font-semibold text-white shadow transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                          {authBusy ? 'Вход…' : `Войти в профиль (${lastPilotId}) ➔`}
                        </button>
                      )}

                      <div className="pt-1 flex gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="ID пилота (Telegram / MAX)"
                          value={pilotIdInput}
                          onChange={(e) => setPilotIdInput(e.target.value)}
                          className="h-10 flex-1 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] px-3 text-[12px] outline-none focus:border-[#229ED9]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const trimmed = pilotIdInput.trim();
                            if (!trimmed) return;
                            triggerHaptic('light');
                            setAuthBusy(true);
                            setAuthError('');
                            const res = await signInWithPilotId(trimmed);
                            setAuthBusy(false);
                            if (res.error) {
                              setAuthError(res.error);
                            } else {
                              try {
                                localStorage.setItem('logbook_last_pilot_id', trimmed);
                                setLastPilotId(trimmed);
                              } catch {}
                              setSettingsOpen(false);
                            }
                          }}
                          disabled={authBusy}
                          className="h-10 px-3 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] text-[12px] font-semibold text-[#DDD] hover:bg-white/5 disabled:opacity-50"
                        >
                          Войти по ID
                        </button>
                      </div>
                      {authError && <p className="text-[#FF7068] text-[11px]">{authError}</p>}
                    </div>

                    <form onSubmit={submitLogin} className="space-y-2.5 pt-1">
                      <p className="text-[11px] text-[#888]">Или вход по электронной почте и паролю:</p>
                      <input type="email" autoComplete="email" required placeholder="Электронная почта" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-xl border border-[#3A3A3C] bg-[#1C1C1E] px-3 text-[13px] outline-none focus:border-[#229ED9]" />
                      <input type="password" autoComplete="current-password" required placeholder="Пароль" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-[#3A3A3C] bg-[#1C1C1E] px-3 text-[13px] outline-none focus:border-[#229ED9]" />
                      <button type="submit" disabled={authBusy} className="h-11 w-full rounded-xl border border-[#3A3A3C] bg-[#1C1C1E] font-semibold text-white hover:bg-white/5 disabled:opacity-50">{authBusy ? 'Вход…' : 'Войти по почте'}</button>
                    </form>
                  </div>
                )}
                <p>Настройки используются для входа в аккаунт, обновления данных Supabase и выхода. Профиль выбирается над вкладками.</p>
              </div>
            ) : (
              <ul className="space-y-2.5 text-[12px] text-[#CCC]">
                <li className="rounded-xl bg-[#1C1C1E] p-3"><b className="text-[#229ED9]">Полёты:</b> дата, экипаж, запуски, время ВСУ/земля/воздух, заправка, турбопривод, посадки и СНК.</li>
                <li className="rounded-xl bg-[#1C1C1E] p-3"><b className="text-[#229ED9]">Ресурсы:</b> просмотр агрегатов и масел выбранного профиля из Supabase без возможности изменения.</li>
                <li className="rounded-xl bg-[#1C1C1E] p-3"><b className="text-[#229ED9]">Журнал:</b> просмотр выполненных работ из окна «Журнал» LogBook.</li>
                <li className="rounded-xl bg-[#1C1C1E] p-3"><b className="text-[#229ED9]">Профили:</b> список профилей активного аккаунта; выбранный борт применяется к обеим вкладкам.</li>
              </ul>
            )}
            <button onClick={closeDialog} className="mt-4 h-11 w-full rounded-xl bg-[#229ED9] text-[13px] font-semibold text-white">Понятно</button>
          </section>
        </div>
      )}
    </div>
  );
};

export default TelegramMiniApp;
