import { sha256Hex } from '../sha256';
import { CashDirection } from './classify';

// Хурууны хээ: огноо, цаг, чиглэл, дүн, гүйлгээний ДАРААХ үлдэгдэл.
// Ижил цагт ижил дүнтэй хоёр бодит худалдан авалт үлдэгдлээрээ ялгагдана.
// Тайлбарыг оруулаагүй: хэрэглэгч утгыг зассан ч дахин оруулахад давхардахгүй.
export function fingerprintBase(parts: {
  occurredAt: string;
  postedTime: string;
  direction: CashDirection;
  amountCents: number;
  balanceAfterCents: number;
}): string {
  const payload = [
    parts.occurredAt,
    parts.postedTime,
    parts.direction,
    String(Math.abs(parts.amountCents)),
    String(parts.balanceAfterCents),
  ].join('|');
  return sha256Hex(payload);
}

export function occurrenceIndex(bases: string[], index: number): number {
  const base = bases[index];
  let count = 0;
  for (let i = 0; i < index; i++) if (bases[i] === base) count++;
  return count;
}

// occ 0,1,2... нь хуулга дахь дараалал. Өгөгдлийн санд аль хэдийн байгаа тооноос бага бол давхардсан.
export function isStoredDuplicate(occ: number, existingCount: number): boolean {
  return occ < existingCount;
}
