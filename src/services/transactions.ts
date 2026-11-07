import { numberToCents } from '../lib/money';
import { supabase } from '../lib/supabase';
import { EconomicKind, Transaction, TxType } from '../types/database';
import { friendlyDbError } from './dbError';
import { currentUserId, unwrap } from './helpers';
import { setTransactionTags } from './tags';

export const PAGE_SIZE = 20;

export type TxFilter = {
  search?: string;
  type?: TxType | 'all';
  categoryId?: string | null;
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  from?: string; // YYYY-MM-DD
  to?: string;
};

export type TxInput = {
  account_id: string;
  category_id: string | null;
  type: TxType;
  amount: number;
  note: string;
  occurred_at: string;
  tagIds: string[];
  economic_kind?: EconomicKind;
};

// Join: ангилал, данс, шошгуудыг нэг query-гаар авна
const SELECT = '*, category:categories(id,name,icon,color), account:accounts(id,name), transaction_tags(tag:tags(*))';

// Хуудаслалттай (infinite scroll) жагсаалт: page 0,1,2...
export async function listTransactions(filter: TxFilter, page = 0): Promise<Transaction[]> {
  let q = supabase.from('transactions').select(SELECT);
  if (filter.type && filter.type !== 'all') q = q.eq('type', filter.type);
  if (filter.categoryId) q = q.eq('category_id', filter.categoryId);
  if (filter.search?.trim()) q = q.ilike('note', `%${filter.search.trim()}%`);
  if (filter.from) q = q.gte('occurred_at', filter.from);
  if (filter.to) q = q.lte('occurred_at', filter.to);

  switch (filter.sort ?? 'date_desc') {
    case 'date_asc': q = q.order('occurred_at', { ascending: true }); break;
    case 'amount_desc': q = q.order('amount', { ascending: false }); break;
    case 'amount_asc': q = q.order('amount', { ascending: true }); break;
    default: q = q.order('occurred_at', { ascending: false }).order('created_at', { ascending: false });
  }
  const start = page * PAGE_SIZE;
  return unwrap(await q.range(start, start + PAGE_SIZE - 1));
}

export async function getTransaction(id: string): Promise<Transaction> {
  return unwrap(await supabase.from('transactions').select(SELECT).eq('id', id).single());
}

export async function createTransaction({ tagIds, ...input }: TxInput) {
  const user_id = await currentUserId();
  const res = await supabase.from('transactions').insert({ ...input, user_id }).select().single();
  if (res.error) throw new Error(friendlyDbError(res.error.message));
  const tx = res.data as Transaction;
  await setTransactionTags(tx.id, tagIds);
  return tx;
}

export async function updateTransaction(id: string, { tagIds, ...input }: TxInput) {
  const res = await supabase.from('transactions').update(input).eq('id', id).select().single();
  if (res.error) throw new Error(friendlyDbError(res.error.message));
  await setTransactionTags(id, tagIds);
  return res.data;
}

export async function deleteTransaction(id: string) {
  // transaction_tags мөрүүд FK on delete cascade-аар устна
  unwrap(await supabase.from('transactions').delete().eq('id', id));
}

// Тухайн сарын орлого, зарлага, ангиллаар нийлбэр (dashboard, төсөвт)
export async function monthSummary(monthStart: string) {
  const d = new Date(monthStart);
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const nextISO = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  const res = await supabase
    .from('transactions')
    .select('type, amount, category_id, economic_kind, category:categories(name,color)')
    .gte('occurred_at', monthStart)
    .lt('occurred_at', nextISO);
  if (res.error) throw new Error(friendlyDbError(res.error.message));
  const rows = (res.data ?? []) as unknown as {
    type: TxType;
    amount: number | string;
    category_id: string | null;
    economic_kind?: EconomicKind | null;
    category: { name: string; color: string } | null;
  }[];

  // Зөвхөн economic_kind = normal нь орлого/зарлагын тайланд орно.
  // Шилжүүлэг, хадгаламж үлдэгдлийг өөрчилдөг ч зарцуулалт биш.
  let incomeCents = 0;
  let expenseCents = 0;
  let transferInCents = 0;
  let transferOutCents = 0;
  let savingsInCents = 0;
  let savingsOutCents = 0;
  let refundCents = 0;
  let unclassifiedInCents = 0;
  let unclassifiedOutCents = 0;
  const byCategory: Record<string, { name: string; color: string; totalCents: number }> = {};
  for (const r of rows) {
    const cents = Math.abs(numberToCents(r.amount));
    const kind = r.economic_kind ?? 'normal';
    const incoming = r.type === 'income';
    if (kind === 'normal') {
      if (incoming) incomeCents += cents;
      else {
        expenseCents += cents;
        const key = r.category_id ?? 'none';
        byCategory[key] ??= { name: r.category?.name ?? 'Ангилалгүй', color: r.category?.color ?? '#9CA3AF', totalCents: 0 };
        byCategory[key].totalCents += cents;
      }
    } else if (kind === 'transfer') {
      if (incoming) transferInCents += cents;
      else transferOutCents += cents;
    } else if (kind === 'savings') {
      if (incoming) savingsInCents += cents;
      else savingsOutCents += cents;
    } else if (kind === 'refund') {
      refundCents += cents;
    } else if (incoming) unclassifiedInCents += cents;
    else unclassifiedOutCents += cents;
  }
  return {
    incomeCents, expenseCents, transferInCents, transferOutCents,
    savingsInCents, savingsOutCents, refundCents, unclassifiedInCents, unclassifiedOutCents, byCategory,
  };
}
