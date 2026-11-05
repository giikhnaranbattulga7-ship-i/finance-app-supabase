import { supabase } from '../lib/supabase';
import { Account, AccountBalance, AccountType } from '../types/database';
import { currentUserId, unwrap } from './helpers';

export type AccountInput = { name: string; type: AccountType; initial_balance: number };

// Үлдэгдэлтэй хамт (account_balances view) уншина
export async function listAccounts(): Promise<AccountBalance[]> {
  return unwrap(await supabase.from('account_balances').select('*').order('name'));
}

export async function getAccount(id: string): Promise<Account> {
  return unwrap(await supabase.from('accounts').select('*').eq('id', id).single());
}

export async function createAccount(input: AccountInput) {
  const user_id = await currentUserId();
  return unwrap(await supabase.from('accounts').insert({ ...input, user_id }).select().single());
}

export async function updateAccount(id: string, input: AccountInput) {
  return unwrap(await supabase.from('accounts').update(input).eq('id', id).select().single());
}

// Данс устгахад холбоотой гүйлгээ cascade-аар устна
export async function deleteAccount(id: string) {
  unwrap(await supabase.from('accounts').delete().eq('id', id));
}
