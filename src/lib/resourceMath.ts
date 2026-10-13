export type ResourceStatus = 'normal' | 'warning' | 'critical' | 'expired';

export function aggregateSne(fuselageSne: number, installedAtSne1: number, installedAtSne2: number, isFuselage: boolean): number {
  return isFuselage ? fuselageSne : fuselageSne - installedAtSne1 + installedAtSne2;
}

export function oilRemaining(fuselageSne: number, filledAtSne: number, limit: number): number {
  return filledAtSne + limit - fuselageSne;
}

export function hourStatus(remainingMinutes: number, kind: 'aggregate' | 'oil'): ResourceStatus {
  if (remainingMinutes < 0) return 'expired';
  const [warning, critical] = kind === 'aggregate' ? [100, 25] : [50, 20];
  if (remainingMinutes <= critical * 60) return 'critical';
  if (remainingMinutes <= warning * 60) return 'warning';
  return 'normal';
}

export function parseResourceDate(value?: string): Date | null {
  if (!value) return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;
  const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const result = new Date(year, Number(match[2]) - 1, Number(match[1]));
  return result.getFullYear() === year && result.getMonth() === Number(match[2]) - 1 && result.getDate() === Number(match[1])
    ? result : null;
}

export function resourceExpiry(dateValue: string | undefined, termValue: string | undefined, kind: 'aggregate' | 'oil'): Date | null {
  const start = parseResourceDate(dateValue);
  if (!start || !termValue) return null;
  const term = Number(termValue.trim().replace(',', '.'));
  if (!Number.isFinite(term) || term < 0) return null;
  const units = Math.round(term * (kind === 'aggregate' ? 365 : 12));
  const result = new Date(start);
  if (kind === 'aggregate') result.setDate(result.getDate() + units);
  else {
    const targetMonth = result.getMonth() + units;
    result.setDate(1);
    result.setMonth(targetMonth);
    result.setDate(Math.min(start.getDate(), new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  }
  return result;
}

export function calendarDaysBetween(today: Date, expiry: Date): number {
  return Math.round((Date.UTC(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()) -
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
}

export function addCalendarMonths(start: Date, months: number): Date {
  const result = new Date(start);
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  result.setDate(Math.min(start.getDate(), new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  return result;
}

export function maintenanceStatus(elapsed: number, lower: number, nominal: number, upper: number): ResourceStatus {
  if (elapsed > upper) return 'expired';
  if (elapsed >= nominal) return 'critical';
  if (elapsed >= lower) return 'warning';
  return 'normal';
}

export function resourceCalendarStatus(today: Date, expiry: Date, kind: 'aggregate' | 'oil'): ResourceStatus {
  if (calendarDaysBetween(today, expiry) < 0) return 'expired';
  const months = (expiry.getFullYear() - today.getFullYear()) * 12 + expiry.getMonth() - today.getMonth() -
    (expiry.getDate() < today.getDate() ? 1 : 0);
  if (months <= 1) return 'critical';
  if (months <= 2) return kind === 'oil' ? 'warning' : 'critical';
  if (months <= 3 && kind === 'aggregate') return 'warning';
  return 'normal';
}
