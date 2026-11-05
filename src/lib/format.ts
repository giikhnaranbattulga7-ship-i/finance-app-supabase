// Тоог мянгатын тусгаарлагчтай ₮ болгох. Жишээ: 1500000 -> "1,500,000₮"
export function formatMoney(amount: number): string {
  // toString -> regex-ээр 3 оронтой бүлэг бүрийн өмнө таслал тавина
  const text = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return text + '₮';
}

// ISO огноог "2026.11.02" хэлбэрт оруулах
export function formatDate(iso: string): string {
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
