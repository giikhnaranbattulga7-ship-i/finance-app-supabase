import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetRemaining, formatAmount, localTodayISO, monthlyNet, nextMonthStart, parseIsoDate, roundToCents, sumByCurrency } from './finance.ts';

test('0.005 rounds half up to 0.01 and overflow stays above the column max', () => {
  assert.equal(roundToCents(0.005), 0.01);
  assert.equal(roundToCents(1.004), 1);
  assert.equal(roundToCents(10.1), 10.1);
  assert.equal(roundToCents(999999999999.994), 999999999999.99);
  assert.ok(roundToCents(999999999999.995) > 999999999999.99);
});

test('local today uses the device calendar, not UTC', () => {
  const morningInUlaanbaatar = new Date('2026-11-07T23:30:00.000Z');
  const utcToday = morningInUlaanbaatar.toISOString().slice(0, 10);
  const local = localTodayISO(new Date(morningInUlaanbaatar.getTime() + 8 * 60 * 60 * 1000));
  assert.equal(utcToday, '2026-11-07');
  assert.equal(local, '2026-11-08');
  assert.equal(parseIsoDate('2026-02-31'), null);
  assert.equal(nextMonthStart('2026-12-01'), '2027-01-01');
});

test('currency totals never add MNT to USD', () => {
  const totals = sumByCurrency([
    { currency: 'MNT', amount: 1000 },
    { currency: 'USD', amount: 10 },
    { currency: 'MNT', amount: 0.005 },
  ]);
  assert.deepEqual(totals, [
    { currency: 'MNT', total: 1000.01 },
    { currency: 'USD', total: 10 },
  ]);
});

test('monthly net and budget remaining stay in MNT and empty budget is not zero', () => {
  const net = monthlyNet([
    { type: 'income', amount: 100, currency: 'MNT' },
    { type: 'expense', amount: 40.005, currency: 'MNT' },
    { type: 'expense', amount: 999, currency: 'USD' },
  ]);
  assert.deepEqual(net, { income: 100, expense: 40.01, net: 59.99 });
  assert.equal(budgetRemaining([]).total, null);
  const progress = budgetRemaining([{ limit: 150000, spent: 195000 }]);
  assert.equal(progress.total, -45000);
  assert.equal(progress.lines[0].over, true);
  assert.equal(formatAmount(-45000, 'MNT'), '−45,000.00₮');
  assert.equal(formatAmount(10, 'USD'), '10.00 USD');
});
