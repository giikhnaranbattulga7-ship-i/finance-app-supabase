import { supabase } from '../lib/supabase';
import { Tag } from '../types/database';
import { currentUserId, unwrap } from './helpers';

export async function listTags(): Promise<Tag[]> {
  return unwrap(await supabase.from('tags').select('*').order('name'));
}

export async function createTag(name: string): Promise<Tag> {
  const user_id = await currentUserId();
  return unwrap(await supabase.from('tags').insert({ name: name.trim(), user_id }).select().single());
}

export async function updateTag(id: string, name: string) {
  return unwrap(await supabase.from('tags').update({ name: name.trim() }).eq('id', id).select().single());
}

export async function deleteTag(id: string) {
  unwrap(await supabase.from('tags').delete().eq('id', id));
}

// N:M холбоо: гүйлгээний шошгуудыг бүхэлд нь солино (хуучныг устгаад шинийг нэмнэ)
export async function setTransactionTags(transactionId: string, tagIds: string[]) {
  unwrap(await supabase.from('transaction_tags').delete().eq('transaction_id', transactionId));
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tag_id) => ({ transaction_id: transactionId, tag_id }));
  unwrap(await supabase.from('transaction_tags').insert(rows));
}
