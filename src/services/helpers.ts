import { supabase } from '../lib/supabase';

// Supabase-ийн { data, error } хариуг шалгаж, алдаа бол throw хийнэ
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// Одоогийн нэвтэрсэн хэрэглэгчийн id (insert хийхэд user_id болгоно)
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Нэвтрээгүй байна');
  return id;
}
