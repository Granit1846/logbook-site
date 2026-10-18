import { useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { calcSnk, calcStandard, calcTime } from '@/lib/flightCalc';
import { triggerHaptic } from '@/lib/telegram';

type Mode = 'time' | 'snk' | 'standard';

const MODES: Array<{ id: Mode; label: string; hint: string; placeholder: string; keys: string[] }> = [
  {
    id: 'time',
    label: 'Время',
    hint: 'Налёт в чч:мм. Часы и минуты разделяйте точкой, запятой или двоеточием; число без разделителя — целые часы.',
    placeholder: '1,30 + 0,45',
    keys: [':', '+', '−'],
  },
  {
    id: 'snk',
    label: 'СНК',
    hint: 'Показания счётчика наработки в десятичных часах: сумма переводится в чч:мм с округлением до минуты.',
    placeholder: '1,45 + 1,61',
    keys: ['+', '−', '×', '÷', '(', ')'],
  },
  {
    id: 'standard',
    label: 'Обычный',
    hint: 'Сложение, вычитание, умножение, деление и скобки. Например, масса топлива: литры × плотность.',
    placeholder: '1650 × 0,789',
    keys: ['+', '−', '×', '÷', '(', ')'],
  },
];

export function CalculatorTab() {
  const [mode, setMode] = useState<Mode>('time');
  // Each mode keeps its own input, so switching modes does not lose what was typed.
  const [inputs, setInputs] = useState<Record<Mode, string>>({ time: '', snk: '', standard: '' });
  const field = useRef<HTMLInputElement>(null);
  const current = MODES.find((item) => item.id === mode)!;
  const expr = inputs[mode];
  const setExpr = (value: string) => setInputs((prev) => ({ ...prev, [mode]: value }));

  // The phone's decimal keypad has digits and a separator only; operators come from the row above the field.
  const edit = (change: (value: string, start: number, end: number) => { value: string; caret: number }) => {
    triggerHaptic('light');
    const el = field.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    const next = change(expr, start, end);
    setExpr(next.value);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };
  const insert = (text: string) => edit((value, start, end) => ({ value: value.slice(0, start) + text + value.slice(end), caret: start + text.length }));
  const backspace = () => edit((value, start, end) => start !== end
    ? { value: value.slice(0, start) + value.slice(end), caret: start }
    : { value: value.slice(0, Math.max(0, start - 1)) + value.slice(start), caret: Math.max(0, start - 1) });
  const clear = () => edit(() => ({ value: '', caret: 0 }));

  const trimmed = expr.trim();
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
    <div className="space-y-3 p-3">
      <div className="flex rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-1" role="tablist" aria-label="Режим калькулятора">
        {MODES.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={mode === item.id}
            onClick={() => { triggerHaptic('light'); setMode(item.id); requestAnimationFrame(() => field.current?.focus()); }}
            className="flex-1 rounded-lg py-2 text-[13px] font-semibold"
            style={{ backgroundColor: mode === item.id ? '#229ED9' : 'transparent', color: mode === item.id ? '#fff' : '#999' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[#3A3A3C] bg-[#2A2A2D] p-3">
        <p className="mb-3 text-[11px] leading-snug text-[#999]">{current.hint}</p>

        <div className="mb-2 flex gap-1.5">
          {current.keys.map((key) => (
            <button
              key={key}
              type="button"
              onPointerDown={(event) => event.preventDefault()} // keep the phone keyboard open
              onClick={() => insert(':()'.includes(key) ? key : ` ${key} `)}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#1C1C1E] text-[18px] font-semibold text-[#F0F0F0] active:bg-[#229ED9]"
              aria-label={`Вставить ${key}`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={backspace}
            className="flex h-11 w-12 items-center justify-center rounded-lg bg-[#1C1C1E] text-[#F0F0F0] active:bg-[#229ED9]"
            aria-label="Стереть символ"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        <label className="relative block">
          <span className="sr-only">Выражение</span>
          <input
            ref={field}
            value={expr}
            onChange={(event) => setExpr(event.target.value)}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            placeholder={current.placeholder}
            className="h-14 w-full rounded-lg border border-[#3A3A3C] bg-[#1C1C1E] px-3 pr-14 text-[22px] font-semibold tracking-wide text-[#F0F0F0] outline-none placeholder:text-[#555] focus:border-[#229ED9]"
          />
          {expr && (
            <button
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={clear}
              className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[13px] font-bold text-[#999] active:bg-white/5"
              aria-label="Очистить"
            >
              C
            </button>
          )}
        </label>

        <div className="mt-3 min-h-[72px] rounded-lg bg-[#1C1C1E] px-3 py-2.5" aria-live="polite">
          {result ? (
            <>
              <div className="text-[30px] font-bold leading-tight text-[#229ED9]">= {result.main}</div>
              {result.details && <div className="mt-0.5 text-[12px] text-[#999]">{result.details}</div>}
            </>
          ) : (
            <div className="pt-3 text-[13px] text-[#666]">{trimmed ? 'Выражение не закончено' : 'Результат появится по мере ввода'}</div>
          )}
        </div>
      </section>
    </div>
  );
}
