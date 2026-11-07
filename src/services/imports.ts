import { sha256HexBytes } from '../lib/sha256';
import { supabase } from '../lib/supabase';
import { CashDirection, EconomicKind } from '../lib/statements/classify';
import { friendlyDbError } from './dbError';

export type ImportCommitRow = {
  occurred_at: string;
  posted_time: string;
  direction: CashDirection;
  amount_cents: number;
  balance_after_cents: number;
  note: string;
  kind: EconomicKind;
  category_id: string | null;
  occ: number;
  exclude: boolean;
};

export type ImportCommitResult = {
  import_id: string;
  already_imported: boolean;
  inserted: number;
  duplicates: number;
  excluded: number;
  applied_opening: boolean;
};

export type StatementImport = {
  id: string;
  account_id: string;
  file_name: string;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | string | null;
  closing_balance: number | string | null;
  currency: string;
  masked_account: string | null;
  status: 'committed' | 'rolled_back';
  row_count: number;
  inserted_count: number;
  duplicate_count: number;
  applied_opening: boolean;
  created_at: string;
  rolled_back_at: string | null;
  account?: { name: string } | null;
};

function fail(message: string): never {
  throw new Error(friendlyDbError(message));
}

export function hashPdf(bytes: Uint8Array): string {
  return sha256HexBytes(bytes);
}

export async function countAccountTransactions(accountId: string): Promise<number> {
  const res = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('account_id', accountId);
  if (res.error) fail(res.error.message);
  return res.count ?? 0;
}

export async function previewDuplicates(accountId: string, rows: ImportCommitRow[]): Promise<number[]> {
  const res = await supabase.rpc('preview_statement_duplicates', {
    p_account_id: accountId,
    p_rows: rows.map((row) => ({
      occurred_at: row.occurred_at,
      posted_time: row.posted_time,
      direction: row.direction,
      amount_cents: row.amount_cents,
      balance_after_cents: row.balance_after_cents,
    })),
  });
  if (res.error) fail(res.error.message);
  return (res.data ?? []) as number[];
}

export async function commitStatementImport(input: {
  accountId: string;
  fileName: string;
  fileSha256: string;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  opening: string | null;
  closing: string | null;
  maskedAccount: string | null;
  applyOpening: boolean;
  rows: ImportCommitRow[];
}): Promise<ImportCommitResult> {
  const res = await supabase.rpc('commit_statement_import', {
    p_account_id: input.accountId,
    p_file_name: input.fileName,
    p_file_sha256: input.fileSha256,
    p_currency: input.currency,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_opening: input.opening,
    p_closing: input.closing,
    p_masked_account: input.maskedAccount,
    p_apply_opening: input.applyOpening,
    p_rows: input.rows,
  });
  if (res.error) fail(res.error.message);
  return res.data as ImportCommitResult;
}

export async function listImports(): Promise<StatementImport[]> {
  const res = await supabase
    .from('statement_imports')
    .select('*, account:accounts(name)')
    .order('created_at', { ascending: false });
  if (res.error) fail(res.error.message);
  return (res.data ?? []) as StatementImport[];
}

export async function rollbackImport(importId: string): Promise<{ deleted: number; opening_restored: boolean }> {
  const res = await supabase.rpc('rollback_statement_import', { p_import_id: importId });
  if (res.error) fail(res.error.message);
  return res.data as { deleted: number; opening_restored: boolean };
}
