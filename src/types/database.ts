// Өгөгдлийн сангийн хүснэгтүүдийн TypeScript төрлүүд (schema.sql-тэй нийцнэ)
export type Role = 'guest' | 'user' | 'admin';
export type TxType = 'income' | 'expense';
export type AccountType = 'cash' | 'bank' | 'card' | 'savings';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  is_premium: boolean;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  currency: string;
  created_at: string;
}

export interface AccountBalance {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance: number;
  balance: number;
}

export interface Category {
  id: string;
  user_id: string | null; // null = системийн үндсэн ангилал
  name: string;
  type: TxType;
  icon: string;
  color: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: TxType;
  amount: number;
  note: string;
  occurred_at: string; // YYYY-MM-DD
  created_at: string;
  // join-оор ирэх өгөгдөл
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
  account?: Pick<Account, 'id' | 'name'> | null;
  transaction_tags?: { tag: Tag }[];
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string; // YYYY-MM-01
  limit_amount: number;
  category?: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null;
}

export interface PremiumOrder {
  id: string;
  user_id: string;
  plan: 'monthly' | 'yearly';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  invoice_id: string | null;
  created_at: string;
  paid_at: string | null;
}
