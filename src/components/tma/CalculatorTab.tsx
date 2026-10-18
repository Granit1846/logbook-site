import { useState } from 'react';
import { Delete } from 'lucide-react';
import { calcSnk, calcStandard, calcTime } from '@/lib/flightCalc';
import { triggerHaptic } from '@/lib/telegram';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';

type Mode = 'time' | 'snk' | 'standard';

const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  {
    id: 'time',
    label: 'Время',
    hint: 'Налёт в чч:мм. Запятая отделяет минуты: 1,30 + 0,45 = 2:15; число без запятой — целые часы. Повтор одного значения: 0,45 × 3 = 2:15.',
  },
  {
    id: 'snk',
    label: 'СНК',
    hint: 'Показания счётчика наработки в десятичных часах: сумма переводится в чч:мм с округлением до минуты.',
  },
  {
    id: 'standard',
    label: 'Обычный',
    hint: 'Сложение, вычитание, умножение, деление и скобки. Например, масса топлива: литры × плотность.',
  },
];

// One layout for all modes; '0' spans two columns. Keys a mode cannot use are shown disabled.
const KEYS = [
  ['C', '(', ')', '⌫'],
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', ',', '+'],
];
const OPERATORS = ['+', '−', '×', '÷'];
const TIME_DISABLED = ['(', ')', '÷'];

function press(expr: string, key: string): string {
  if (key === 'C') return '';
  if (key === '⌫') return / [+−×÷] $/.test(expr) ? expr.slice(0, -3) : expr.slice(0, -1);
  if (OPERATORS.includes(key)) {
    // A new operator replaces a trailing one; a leading minus is allowed for negative numbers.
    const base = / [+−×÷] $/.test(expr) ? expr.slice(0, -3) : expr;
    if (!base) return key === '−' ? '−' : '';
    return `${base} ${key} `;
  }
  if (key === ',') {
    const lastNumber = expr.split(/[^\d,]/).pop() ?? '';
    if (lastNumber.includes(',')) return expr;
    return expr + (lastNumber ? ',' : '0,');
  }
  return expr + key;
}

export function CalculatorTab() {
  const [mode, setMode] = useState<Mode>('time');
  // Each mode keeps its own input, so switching modes does not lose what was typed.
  const [inputs, setInputs] = useState<Record<Mode, string>>({ time: '', snk: '', standard: '' });
  const current = MODES.find((item) => item.id === mode)!;
  const expr = inputs[mode];
  // Swipe left/right moves between the calculator modes.
  const modeIndex = MODES.findIndex((item) => item.id === mode);
  const { ref: swipeRef, swipeProps } = useHorizontalSwipe<HTMLDivElement>({
    onPrev: () => { triggerHaptic('light'); setMode(MODES[modeIndex - 1].id); },
    onNext: () => { triggerHaptic('light'); setMode(MODES[modeIndex + 1].id); },
    canPrev: modeIndex > 0,
    canNext: modeIndex < MODES.length - 1,
  });

  const onKey = (key: string) => {
    triggerHaptic('light');
    setInputs((prev) => ({ ...prev, [mode]: press(prev[mode], key).slice(0, 80) }));
  };

  // The display uses −, × and ÷; the calculator functions accept them.
  const trimmed = expr.trim().replace(/−/g, '-');
  let result: { main: string; details: string } | null = null;
  if (trimmed) {
    if (mode === 'time') {
      const time = calcTime(trimmed);
      if (time) result = { main: time.hm, details: `${time.text} · ${time.totalMinutes} мин` };
    } else if (mode === 'snk') {
      const snk = calcSnk(trimmed);
      if (snk) result = { main: snk.hm, details: `${snk.text} · сумма СНК ${snk.decimal}` };
    } else {
      const value = calcStandard(trimmed);
      if (value !== null) result = { main: value, details: '' };
    }
  }

  return (
    <div ref={swipeRef} {...swipeProps} className="space-y-3 p-3">
      <div className="flex rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-1" role="tablist" aria-label="Режим калькулятора">
        {MODES.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => { triggerHaptic('light'); setMode(item.id); }}
            className="flex-1 rounded-lg py-2 text-[13px] font-semibold"
            style={{ backgroundColor: mode === item.id ? '#229ED9' : 'transparent', color: mode === item.id ? '#fff' : '#999' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
        <p className="mb-3 text-[11px] leading-snug text-[#999]">{current.hint}</p>

        <div className="rounded-lg bg-[#1C1C1E] px-3 py-2.5" aria-live="polite">
          <div data-no-swipe className="min-h-[32px] overflow-x-auto whitespace-nowrap text-right text-[24px] font-semibold tracking-wide text-[#F0F0F0]" aria-label="Выражение">
            {expr || <span className="text-[#555]">0</span>}
          </div>
          <div className="mt-1 min-h-[52px] text-right">
            {result ? (
              <>
                <div className="text-[30px] font-bold leading-tight text-[#229ED9]">= {result.main}</div>
                {result.details && <div className="text-[12px] text-[#999]">{result.details}</div>}
              </>
            ) : (
              <div className="pt-3 text-[13px] text-[#666]">{trimmed ? 'Выражение не закончено' : 'Результат появится по мере ввода'}</div>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {KEYS.flat().map((key) => {
            const disabled = mode === 'time' && TIME_DISABLED.includes(key);
            const accent = OPERATORS.includes(key) || key === '(' || key === ')';
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onKey(key)}
                className={`flex h-14 items-center justify-center rounded-xl text-[22px] font-semibold active:bg-[#229ED9] disabled:opacity-25 ${key === '0' ? 'col-span-2' : ''} ${key === 'C' ? 'bg-[#3A2A2A] text-[#FF6B6B]' : accent ? 'bg-[#23323D] text-[#4FB8EA]' : 'bg-[#1C1C1E] text-[#F0F0F0]'}`}
                aria-label={key === '⌫' ? 'Стереть' : key === 'C' ? 'Очистить' : key}
              >
                {key === '⌫' ? <Delete className="h-6 w-6" /> : key}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
