import { formatCents, numberToCents } from './money';

// Тоог мянгатын тусгаарлагчтай ₮ болгох. Бутархайг 2 орноор хадгална.
export function formatMoney(amount: number | string): string {
  const cents = numberToCents(amount);
  if (!Number.isFinite(cents)) return '—';
  return formatCents(cents);
}

// ISO огноог "2026.11.02" хэлбэрт оруулах. YYYY-MM-DD-г timezone-оор хөдөлгөхгүй.
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${month}.${day}`;
}

// Огнооноос "2026-11" гэсэн сарын түлхүүр гаргах (сараар бүлэглэхэд)
export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
