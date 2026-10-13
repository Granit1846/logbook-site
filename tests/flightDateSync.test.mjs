import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudDate, normalizeFlightDays } from '../src/lib/flightDateSync.ts';

test('Android cloud dates and old Mini App dates identify the same day', () => {
  assert.equal(cloudDate('2026-10-13'), cloudDate('13.10.2026'));
  const tables = {
    days: [
      { id: 'day-1', profileId: 'board-1', date: '2026-10-13', crew: 'Первый' },
      { id: 'day-2', profileId: 'board-1', date: '13.10.2026', crew: 'Второй' },
    ],
    launches: [
      { id: 'launch-1', dayId: 'day-1', order: 0 },
      { id: 'launch-2', dayId: 'day-2', order: 0 },
    ],
    snk_values: [{ id: 'snk-1', dayId: 'day-2', aLeft: 2 }],
  };

  assert.deepEqual(normalizeFlightDays(tables), { dates: 1, mergedDays: 1 });
  assert.equal(tables.days.length, 1);
  assert.equal(tables.days[0].date, '2026-10-13');
  assert.deepEqual(tables.launches.map(({ dayId, order }) => ({ dayId, order })), [
    { dayId: 'day-1', order: 0 }, { dayId: 'day-1', order: 1 },
  ]);
  assert.equal(tables.snk_values[0].dayId, 'day-1');
});

test('different SNK values stop automatic repair before committing', () => {
  const tables = {
    days: [
      { id: 'day-1', profileId: 'board-1', date: '2026-10-13' },
      { id: 'day-2', profileId: 'board-1', date: '13.10.2026' },
    ],
    launches: [],
    snk_values: [
      { id: 'snk-1', dayId: 'day-1', aLeft: 1 },
      { id: 'snk-2', dayId: 'day-2', aLeft: 2 },
    ],
  };
  assert.throws(() => normalizeFlightDays(tables), /разные значения СНК/);
});
