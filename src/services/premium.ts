import { supabase } from '../lib/supabase';
import { PremiumOrder } from '../types/database';
import { currentUserId, unwrap } from './helpers';

export const PLANS = {
  monthly: { title: 'Сарын', price: 9900 },
  yearly: { title: 'Жилийн', price: 99000 },
} as const;

export async function listMyOrders(): Promise<PremiumOrder[]> {
  return unwrap(await supabase.from('premium_orders').select('*').order('created_at', { ascending: false }));
}

// Хамгаалалт-1: зөвхөн 'pending' захиалга үүснэ.
// Хамгаалалт-2: Edge Function QPay нэхэмжлэх үүсгэж, webhook төлөвийг 'paid' болгоно.
export async function createOrder(plan: keyof typeof PLANS) {
  const user_id = await currentUserId();
  return unwrap(
    await supabase.from('premium_orders').insert({ user_id, plan, amount: PLANS[plan].price }).select().single(),
  );
}
