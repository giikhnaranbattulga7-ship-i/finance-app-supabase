import { Category } from '../../types/database';
import { fingerprintBase, occurrenceIndex } from './fingerprint';
import { DraftRow } from './types';

export type CommitPayloadRow = {
  occurred_at: string;
  posted_time: string;
  direction: 'in' | 'out';
  amount_cents: number;
  balance_after_cents: number;
  note: string;
  kind: DraftRow['kind'];
  category_id: string | null;
  occ: number;
  exclude: boolean;
};

export function categoryIdFor(row: DraftRow, categories: Category[]): string | null {
  if (!row.categoryName || row.amountCents == null || row.amountCents === 0) return null;
  const type = row.amountCents > 0 ? 'income' : 'expense';
  const matches = categories.filter((category) => category.name === row.categoryName && category.type === type);
  return (matches.find((category) => category.user_id) ?? matches[0])?.id ?? null;
}

// occ нь хуулга дахь бүх мөрийн (хассан мөрүүдийг оролцуулаад) дараалал.
// Хассан мөр серверт insert хийгдэхгүй, гэхдээ дараагийн ижил мөрийн дугаарыг хөдөлгөхгүй.
export function buildCommitRows(rows: DraftRow[], categories: Category[]): CommitPayloadRow[] {
  const bases = rows.map((row) => {
    if (!row.occurredAt || row.amountCents == null || row.amountCents === 0 || row.closingCents == null) {
      return `invalid:${row.id}`;
    }
    return fingerprintBase({
      occurredAt: row.occurredAt,
      postedTime: row.postedTime,
      direction: row.amountCents > 0 ? 'in' : 'out',
      amountCents: Math.abs(row.amountCents),
      balanceAfterCents: row.closingCents,
    });
  });
  return rows.map((row, index) => ({
    occurred_at: row.occurredAt,
    posted_time: row.postedTime,
    direction: (row.amountCents ?? 0) > 0 ? 'in' : 'out',
    amount_cents: Math.abs(row.amountCents ?? 0),
    balance_after_cents: row.closingCents ?? 0,
    note: row.note,
    kind: row.kind,
    category_id: categoryIdFor(row, categories),
    occ: occurrenceIndex(bases, index),
    exclude: row.excluded,
  }));
}
