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

/**
 * Flight time in hh:mm. ':', '.' and ',' all separate hours from minutes; a bare number is whole hours.
 * Products repeat a time: each term may hold one time value times whole-number counts (0:45 × 3, 3 × 0:45);
 * if no factor has minutes, the first factor is the hours. A trailing operator is ignored while typing.
 */
export function calcTime(input: string): TimeResult | null {
  const norm = input.replace(/\s+/g, '').replace(/[.,]/g, ':').replace(/[×*]/g, '*').replace(/−/g, '-');
  if (!norm || !/^[\d:+\-*]+$/.test(norm)) return null;
  const tokens = norm.match(/[+\-*]|\d+(?::\d{0,2})?/g) ?? [];
  if (tokens.join('') !== norm) return null;

  let i = 0;
  let total = 0;
  let sign = 1;
  if (tokens[0] === '+' || tokens[0] === '-') sign = tokens[i++] === '-' ? -1 : 1;
  while (i < tokens.length) {
    const factors: string[] = [];
    while (i < tokens.length && /^\d/.test(tokens[i])) {
      factors.push(tokens[i++]);
      if (tokens[i] === '*') i++;
      else break;
    }
    if (factors.length === 0) return null;
    const times = factors.filter((factor) => factor.includes(':'));
    if (times.length > 1) return null;
    const timeFactor = times[0] ?? factors[0];
    const [hours, digits = ''] = timeFactor.split(':');
    // One digit after the separator is tens of minutes, as written on paper: 12,2 = 12:20.
    const minutes = digits.length === 1 ? Number(digits) * 10 : Number(digits || 0);
    if (minutes > 59) return null;
    let term = Number(hours) * 60 + minutes;
    let usedTime = false;
    for (const factor of factors) {
      if (factor === timeFactor && !usedTime) { usedTime = true; continue; }
      term *= Number(factor);
    }
    total += sign * term;
    if (i >= tokens.length) break;
    if (tokens[i] !== '+' && tokens[i] !== '-') return null;
    sign = tokens[i++] === '-' ? -1 : 1;
  }
  return formatMinutes(total);
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
