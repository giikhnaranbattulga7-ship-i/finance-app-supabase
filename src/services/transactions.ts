import { nextMonthStart, roundToCents } from '../lib/finance';
import { supabase } from '../lib/supabase';
import { Transaction, TxType } from '../types/database';
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
};

// Join: ангилал, данс, шошгуудыг нэг query-гаар авна
const SELECT = '*, category:categories(id,name,icon,color), account:accounts(id,name,currency), transaction_tags(tag:tags(*))';

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

// Шинэ гүйлгээ. user_id-г энд тавина (RLS: user_id = auth.uid()).
// Шошго нь transactions дээр биш, transaction_tags хүснэгтэд (N:M) бичигдэнэ.
export async function createTransaction({ tagIds, ...input }: TxInput) {
  const user_id = await currentUserId();
  const tx = unwrap(await supabase.from('transactions').insert({ ...input, user_id }).select().single()) as Transaction;
  await setTransactionTags(tx.id, tagIds);
  return tx;
}

export async function updateTransaction(id: string, { tagIds, ...input }: TxInput) {
  const tx = unwrap(await supabase.from('transactions').update(input).eq('id', id).select().single());
  await setTransactionTags(id, tagIds);
  return tx;
}

export async function deleteTransaction(id: string) {
  // transaction_tags мөрүүд FK on delete cascade-аар устна
  unwrap(await supabase.from('transactions').delete().eq('id', id));
}

// Тухайн сарын орлого, зарлага, ангиллаар нийлбэр (dashboard, төсөвт)
export async function monthSummary(monthStart: string) {
  const nextISO = nextMonthStart(monthStart);
  const rows = unwrap(
    await supabase
      .from('transactions')
      .select('type, amount, category_id, category:categories(name), account:accounts(currency)')
      .gte('occurred_at', monthStart)
      .lt('occurred_at', nextISO),
  ) as unknown as {
    type: TxType;
    amount: number;
    category_id: string | null;
    category: { name: string } | null;
    account: { currency: string } | null;
  }[];

  let income = 0;
  let expense = 0;
  let excludedOtherCurrency = false;
  const byCategory: Record<string, { name: string; total: number }> = {};
  for (const row of rows) {
    const currency = row.account?.currency ?? '';
    if (currency !== 'MNT') {
      excludedOtherCurrency = true;
      continue;
    }
    const amt = Number(row.amount);
    if (row.type === 'income') income += amt;
    else {
      expense += amt;
      const key = row.category_id ?? 'none';
      byCategory[key] ??= { name: row.category?.name ?? 'Ангилалгүй', total: 0 };
      byCategory[key].total += amt;
    }
  }
  income = roundToCents(income);
  expense = roundToCents(expense);
  for (const key of Object.keys(byCategory)) byCategory[key].total = roundToCents(byCategory[key].total);
  return { income, expense, net: roundToCents(income - expense), byCategory, excludedOtherCurrency };
}
