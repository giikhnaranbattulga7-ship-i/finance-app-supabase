import { TextPage } from '../pdf/extractText';
import { parseGroupedMoney } from '../money';
import { classifyNote, CashDirection } from './classify';
import { STATEMENT_LIMITS } from './limits';
import { StatementFileError } from './errors';
import { DraftRow, ParsedStatement } from './types';

// Хаан банкны текст хуулгын багана (A4, баруун зэрэгцсэн дүн):
// №, огноо, цаг, салбар, эхний үлдэгдэл, гүйлгээний дүн (+/-), эцсийн үлдэгдэл, утга, харьцсан данс.
// Дараагийн хуудсанд толгой давтагдахгүй. Урт утга дараагийн мөрөнд зөвхөн тайлбарын баганад үргэлжилнэ.

type Cell = { x: number; text: string };
type Line = { y: number; page: number; cells: Cell[] };

const OTHER_BANK = [/голомт/, /хас\s*банк/, /төрийн\s*банк/, /худалдаа\s*хөгжлийн/, /\bgolomt\b/, /\bxac\s*bank\b/];
const KHAN = [/хаан/, /khan\s*bank/, /khanbank/];

function linesOf(pages: TextPage[]): Line[] {
  const lines: Line[] = [];
  for (const page of pages) {
    const sorted = page.items
      .filter((item) => item.text.trim())
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of sorted) {
      const last = lines[lines.length - 1];
      if (last && last.page === page.page && Math.abs(last.y - item.y) <= 1.6) {
        last.cells.push({ x: item.x, text: item.text.trim() });
      } else {
        lines.push({ y: item.y, page: page.page, cells: [{ x: item.x, text: item.text.trim() }] });
      }
    }
  }
  for (const line of lines) line.cells.sort((a, b) => a.x - b.x);
  return lines;
}

function joined(line: Line): string {
  return line.cells.map((cell) => cell.text).join(' ').replace(/\s+/g, ' ').trim();
}

function band(line: Line, min: number, max: number): string {
  return line.cells
    .filter((cell) => cell.x >= min && cell.x < max)
    .map((cell) => cell.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseStatementDate(text: string): string | null {
  const match = /^(\d{4})[./-](\d{2})[./-](\d{2})$/.exec(text.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dateOnLine(line: Line): string | null {
  for (const cell of line.cells) {
    if (cell.x > 145) continue;
    const iso = parseStatementDate(cell.text);
    if (iso) return iso;
  }
  return null;
}

function timeOnLine(line: Line): string {
  for (const cell of line.cells) {
    if (cell.x > 145) continue;
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(cell.text);
    if (match) return match[3] ? `${match[1]}:${match[2]}:${match[3]}` : `${match[1]}:${match[2]}`;
  }
  return '';
}

function lineNo(line: Line): number | null {
  for (const cell of line.cells) {
    if (cell.x < 44 && /^\d{1,4}$/.test(cell.text)) return Number(cell.text);
  }
  return null;
}

function moneyOnLine(line: Line): { x: number; cents: number }[] {
  const found: { x: number; cents: number }[] = [];
  for (const cell of line.cells) {
    if (cell.x >= 368) continue;
    const cents = parseGroupedMoney(cell.text);
    if (cents != null) found.push({ x: cell.x, cents });
  }
  return found.sort((a, b) => a.x - b.x);
}

function maskDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `****${digits.slice(-4)}`;
}

function findDates(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/(\d{4})[./-](\d{2})[./-](\d{2})/g)) {
    const iso = parseStatementDate(`${match[1]}.${match[2]}.${match[3]}`);
    if (iso) out.push(iso);
  }
  return out;
}

function blankRow(line: Line, id: string): DraftRow {
  return {
    id,
    page: line.page,
    lineNo: lineNo(line),
    occurredAt: '',
    postedTime: '',
    openingCents: null,
    amountCents: null,
    closingCents: null,
    note: '',
    kind: 'unclassified',
    categoryName: null,
    confidence: 'none',
    reason: '',
    excluded: false,
    issues: [],
    sourcePreview: joined(line).slice(0, 180),
  };
}

function directionOf(amountCents: number): CashDirection {
  return amountCents > 0 ? 'in' : 'out';
}

function applyClass(row: DraftRow) {
  if (row.amountCents == null || row.amountCents === 0) {
    row.kind = 'unclassified';
    row.categoryName = null;
    row.confidence = 'none';
    row.reason = 'Дүн тодорхойгүй.';
    return;
  }
  const result = classifyNote(row.note, directionOf(row.amountCents));
  row.kind = result.kind;
  row.categoryName = result.categoryName;
  row.confidence = result.confidence;
  row.reason = result.reason;
}

export function withBalanceIssues(rows: DraftRow[]): DraftRow[] {
  const next = rows.map((row) => ({ ...row, issues: [] as string[] }));
  let previous: DraftRow | null = null;
  for (const row of next) {
    if (row.excluded) continue;
    if (!row.occurredAt) row.issues.push('Огноо байхгүй. YYYY-MM-DD гэж бөглөнө үү, эсвэл мөрийг хасна уу.');
    else if (!parseStatementDate(row.occurredAt.replace(/-/g, '.'))) row.issues.push('Огноо буруу байна.');
    if (row.amountCents == null) row.issues.push('Гүйлгээний дүн олдсонгүй.');
    else if (row.amountCents === 0) row.issues.push('Дүн 0 байж болохгүй.');
    if (row.openingCents == null || row.closingCents == null) {
      row.issues.push('Эхний эсвэл эцсийн үлдэгдэл олдсонгүй.');
    } else if (row.amountCents != null && row.openingCents + row.amountCents !== row.closingCents) {
      row.issues.push('Эхний үлдэгдэл дээр дүнг нэмэхэд эцсийн үлдэгдэл гарсангүй.');
    }
    if (previous?.closingCents != null && row.openingCents != null && previous.closingCents !== row.openingCents) {
      row.issues.push('Өмнөх мөрийн эцсийн үлдэгдэлтэй залгаагүй байна.');
    }
    if (row.note.length > STATEMENT_LIMITS.maxNote) {
      row.issues.push(`Утга ${STATEMENT_LIMITS.maxNote} тэмдэгтээс урт. Богиносгоод хадгална уу.`);
    }
    if (row.openingCents != null || row.closingCents != null) previous = row;
  }
  return next;
}

function appendNote(row: DraftRow, extra: string) {
  if (!extra) return;
  row.note = `${row.note} ${extra}`.replace(/\s+/g, ' ').trim();
}

export function parseKhanStatement(pages: TextPage[]): ParsedStatement {
  const lines = linesOf(pages);
  const documentText = lines.map(joined).join('\n').toLowerCase();
  const khan = KHAN.some((pattern) => pattern.test(documentText));
  const other = OTHER_BANK.some((pattern) => pattern.test(documentText));
  if (other && !khan) throw new StatementFileError('unsupported');

  const rows: DraftRow[] = [];
  const warnings: string[] = [];
  let wrappedRowCount = 0;
  let currency = 'MNT';
  let maskedAccount: string | null = null;
  const periodDates: string[] = [];
  let footerCredit: number | null = null;
  let footerDebit: number | null = null;
  let sawData = false;

  const ensureClassified = (row: DraftRow) => {
    applyClass(row);
  };

  for (const line of lines) {
    const text = joined(line);
    const lower = text.toLowerCase();
    if (line.y < 22 || /хуудас/.test(lower)) continue;

    const date = dateOnLine(line);
    const monies = moneyOnLine(line);

    if (!date && /нийт/.test(lower) && /дүн/.test(lower) && monies.length >= 2) {
      footerCredit = monies[0].cents;
      footerDebit = monies[1].cents;
      continue;
    }

    if (date) {
      sawData = true;
      const row = blankRow(line, `p${line.page}-${rows.length + 1}`);
      row.occurredAt = date;
      row.postedTime = timeOnLine(line);
      row.lineNo = lineNo(line);
      if (monies.length === 3) {
        row.openingCents = monies[0].cents;
        row.amountCents = monies[1].cents;
        row.closingCents = monies[2].cents;
      } else {
        row.issues.push('Үлдэгдэл ба дүнгийн багана дутуу эсвэл илүү байна. Гараар засна уу, алгасахгүй.');
        if (monies[0]) row.openingCents = monies[0].cents;
        if (monies[1]) row.amountCents = monies[1].cents;
        if (monies[2]) row.closingCents = monies[2].cents;
      }
      appendNote(row, band(line, 368, 510));
      const counterparty = maskDigits(band(line, 510, 2000));
      if (counterparty) appendNote(row, counterparty);
      rows.push(row);
      continue;
    }

    const onlyTail = line.cells.every((cell) => cell.x >= 368);
    if (onlyTail && rows.length > 0) {
      const row = rows[rows.length - 1];
      const before = row.note;
      appendNote(row, band(line, 368, 510));
      const counterparty = maskDigits(band(line, 510, 2000));
      if (counterparty && !row.note.includes(counterparty)) appendNote(row, counterparty);
      if (row.note !== before) wrappedRowCount++;
      continue;
    }

    if (monies.length > 0) {
      sawData = true;
      const row = blankRow(line, `p${line.page}-x${rows.length + 1}`);
      row.issues.push('Огноогүй мөнгөн мөр байна. Засах эсвэл хасна уу. Чимээгүй алгасаагүй.');
      rows.push(row);
      continue;
    }

    // Толгой, валют, IBAN, хугацаа. Гүйлгээ биш.
    const currencyMatch = /\b(MNT|USD|EUR|CNY|JPY|KRW)\b/.exec(text);
    if (currencyMatch) currency = currencyMatch[1];
    const compact = text.replace(/\s+/g, '');
    const iban = /[A-Z]{2}\d{2}[A-Z0-9]{8,30}/i.exec(compact);
    if (iban) maskedAccount = maskDigits(iban[0]);
    if (!sawData) periodDates.push(...findDates(text));
  }

  if (rows.length === 0) throw new StatementFileError(khan || sawData ? 'empty' : 'unsupported');
  if (rows.length > STATEMENT_LIMITS.maxRows) throw new StatementFileError('too_many_rows');
  if (!khan) warnings.push('Хаан банк гэсэн толгой олдсонгүй. Багана, огноо, үлдэгдэл таарсан тул уншлаа. Өөр банкны PDF биш эсэхийг шалгана уу.');

  for (const row of rows) {
    if (row.occurredAt) ensureClassified(row);
  }
  const checked = withBalanceIssues(rows);

  let gapCount = 0;
  let expected: number | null = null;
  for (const row of checked) {
    if (row.lineNo == null) continue;
    if (expected != null && row.lineNo !== expected) gapCount++;
    expected = row.lineNo + 1;
  }
  if (gapCount > 0) {
    warnings.push(`Мөрийн дугаар ${gapCount} удаа тасарсан. Үлдэгдэл зөрвөл алгассан мөр гэж үзээд хадгалахаас өмнө засна уу.`);
  }

  const usable = checked.filter((row) => row.amountCents != null && row.openingCents != null && row.closingCents != null);
  const openingCents = usable[0]?.openingCents ?? null;
  const closingCents = usable[usable.length - 1]?.closingCents ?? null;
  const chainOk = checked.every((row) => row.issues.length === 0);
  let movement = 0;
  let credit = 0;
  let debit = 0;
  for (const row of usable) {
    const amount = row.amountCents ?? 0;
    movement += amount;
    if (amount > 0) credit += amount;
    else debit += Math.abs(amount);
  }
  if (openingCents != null && closingCents != null && openingCents + movement !== closingCents) {
    warnings.push('Эхний үлдэгдэл дээр бүх дүнг нэмэхэд эцсийн үлдэгдэл таарахгүй байна.');
  }

  let totalsOk: boolean | null = null;
  if (footerCredit != null && footerDebit != null) {
    const pair = [footerCredit, footerDebit].sort((a, b) => a - b);
    const expect = [credit, debit].sort((a, b) => a - b);
    totalsOk = pair[0] === expect[0] && pair[1] === expect[1];
    if (!totalsOk) warnings.push('Хуулгын «Нийт дүн» мөрүүдийн нийлбэртэй таарахгүй байна. Мөр бүрийг шалгана уу.');
  }

  const txDates = checked.map((row) => row.occurredAt).filter(Boolean).sort();
  const allPeriod = [...periodDates, ...txDates].sort();

  return {
    bank: 'khan_bank',
    currency,
    maskedAccount,
    periodStart: allPeriod[0] ?? null,
    periodEnd: allPeriod[allPeriod.length - 1] ?? null,
    openingCents,
    closingCents,
    rows: checked,
    warnings,
    pageCount: pages.length,
    wrappedRowCount,
    chainOk,
    totalsOk,
  };
}
