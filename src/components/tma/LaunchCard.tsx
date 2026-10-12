import React from 'react';
import { ChevronDown, Fuel, Trash2 } from 'lucide-react';
import { triggerHaptic } from '@/lib/telegram';
import type { LaunchDraft } from '@/lib/tmaService';

interface LaunchCardProps {
  launch: LaunchDraft;
  index: number;
  onUpdate: (updated: LaunchDraft) => void;
  onDelete: () => void;
}

const inputClass = 'w-full min-w-0 rounded-lg border border-[#3A3A3C] bg-[#1C1C1E] px-2 py-2 text-center text-[14px] font-semibold text-[#F0F0F0] outline-none focus:border-[#229ED9] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const labelClass = 'mb-1 block text-center text-[10px] font-medium text-[#999]';

interface TimeFieldProps {
  field: 'vsu' | 'zemlya' | 'vozduh' | 'tp';
  label: string;
  value: number | undefined;
  onChange: (field: 'vsu' | 'zemlya' | 'vozduh' | 'tp', val: string) => void;
}

const TimeField: React.FC<TimeFieldProps> = ({ field, label, value, onChange }) => (
  <label className="min-w-0">
    <span className={labelClass}>{label}</span>
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value || ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder="0"
        className={inputClass + ' pr-7'}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#777]">мин</span>
    </div>
  </label>
);

export const LaunchCard: React.FC<LaunchCardProps> = ({ launch, index, onUpdate, onDelete }) => {
  const setNumber = (field: keyof LaunchDraft, value: string, integer = false) => {
    const parsed = integer ? parseInt(value, 10) : parseFloat(value.replace(',', '.'));
    onUpdate({ ...launch, [field]: value === '' || Number.isNaN(parsed) ? undefined : Math.max(0, parsed) });
  };

  const setText = (field: keyof LaunchDraft, value: string) => {
    onUpdate({ ...launch, [field]: value });
  };

  const changeCount = (field: 'samoletLandings', delta: number) => {
    triggerHaptic('light');
    onUpdate({ ...launch, [field]: Math.max(0, (launch[field] || 0) + delta) });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#F0F0F0]">Запуск №{index + 1}</span>
        <button
          onClick={() => { triggerHaptic('medium'); onDelete(); }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777] transition-colors hover:bg-[#FF453A]/10 hover:text-[#FF453A]"
          aria-label="Удалить запуск"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <TimeField field="vsu" label="ВСУ" value={launch.vsu} onChange={(f, val) => setNumber(f, val, true)} />
        <TimeField field="zemlya" label="Земля" value={launch.zemlya} onChange={(f, val) => setNumber(f, val, true)} />
        <TimeField field="vozduh" label="Воздух" value={launch.vozduh} onChange={(f, val) => setNumber(f, val, true)} />
      </div>

      <div className="space-y-2 rounded-xl border border-[#3A3A3C] bg-[#1C1C1E] p-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#D8D8D8]">
          <Fuel className="h-4 w-4 text-[#229ED9]" />
          Заправка
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="min-w-0">
            <span className={labelClass}>Литры</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={launch.fuelingLiters ?? ''}
              onChange={(e) => setNumber('fuelingLiters', e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </label>
          <label className="min-w-0">
            <span className={labelClass}>Плотность</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              value={launch.fuelDensity ?? ''}
              onChange={(e) => setNumber('fuelDensity', e.target.value)}
              placeholder="0,800"
              className={inputClass}
            />
          </label>
          <label className="min-w-0">
            <span className={labelClass}>Ведомость</span>
            <input
              type="text"
              value={launch.fuelStatement ?? ''}
              onChange={(e) => setText('fuelStatement', e.target.value)}
              placeholder="№"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <details className="group rounded-xl border border-[#3A3A3C] bg-[#1C1C1E]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-[12px] font-medium text-[#BBB]">
          Турбопривод и посадки
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 border-t border-[#3A3A3C] p-3">
          <TimeField field="tp" label="Турбопривод" value={launch.tp} onChange={(f, val) => setNumber(f, val, true)} />
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#BBB]">Посадки по-самолётному</span>
            <div className="flex items-center gap-2">
              <button onClick={() => changeCount('samoletLandings', -1)} className="h-9 w-9 rounded-lg bg-[#3A3A3C] text-[16px] font-bold text-[#CCC]">−</button>
              <span className="w-7 text-center text-[14px] font-bold text-[#F0F0F0]">{launch.samoletLandings || 0}</span>
              <button onClick={() => changeCount('samoletLandings', 1)} className="h-9 w-9 rounded-lg bg-[#229ED9] text-[16px] font-bold text-white">+</button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};
