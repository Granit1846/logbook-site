type ExchangeRow = Record<string, unknown> & { id: string };

export interface FlightExchangeTables {
  days: ExchangeRow[];
  launches: ExchangeRow[];
  snk_values: ExchangeRow[];
}

export function cloudDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const legacy = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (legacy) return `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
  throw new Error(`Неподдерживаемая дата полёта в облаке: ${value}`);
}

function sameSnk(a: ExchangeRow, b: ExchangeRow): boolean {
  const fields = ['aLeft', 'bLeft', 'eLeft', 'gLeft', 'hLeft', 'iLeft',
    'aRight', 'bRight', 'eRight', 'gRight', 'hRight', 'iRight'];
  return fields.every((field) => Number(a[field] || 0) === Number(b[field] || 0));
}

/** Repairs the old Mini App date format without discarding launches or SNK. */
export function normalizeFlightDays(tables: FlightExchangeTables): { dates: number; mergedDays: number } {
  const byProfileAndDate = new Map<string, ExchangeRow>();
  const keptDays: ExchangeRow[] = [];
  const mergedDayIds = new Set<string>();
  let dates = 0;
  let mergedDays = 0;

  for (const day of tables.days) {
    const original = String(day.date ?? '');
    const normalized = cloudDate(original);
    if (original !== normalized) dates++;
    day.date = normalized;
    const key = `${String(day.profileId)}\u0000${normalized}`;
    const first = byProfileAndDate.get(key);
    if (!first) {
      byProfileAndDate.set(key, day);
      keptDays.push(day);
      continue;
    }

    const firstSnk = tables.snk_values.find((item) => String(item.dayId) === first.id);
    const duplicateSnk = tables.snk_values.find((item) => String(item.dayId) === day.id);
    if (firstSnk && duplicateSnk && !sameSnk(firstSnk, duplicateSnk)) {
      throw new Error(`Для борта и даты ${normalized} найдены разные значения СНК. Автоматическое объединение остановлено, данные сохранены.`);
    }

    for (const launch of tables.launches) {
      if (String(launch.dayId) === day.id) launch.dayId = first.id;
    }
    if (duplicateSnk) {
      if (firstSnk) {
        tables.snk_values = tables.snk_values.filter((item) => item !== duplicateSnk);
      } else {
        duplicateSnk.dayId = first.id;
      }
    }
    if (!String(first.crew ?? '').trim() && String(day.crew ?? '').trim()) first.crew = day.crew;
    mergedDays++;
    mergedDayIds.add(first.id);
  }

  tables.days = keptDays;
  for (const day of keptDays) {
    if (!mergedDayIds.has(day.id)) continue;
    tables.launches.filter((item) => String(item.dayId) === day.id)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
      .forEach((launch, index) => { launch.order = index; });
  }
  return { dates, mergedDays };
}
