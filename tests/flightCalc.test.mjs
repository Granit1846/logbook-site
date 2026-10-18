import assert from 'node:assert/strict';
import test from 'node:test';
import { calcTime, calcSnk, calcStandard, evaluate } from '../src/lib/flightCalc.ts';

test('time mode sums hh:mm with any separator, bare numbers are hours', () => {
  assert.equal(calcTime('1:30 + 0:45')?.hm, '2:15');
  assert.equal(calcTime('1,30 + 0,45')?.hm, '2:15');
  assert.equal(calcTime('1.45 + 0.35')?.text, '2ч 20м');
  assert.equal(calcTime('2 - 0:30')?.hm, '1:30');
  assert.equal(calcTime('0:30 - 1')?.hm, '-0:30');
  assert.equal(calcTime('1:30 * 2'), null);
  assert.equal(calcTime(''), null);
});

test('SNK mode adds decimal hours and rounds to whole minutes', () => {
  assert.equal(calcSnk('1,45+1,61')?.hm, '3:04');
  assert.equal(calcSnk('1.50')?.hm, '1:30');
  assert.equal(calcSnk('1,78')?.hm, '1:47');
  assert.equal(calcSnk('1,45+1,61')?.decimal, '3,06');
  assert.equal(calcSnk('1,4+'), null);
});

test('standard mode follows operator precedence and parentheses', () => {
  assert.equal(calcStandard('1650 * 0,789'), '1301,85');
  assert.equal(calcStandard('2 + 3 * 4'), '14');
  assert.equal(calcStandard('(2 + 3) * 4'), '20');
  assert.equal(calcStandard('10 / 4'), '2,5');
  assert.equal(calcStandard('-3 + 5'), '2');
  assert.equal(calcStandard('1 / 0'), null);
  assert.equal(calcStandard('2 +'), null);
  assert.equal(evaluate('alert(1)'), null);
});
