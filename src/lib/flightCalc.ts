// Flight calculator for the Mini App: same rules as the bots' /calc and /snk, evaluated on the device.

export interface TimeResult {
  hm: string;
  text: string;
  totalMinutes: number;
}

export interface SnkResult {
  hm: string;
  text: string;
  decimal: string;
}

function formatMinutes(totalMinutes: number): TimeResult {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const hours = Math.floor(abs / 60);
  const mm = String(abs % 60).padStart(2, '0');
  return { hm: `${sign}${hours}:${mm}`, text: `${sign}${hours}ч ${mm}м`, totalMinutes };
}

/** Flight time sums in hh:mm. ':', '.' and ',' all separate hours from minutes; a bare number is whole hours. */
export function calcTime(input: string): TimeResult | null {
  const norm = input.trim().replace(/[.,]/g, ':');
  if (!norm || !/^[\d:+\-\s]+$/.test(norm)) return null;
  const regex = /([+-]?)\s*(\d+)(?::([0-5]?\d))?/g;
  let total = 0;
  let count = 0;
  for (let match = regex.exec(norm); match; match = regex.exec(norm)) {
    const sign = match[1] === '-' ? -1 : 1;
    total += sign * (Number(match[2]) * 60 + (match[3] !== undefined ? Number(match[3]) : 0));
    count++;
  }
  return count > 0 ? formatMinutes(total) : null;
}

/** Hour meter (СНК) readings are decimal hours: sum them, then convert to hh:mm rounded to whole minutes. */
export function calcSnk(input: string): SnkResult | null {
  const value = evaluate(input);
  if (value === null) return null;
  const minutes = Math.round(Math.round(Math.abs(value) * 3600) / 60);
  const sign = value < 0 ? '-' : '';
  const mm = String(minutes % 60).padStart(2, '0');
  return {
    hm: `${sign}${Math.floor(minutes / 60)}:${mm}`,
    text: `${sign}${Math.floor(minutes / 60)}ч ${mm}м`,
    decimal: formatNumber(value),
  };
}

/** Plain arithmetic: + - * / and parentheses, ',' or '.' as the decimal point. */
export function calcStandard(input: string): string | null {
  const value = evaluate(input);
  return value === null ? null : formatNumber(value);
}

export function formatNumber(value: number): string {
  return String(Number(value.toFixed(6))).replace('.', ',');
}

// Small recursive-descent parser instead of eval/Function: only numbers, + - * / and parentheses.
export function evaluate(input: string): number | null {
  const text = input.replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!text) return null;
  let pos = 0;

  const peek = () => text[pos];
  function number(): number | null {
    const match = /^\d*\.?\d+|^\d+\.?/.exec(text.slice(pos));
    if (!match) return null;
    pos += match[0].length;
    return Number(match[0]);
  }
  function factor(): number | null {
    if (peek() === '-') { pos++; const v = factor(); return v === null ? null : -v; }
    if (peek() === '+') { pos++; return factor(); }
    if (peek() === '(') {
      pos++;
      const v = expression();
      if (v === null || peek() !== ')') return null;
      pos++;
      return v;
    }
    return number();
  }
  function term(): number | null {
    let left = factor();
    while (left !== null && (peek() === '*' || peek() === '/')) {
      const op = text[pos++];
      const right = factor();
      if (right === null) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function expression(): number | null {
    let left = term();
    while (left !== null && (peek() === '+' || peek() === '-')) {
      const op = text[pos++];
      const right = term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = expression();
  return result !== null && pos === text.length && Number.isFinite(result) ? result : null;
}
