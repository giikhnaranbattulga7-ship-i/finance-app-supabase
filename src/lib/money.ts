// Мөнгөний тооцоог төгрөгийн мөнгөөр (2 орны нарийвчлал) бүхэл тоогоор хийнэ.
// 0.1 + 0.2 гэх мэт float алдаа хуулгын үлдэгдлийг зөрүүлнэ.

const MAX_CENTS = 99_999_999_999_999; // numeric(14,2) дээд хязгаар

export function centsToDb(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('Мөнгөний дүн бүхэл мөнгө биш байна');
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${neg ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`;
}

export function numberToCents(value: number | string): number {
  const raw = String(value).trim().replace(/\s/g, '').replace(/₮/g, '');
  if (!raw) return 0;
  const neg = raw.startsWith('-');
  const body = neg ? raw.slice(1) : raw;
  if (!/^\d+(\.\d+)?$/.test(body)) return Number.NaN;
  const [whole, frac = ''] = body.split('.');
  const frac2 = `${frac}00`.slice(0, 2);
  const cents = Number(whole) * 100 + Number(frac2);
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return Number.NaN;
  return neg ? -cents : cents;
}

// Хаан банкны PDF дээрх "1,234.56" эсвэл "-12.50"
export function parseGroupedMoney(text: string): number | null {
  const t = text.trim().replace(/\s/g, '');
  if (!/^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(t) && !/^-?\d+\.\d{2}$/.test(t)) return null;
  const cents = numberToCents(t.replace(/,/g, ''));
  return Number.isFinite(cents) ? cents : null;
}

// Хэрэглэгч засварлах талбарт "1500.5", "1,500.50", "-200" гэж бичиж болно.
export function parseUserMoney(text: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(/₮/g, '').replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = numberToCents(t);
  return Number.isFinite(cents) ? cents : null;
}

export function formatCents(cents: number, withSymbol = true): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const suffix = frac ? `.${String(frac).padStart(2, '0')}` : '';
  return `${neg ? '-' : ''}${grouped}${suffix}${withSymbol ? '₮' : ''}`;
}

export function formatPdfMoney(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${grouped}.${frac}`;
}
