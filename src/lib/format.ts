import { formatAmount, parseIsoDate } from './finance';

export function formatMoney(amount: number, currency = 'MNT'): string {
  return formatAmount(amount, currency);
}

export function formatDate(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso.slice(0, 10);
  return `${parts.year}.${String(parts.month).padStart(2, '0')}.${String(parts.day).padStart(2, '0')}`;
}

export function monthKey(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso.slice(0, 7);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function monthLabel(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) return iso;
  return `${parts.year} оны ${parts.month}-р сар`;
}
