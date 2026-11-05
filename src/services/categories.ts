import { supabase } from '../lib/supabase';
import { Category, TxType } from '../types/database';
import { currentUserId, unwrap } from './helpers';

export type CategoryInput = { name: string; type: TxType; icon: string; color: string };

// RLS: үндсэн (user_id null) + өөрийн ангиллууд буцна
export async function listCategories(type?: TxType): Promise<Category[]> {
  let q = supabase.from('categories').select('*').order('user_id', { nullsFirst: true }).order('name');
  if (type) q = q.eq('type', type);
  return unwrap(await q);
}

export async function createCategory(input: CategoryInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from('categories').insert({ ...input, user_id }).select().single());
}

export async function updateCategory(id: string, input: CategoryInput) {
  return unwrap(await supabase.from('categories').update(input).eq('id', id).select().single());
}

export async function deleteCategory(id: string) {
  unwrap(await supabase.from('categories').delete().eq('id', id));
}
