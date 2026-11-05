import { supabase } from '../lib/supabase';
import { Budget } from '../types/database';
import { currentUserId, unwrap } from './helpers';

export type BudgetInput = { category_id: string; month: string; limit_amount: number };

export async function listBudgets(month: string): Promise<Budget[]> {
  return unwrap(
    await supabase.from('budgets').select('*, category:categories(id,name,icon,color)').eq('month', month).order('created_at'),
  );
}

export async function getBudget(id: string): Promise<Budget> {
  return unwrap(await supabase.from('budgets').select('*').eq('id', id).single());
}

export async function createBudget(input: BudgetInput) {
  const user_id = await currentUserId();
  const res = await supabase.from('budgets').insert({ ...input, user_id }).select().single();
  // unique(user_id, category_id, month) зөрчигдвөл ойлгомжтой мессеж
  if (res.error?.code === '23505') throw new Error('Энэ ангилалд энэ сард төсөв аль хэдийн байна');
  return unwrap(res);
}

export async function updateBudget(id: string, input: BudgetInput) {
  const res = await supabase.from('budgets').update(input).eq('id', id).select().single();
  if (res.error?.code === '23505') throw new Error('Энэ ангилалд энэ сард төсөв аль хэдийн байна');
  return unwrap(res);
}

export async function deleteBudget(id: string) {
  unwrap(await supabase.from('budgets').delete().eq('id', id));
}
