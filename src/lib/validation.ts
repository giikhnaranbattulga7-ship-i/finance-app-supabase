import { localTodayISO, MAX_MONEY, parseIsoDate, roundToCents } from './finance';

// Формын оролт шалгах функцууд. Алдаа байвал Монгол мессеж, үгүй бол null буцаана.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Имэйл хаягаа оруулна уу';
  if (!EMAIL_RE.test(email.trim())) return 'Имэйл хаяг буруу байна';
  return null;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 6) return 'Нууц үг хамгийн багадаа 6 тэмдэгт байна';
  return null;
}

export function validateName(name: string, max = 50): string | null {
  const n = name.trim();
  if (!n) return 'Нэр хоосон байж болохгүй';
  if (n.length > max) return `Нэр ${max} тэмдэгтээс хэтрэхгүй`;
  return null;
}

// "15,000" гэх мэт оролтыг тоо болгож шалгана
export function parseAmount(text: string): number {
  return Number(text.replace(/[,\s₮]/g, ''));
}

export function moneyToStore(text: string): number {
  return roundToCents(parseAmount(text));
}

export function validateAmount(text: string, allowZero = false): string | null {
  if (!text.trim()) return 'Дүн оруулна уу';
  const n = parseAmount(text);
  if (!Number.isFinite(n)) return 'Дүн зөвхөн тоо байна';
  const rounded = roundToCents(n);
  if (allowZero ? rounded < 0 : rounded <= 0) return allowZero ? 'Дүн сөрөг байж болохгүй' : 'Дүн 0-ээс их байна';
  if (rounded > MAX_MONEY) return 'Дүн хэт их байна';
  return null;
}

export function validateDate(text: string): string | null {
  if (!parseIsoDate(text)) return 'Огноо YYYY-MM-DD хэлбэртэй';
  return null;
}

export const todayISO = () => localTodayISO();
export const monthStartISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
