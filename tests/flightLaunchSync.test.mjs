import assert from 'node:assert/strict';
import test from 'node:test';
import { sameLaunchContents } from '../src/lib/flightLaunchSync.ts';

test('same flight inputs are duplicate regardless of journal ID and order', () => {
  const first = { id: 'one', dayId: 'day', order: 0, vsu: 5, zemlya: 10, vozduh: 30,
    tp: 0, samolet: 0, zapravkaLiters: 200, zapravkaDensity: 0.8, vedCek: '42', zapravkaKg: 160 };
  assert.equal(sameLaunchContents(first, { ...first, id: 'two', order: 1, zapravkaKg: 160.01 }), true);
  assert.equal(sameLaunchContents(first, { ...first, vozduh: 31 }), false);
  assert.equal(sameLaunchContents(first, { ...first, vedCek: '43' }), false);
});
