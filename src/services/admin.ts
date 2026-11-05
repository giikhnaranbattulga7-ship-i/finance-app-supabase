import { supabase } from '../lib/supabase';
import { PremiumOrder, Profile } from '../types/database';
import { unwrap } from './helpers';

// Админ policy (is_admin()) тул бүх хэрэглэгчийн мөр харагдана
export async function adminStats() {
  const [profiles, orders, tx] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('premium_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ]);
  const users = unwrap(profiles) as Profile[];
  const ord = unwrap(orders) as PremiumOrder[];
  const revenue = ord.filter((o) => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0);
  return { users, orders: ord, revenue, txCount: tx.count ?? 0 };
}

export async function setOrderStatus(id: string, status: PremiumOrder['status']) {
  unwrap(
    await supabase
      .from('premium_orders')
      .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
      .eq('id', id),
  );
}

export async function setUserRole(id: string, role: Profile['role']) {
  unwrap(await supabase.from('profiles').update({ role }).eq('id', id));
}
