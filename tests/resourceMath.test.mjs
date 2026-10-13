import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateSne, oilRemaining, hourStatus, parseResourceDate, resourceExpiry,
  calendarDaysBetween, calendarProgress, resourceCalendarStatus, maintenanceStatus, addCalendarMonths,
} from '../src/lib/resourceMath.ts';

test('aggregate SNE follows the Android installation formula even with zero installation fields', () => {
  assert.equal(aggregateSne(6000, 1800, 300, false), 4500);
  assert.equal(aggregateSne(6000, 0, 0, false), 6000);
  assert.equal(aggregateSne(6000, 1800, 300, true), 6000);
  assert.equal(hourStatus(26 * 60, 'aggregate'), 'warning');
  assert.equal(hourStatus(-1, 'aggregate'), 'expired');
});

test('calendar progress fills from start to expiry and keeps overdue days visible', () => {
  const start = new Date(2026, 0, 1);
  const expiry = new Date(2026, 0, 11);
  assert.deepEqual(calendarProgress(start, expiry, new Date(2026, 0, 6)), {
    totalDays: 10, elapsedDays: 5, remainingDays: 5, percent: 50,
  });
  assert.equal(calendarProgress(start, expiry, new Date(2026, 0, 12)).percent, 100);
  assert.equal(calendarProgress(start, expiry, new Date(2026, 0, 12)).remainingDays, -1);
});

test('oil hours and dates use the Android formulas', () => {
  assert.equal(oilRemaining(4000, 3500, 600), 100);
  assert.equal(hourStatus(19 * 60, 'oil'), 'critical');
  assert.equal(resourceExpiry('31.01.2026', '1', 'oil')?.toLocaleDateString('ru-RU'), '31.01.2027');
  assert.equal(resourceExpiry('01.01.2024', '1', 'aggregate')?.toLocaleDateString('ru-RU'), '31.12.2024');
  assert.equal(parseResourceDate('31.02.2026'), null);
  assert.equal(calendarDaysBetween(new Date(2026, 9, 13), new Date(2026, 9, 14)), 1);
  assert.equal(resourceCalendarStatus(new Date(2026, 9, 13), new Date(2026, 10, 12), 'aggregate'), 'critical');
});

test('maintenance becomes overdue after the upper bound', () => {
  assert.equal(maintenanceStatus(50 * 60, 45 * 60, 50 * 60, 60 * 60), 'critical');
  assert.equal(maintenanceStatus(60 * 60, 45 * 60, 50 * 60, 60 * 60), 'critical');
  assert.equal(maintenanceStatus(60 * 60 + 1, 45 * 60, 50 * 60, 60 * 60), 'expired');
  assert.equal(addCalendarMonths(new Date(2026, 0, 31), 1).toLocaleDateString('ru-RU'), '28.02.2026');
});
