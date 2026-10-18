import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Send, CheckCircle2,
  AlertCircle, Clock,
} from 'lucide-react';
import { LaunchCard } from './LaunchCard';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { triggerHaptic, triggerHapticNotification, getTelegramWebApp, isRunningInTelegram } from '@/lib/telegram';
import { TelegramMiniAppService, type FlightEntryDraft, type LaunchDraft, type SnkDraft } from '@/lib/tmaService';

interface FlightsTabProps {
  activeBoard: string;
}

const SNK_FIELDS = ['a', 'b', 'e', 'g', 'h', 'i'] as const;

const createLaunch = (id: string): LaunchDraft => ({
  id,
  vsu: 0,
  zemlya: 0,
  vozduh: 0,
  tp: 0,
  samoletLandings: 0,
});

export const FlightsTab: React.FC<FlightsTabProps> = ({ activeBoard }) => {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [crew, setCrew] = useState('');
  const [snk, setSnk] = useState<SnkDraft>({});
  const [launches, setLaunches] = useState<LaunchDraft[]>([createLaunch('1')]);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalVozduh = launches.reduce((sum, launch) => sum + (launch.vozduh || 0), 0);
  const totalZemlya = launches.reduce((sum, launch) => sum + (launch.zemlya || 0), 0);
  const totalVsu = launches.reduce((sum, launch) => sum + (launch.vsu || 0), 0);
  const totalFuelLiters = launches.reduce((sum, launch) => sum + (launch.fuelingLiters || 0), 0);
  const totalFuelKg = launches.reduce(
    (sum, launch) => sum + (launch.fuelingLiters || 0) * (launch.fuelDensity || 0),
    0,
  );

  const formatHM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}ч ${m.toString().padStart(2, '0')}м` : `${m} мин`;
  };

  const formatAmount = (value: number) => value.toLocaleString('ru-RU', {
    maximumFractionDigits: 2,
  });

  const shiftDate = (delta: number) => {
    triggerHaptic('light');
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + delta);
    setDate(nextDate.toISOString().split('T')[0]);
  };

  // Swipe left/right flips to the next/previous day, like the arrows around the date.
  const { ref: swipeRef, swipeProps } = useHorizontalSwipe<HTMLDivElement>({ onPrev: () => shiftDate(-1), onNext: () => shiftDate(1) });

  const formatDateDisplay = (iso: string) => {
    const value = new Date(iso);
    return value.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const updateSnk = (field: keyof SnkDraft, value: string) => {
    const parsed = parseFloat(value.replace(',', '.'));
    setSnk((current) => ({
      ...current,
      [field]: value === '' || Number.isNaN(parsed) ? undefined : parsed,
    }));
  };

  const handleAddLaunch = () => {
    triggerHaptic('medium');
    setLaunches([...launches, createLaunch(Date.now().toString())]);
  };

  const handleUpdateLaunch = (index: number, updated: LaunchDraft) => {
    const next = [...launches];
    next[index] = updated;
    setLaunches(next);
  };

  const handleDeleteLaunch = (index: number) => {
    if (launches.length <= 1) {
      triggerHapticNotification('warning');
      return;
    }
    setLaunches(launches.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async () => {
    triggerHaptic('heavy');
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const flightData: FlightEntryDraft = {
        id: `fl-${Date.now()}`,
        boardNumber: activeBoard,
        date,
        crew: crew.trim() || 'Экипаж',
        launches,
        snk,
        createdAt: Date.now(),
      };

      // Отправляем прямо в облако Supabase!
      const result = await TelegramMiniAppService.submitFlightToCloud(flightData);
      triggerHapticNotification('success');

      const successMsg = result.addedLaunches === 0
        ? 'Этот запуск уже записан. Повтор не добавлен.'
        : result.skippedDuplicates > 0
        ? `Добавлено запусков: ${result.addedLaunches}. Повторы пропущены. Синхронизируйте LogBook.`
        : 'Полёты отправлены. Запустите синхронизацию в LogBook на телефоне или ПК.';

      setStatusMessage({ text: successMsg, type: 'success' });
      setLaunches([createLaunch(Date.now().toString())]);
      setSnk({});

      if (isRunningInTelegram()) {
        try {
          const tg = getTelegramWebApp();
          if (tg && typeof tg.showAlert === 'function') {
            tg.showAlert(successMsg);
          }
        } catch {}
      }
    } catch (err) {
      triggerHapticNotification('error');
      const errText = err instanceof Error ? err.message : 'Ошибка отправки данных';
      setStatusMessage({ text: errText, type: 'error' });
      if (isRunningInTelegram()) {
        try {
          const tg = getTelegramWebApp();
          if (tg && typeof tg.showAlert === 'function') {
            tg.showAlert(errText);
          }
        } catch {}
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={swipeRef} {...swipeProps} className="space-y-3 px-3 pb-28 pt-3">
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-[#3A3A3C] bg-[#2A2A2D] px-2 py-1.5">
          <button onClick={() => shiftDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/5" aria-label="Предыдущий день">
            <ChevronLeft className="h-5 w-5 text-[#999]" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            <Calendar className="h-4 w-4 text-[#229ED9]" />
            <span className="whitespace-nowrap text-[13px] font-semibold">{formatDateDisplay(date)}</span>
          </div>
          <button onClick={() => shiftDate(1)} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/5" aria-label="Следующий день">
            <ChevronRight className="h-5 w-5 text-[#999]" />
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Экипаж / Лётчик"
        value={crew}
        onChange={(event) => setCrew(event.target.value)}
        className="w-full rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] px-3 py-2.5 text-[13px] text-[#F0F0F0] outline-none transition-colors placeholder:text-[#666] focus:border-[#229ED9]"
      />

      {statusMessage && (
        <div
          className="flex items-center gap-2 rounded-xl p-2.5 text-[12px] font-medium"
          style={{
            backgroundColor: statusMessage.type === 'success' ? 'rgba(48,209,102,0.1)' : 'rgba(255,69,58,0.1)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(48,209,102,0.2)' : 'rgba(255,69,58,0.2)'}`,
            color: statusMessage.type === 'success' ? '#30D066' : '#FF453A',
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 pt-1">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#999]">Запуски ({launches.length})</h3>
        </div>

        {launches.map((launch, index) => (
          <LaunchCard
            key={launch.id}
            launch={launch}
            index={index}
            onUpdate={(updated) => handleUpdateLaunch(index, updated)}
            onDelete={() => handleDeleteLaunch(index)}
          />
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] px-3 py-3">
        <h3 className="text-center text-[13px] font-bold text-[#F0F0F0]">СНК</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['Left', 'Right'] as const).map((side) => (
            <div key={side} className="space-y-1.5">
              <div className="text-center text-[11px] font-semibold text-[#999]">
                {side === 'Left' ? 'Левый' : 'Правый'}
              </div>
              {SNK_FIELDS.map((code) => {
                const field = `${code}${side}` as keyof SnkDraft;
                return (
                  <label key={field} className="flex items-center gap-2">
                    <span className="w-4 text-center text-[11px] font-semibold uppercase text-[#229ED9]">{code}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={snk[field] ?? ''}
                      onChange={(event) => updateSnk(field, event.target.value)}
                      placeholder="0"
                      className="min-w-0 flex-1 rounded-lg border border-[#3A3A3C] bg-[#1C1C1E] px-2 py-2 text-center text-[13px] text-[#F0F0F0] outline-none focus:border-[#229ED9]"
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] px-3 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#999]">Итого за день</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><span className="block text-[10px] text-[#777]">ВСУ</span><b className="text-[12px] text-[#F0F0F0]">{formatHM(totalVsu)}</b></div>
          <div><span className="block text-[10px] text-[#777]">Земля</span><b className="text-[12px] text-[#F0F0F0]">{formatHM(totalZemlya)}</b></div>
          <div><span className="block text-[10px] text-[#777]">Воздух</span><b className="text-[12px] text-[#F0F0F0]">{formatHM(totalVozduh)}</b></div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[#3A3A3C] pt-2 text-center">
          <div><span className="block text-[10px] text-[#777]">Заправка, л</span><b className="text-[13px] text-[#229ED9]">{formatAmount(totalFuelLiters)}</b></div>
          <div><span className="block text-[10px] text-[#777]">Заправка, кг</span><b className="text-[13px] text-[#229ED9]">{formatAmount(totalFuelKg)}</b></div>
        </div>
      </div>

      <button
        onClick={handleAddLaunch}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#229ED9] shadow-lg transition-transform active:scale-95"
        aria-label="Добавить запуск"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-[#3A3A3C] bg-[rgba(28,28,30,0.95)] p-3 backdrop-blur">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3.5 text-[14px] font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isSubmitting ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Отправить полёты в LogBook
        </button>
      </div>
    </div>
  );
};
