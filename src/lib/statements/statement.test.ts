/// <reference types="node" />
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildBlankPdf, buildSyntheticStatement } from '../pdf/syntheticStatement';
import { formatCents, numberToCents, parseGroupedMoney } from '../money';
import { sha256Hex } from '../sha256';
import { classifyNote } from './classify';
import { StatementFileError } from './errors';
import { fingerprintBase, isStoredDuplicate, occurrenceIndex } from './fingerprint';
import { parseKhanStatement, withBalanceIssues } from './khanBank';
import { planOpening } from './opening';
import { parseStatementFile } from './parseStatement';
import { DraftRow } from './types';

test('sha256 matches node crypto and the empty/abc vectors', () => {
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const sample = '2026-01-03|09:15|out|150050|9849950';
  assert.equal(sha256Hex(sample), createHash('sha256').update(sample).digest('hex'));
});

test('cents avoid binary float drift', () => {
  assert.equal(numberToCents('0.10') + numberToCents('0.20'), 30);
  assert.equal(parseGroupedMoney('1,500.50'), 150050);
  assert.equal(parseGroupedMoney('-3,200.75'), -320075);
  assert.equal(formatCents(150050), '1,500.50₮');
  assert.equal(formatCents(10_000_000), '100,000₮');
});

test('category rules ignore amount and keep uncertain rows unclassified', () => {
  const huge = classifyNote('Янз бүрийн', 'out');
  assert.equal(huge.kind, 'unclassified');
  assert.equal(huge.categoryName, null);
  assert.equal(classifyNote('Кофе шоп', 'out').categoryName, 'Хоол хүнс');
  assert.equal(classifyNote('1-р сарын цалин', 'in').categoryName, 'Цалин');
  assert.equal(classifyNote('Цалин буцааж', 'out').kind, 'unclassified');
  assert.equal(classifyNote('Данс хооронд өөрийн данс', 'out').kind, 'transfer');
  assert.equal(classifyNote('Найздаа шилжүүлэг', 'out').kind, 'unclassified');
  assert.equal(classifyNote('Хадгаламж руу', 'out').kind, 'savings');
  assert.equal(classifyNote('Хадгаламжийн хүү', 'in').kind, 'normal');
  assert.equal(classifyNote('Пос буцаалт', 'in').kind, 'refund');
  assert.equal(classifyNote('Пос буцаалт', 'out').kind, 'unclassified');
});

test('duplicate occurrence keeps same-time different balances and skips overlap', () => {
  const first = fingerprintBase({
    occurredAt: '2026-01-03', postedTime: '09:15', direction: 'out', amountCents: 150050, balanceAfterCents: 9849950,
  });
  const second = fingerprintBase({
    occurredAt: '2026-01-03', postedTime: '09:15', direction: 'out', amountCents: 150050, balanceAfterCents: 9699900,
  });
  assert.notEqual(first, second);
  const bases = [first, second, first];
  assert.equal(occurrenceIndex(bases, 0), 0);
  assert.equal(occurrenceIndex(bases, 2), 1);
  assert.equal(isStoredDuplicate(0, 1), true);
  assert.equal(isStoredDuplicate(1, 1), false);
});

test('opening balance is not overwritten once the account is in use', () => {
  assert.deepEqual(planOpening({
    initialCents: 0, transactionCount: 0, statementOpeningCents: 10_000_000, userWantsApply: true,
  }), { action: 'set', previousCents: 0, nextCents: 10_000_000 });
  assert.equal(planOpening({
    initialCents: 500, transactionCount: 0, statementOpeningCents: 10_000_000, userWantsApply: true,
  }).action, 'locked');
  assert.equal(planOpening({
    initialCents: 0, transactionCount: 3, statementOpeningCents: 10_000_000, userWantsApply: true,
  }).action, 'locked');
  const matched = planOpening({
    initialCents: 10_000_000, transactionCount: 0, statementOpeningCents: 10_000_000, userWantsApply: true,
  });
  assert.equal(matched.action, 'unchanged');
  if (matched.action === 'unchanged') assert.equal(matched.reason, 'matches');
});

test('synthetic Khan PDF: pages, wrap, decimals, chain, totals, kinds', async () => {
  const built = buildSyntheticStatement();
  const parsed = await parseStatementFile(built.bytes);
  assert.equal(parsed.pageCount, 2);
  assert.equal(parsed.currency, 'MNT');
  assert.equal(parsed.maskedAccount, '****0019');
  assert.equal(parsed.periodStart, '2026-01-01');
  assert.equal(parsed.periodEnd, '2026-01-31');
  assert.equal(parsed.rows.length, built.rows.length);
  assert.equal(parsed.chainOk, true);
  assert.equal(parsed.totalsOk, true);
  assert.ok(parsed.wrappedRowCount >= 1);
  assert.equal(parsed.openingCents, built.openingCents);
  assert.equal(parsed.closingCents, built.closingCents);
  assert.equal(parsed.rows[0].amountCents, -150050);
  assert.equal(parsed.rows[1].amountCents, -150050);
  assert.notEqual(parsed.rows[0].closingCents, parsed.rows[1].closingCents);
  assert.equal(parsed.rows[0].kind, 'normal');
  assert.equal(parsed.rows[0].categoryName, 'Хоол хүнс');
  assert.equal(parsed.rows[2].categoryName, 'Цалин');
  assert.match(parsed.rows[2].note, /\*\*\*\*0001/);
  assert.equal(parsed.rows[3].kind, 'transfer');
  assert.equal(parsed.rows[4].kind, 'savings');
  assert.equal(parsed.rows[5].kind, 'refund');
  assert.equal(parsed.rows[6].categoryName, 'Боловсрол');
  assert.match(parsed.rows[6].note, /сурах бичиг/);
  assert.equal(parsed.rows[7].kind, 'unclassified');
  assert.match(parsed.rows[7].note, /55001122/);
  assert.equal(parsed.rows[8].categoryName, 'Төлбөр');
  const bases = parsed.rows.map((row) => fingerprintBase({
    occurredAt: row.occurredAt,
    postedTime: row.postedTime,
    direction: (row.amountCents ?? 0) > 0 ? 'in' : 'out',
    amountCents: Math.abs(row.amountCents ?? 0),
    balanceAfterCents: row.closingCents ?? 0,
  }));
  assert.equal(new Set(bases).size, bases.length);
});

test('balance break stays visible instead of being dropped', () => {
  const row: DraftRow = {
    id: '1', page: 1, lineNo: 1, occurredAt: '2026-01-01', postedTime: '10:00',
    openingCents: 1000, amountCents: -200, closingCents: 700, note: 'Кофе',
    kind: 'normal', categoryName: 'Хоол хүнс', confidence: 'high', reason: '',
    excluded: false, issues: [], sourcePreview: '',
  };
  const [checked] = withBalanceIssues([row]);
  assert.ok(checked.issues.some((issue) => issue.includes('эцсийн үлдэгдэл')));
});

test('note longer than 200 is kept and blocks save', () => {
  const note = 'а'.repeat(201);
  const [checked] = withBalanceIssues([{
    id: '1', page: 1, lineNo: 1, occurredAt: '2026-01-01', postedTime: '10:00',
    openingCents: 1000, amountCents: -100, closingCents: 900, note,
    kind: 'normal', categoryName: 'Хоол хүнс', confidence: 'high', reason: '',
    excluded: false, issues: [], sourcePreview: '',
  }]);
  assert.equal(checked.note, note);
  assert.match(checked.issues.join(' '), /200 тэмдэгтээс урт/);
});

test('encrypted, scanned, corrupt and other-bank files are rejected', async () => {
  await assert.rejects(parseStatementFile(ascii('%PDF-1.4\n1 0 obj << /Encrypt 2 0 R >> endobj\n')), (error: unknown) => {
    return error instanceof StatementFileError && error.code === 'encrypted';
  });
  await assert.rejects(parseStatementFile(ascii('not a pdf')), (error: unknown) => {
    return error instanceof StatementFileError && error.code === 'corrupt';
  });
  await assert.rejects(parseStatementFile(new Uint8Array(STATEMENT_HUGE())), (error: unknown) => {
    return error instanceof StatementFileError && error.code === 'too_large';
  });
  assert.throws(() => parseKhanStatement([{
    page: 1, width: 595, height: 842,
    items: [{ x: 40, y: 700, text: 'Голомт банк дансны хуулга' }, { x: 40, y: 680, text: 'Огноо' }],
  }]), (error: unknown) => error instanceof StatementFileError && error.code === 'unsupported');
  await assert.rejects(parseStatementFile(buildBlankPdf()), (error: unknown) => {
    return error instanceof StatementFileError && error.code === 'scanned';
  });
});

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (ch) => ch.charCodeAt(0));
}

function STATEMENT_HUGE(): Uint8Array {
  return new Uint8Array(8 * 1024 * 1024 + 1);
}
