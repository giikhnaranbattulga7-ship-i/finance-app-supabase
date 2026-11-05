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

export function validateAmount(text: string, allowZero = false): string | null {
  if (!text.trim()) return 'Дүн оруулна уу';
  const n = parseAmount(text);
  if (!Number.isFinite(n)) return 'Дүн зөвхөн тоо байна';
  if (allowZero ? n < 0 : n <= 0) return allowZero ? 'Дүн сөрөг байж болохгүй' : 'Дүн 0-ээс их байна';
  if (n > 1_000_000_000_000) return 'Дүн хэт их байна';
  return null;
}

export function validateDate(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'Огноо YYYY-MM-DD хэлбэртэй';
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return 'Огноо буруу байна';
  return null;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthStartISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
