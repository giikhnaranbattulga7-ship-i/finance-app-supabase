export const MAX_MONEY = 999_999_999_999.99;

export type IsoDate = { year: number; month: number; day: number };
export type TxType = 'income' | 'expense';

export function roundToCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Дүн зөвхөн тоо байна');
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const text = abs.toString().includes('e') || abs.toString().includes('E') ? abs.toFixed(12) : abs.toString();
  const [whole, frac = ''] = text.split('.');
  const fracPad = `${frac}000`;
  let cents = Number(whole) * 100 + Number(fracPad.slice(0, 2));
  if (fracPad[2] >= '5') cents += 1;
  const rounded = cents / 100;
  return negative ? -rounded : rounded;
}

export function localTodayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function daysInMonth(year: number, month: number): number {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function parseIsoDate(iso: string): IsoDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function nextMonthStart(monthStart: string): string {
  const parsed = parseIsoDate(monthStart);
  if (!parsed || parsed.day !== 1) throw new Error('Сарын эх YYYY-MM-01 байна');
  const month = parsed.month === 12 ? 1 : parsed.month + 1;
  const year = parsed.month === 12 ? parsed.year + 1 : parsed.year;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function sumByCurrency(rows: { currency: string; amount: number }[]): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const currency = row.currency || 'MNT';
    totals.set(currency, (totals.get(currency) ?? 0) + row.amount);
  }
  return [...totals.entries()]
    .map(([currency, total]) => ({ currency, total: roundToCents(total) }))
    .sort((a, b) => Number(b.currency === 'MNT') - Number(a.currency === 'MNT') || a.currency.localeCompare(b.currency));
}

export function monthlyNet(rows: { type: TxType; amount: number; currency: string }[]): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.currency !== 'MNT') continue;
    if (row.type === 'income') income += row.amount;
    else expense += row.amount;
  }
  income = roundToCents(income);
  expense = roundToCents(expense);
  return { income, expense, net: roundToCents(income - expense) };
}

export function budgetRemaining(lines: { limit: number; spent: number }[]): {
  total: number | null;
  lines: { limit: number; spent: number; remaining: number; over: boolean }[];
} {
  if (lines.length === 0) return { total: null, lines: [] };
  const next = lines.map((line) => {
    const remaining = roundToCents(line.limit - line.spent);
    return { limit: line.limit, spent: line.spent, remaining, over: remaining < 0 };
  });
  return { total: roundToCents(next.reduce((sum, line) => sum + line.remaining, 0)), lines: next };
}

export function formatAmount(amount: number, currency: string): string {
  const rounded = roundToCents(amount);
  const sign = rounded < 0 ? '−' : '';
  const [whole, frac] = Math.abs(rounded).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const body = `${sign}${grouped}.${frac}`;
  return currency === 'MNT' ? `${body}₮` : `${body} ${currency}`;
}
