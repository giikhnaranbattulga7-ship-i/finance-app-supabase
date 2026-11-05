import { AccountType } from '../types/database';

export const ACCOUNT_TYPES: { key: AccountType; label: string; icon: string }[] = [
  { key: 'cash', label: 'Бэлэн мөнгө', icon: 'cash' },
  { key: 'bank', label: 'Банк', icon: 'business' },
  { key: 'card', label: 'Карт', icon: 'card' },
  { key: 'savings', label: 'Хадгаламж', icon: 'wallet' },
];
export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((a) => a.key === t)?.label ?? t;
