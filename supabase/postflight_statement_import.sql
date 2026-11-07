-- READ ONLY. Миграцийн дараа нэг удаа ажиллуулж CSV-гээр хадгална.
-- Хэрэглэгчийн мөр гаргахгүй. Хуучин гүйлгээг өөрчлөхгүй.

select check_id, status, detail
from (
  select 10 as ord, 'statement_imports_exists' as check_id,
    case when to_regclass('public.statement_imports') is not null then 'ok' else 'blocker' end as status,
    coalesce(to_regclass('public.statement_imports')::text, 'missing') as detail
  union all
  select 20, 'statement_imports_rls',
    case when relrowsecurity then 'ok' else 'blocker' end,
    relrowsecurity::text
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'statement_imports'
  union all
  select 30, 'occurred_at_still_date',
    case when data_type = 'date' then 'ok' else 'blocker' end,
    data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'occurred_at'
  union all
  select 40, 'new_transaction_columns',
    case when count(*) = 6 then 'ok' else 'blocker' end,
    string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' order by column_name)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions'
    and column_name in ('economic_kind','import_id','posted_time','balance_after','fingerprint_base','fingerprint_occ')
  union all
  select 50, 'economic_kind_default',
    case when column_default = '''normal''::text' and is_nullable = 'NO' then 'ok' else 'blocker' end,
    coalesce(column_default, 'none') || ' nullable=' || is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'economic_kind'
  union all
  select 60, 'base_rls_still_on',
    case when count(*) filter (where relrowsecurity) = 8 then 'ok' else 'blocker' end,
    count(*) filter (where relrowsecurity)::text
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relkind = 'r'
    and rel.relname in ('profiles','accounts','categories','transactions','budgets','tags','transaction_tags','premium_orders')
  union all
  select 70, 'owner_policy_kept',
    case when count(*) = 1 then 'ok' else 'blocker' end,
    coalesce(string_agg(left(pg_get_expr(polqual, polrelid), 180), ' | '), 'missing')
  from pg_policy
  where polrelid = 'public.transactions'::regclass and polname = 'transactions owner all'
  union all
  select 80, 'restrictive_import_policy',
    case when count(*) = 1 and bool_and(not polpermissive) then 'ok' else 'blocker' end,
    count(*)::text
  from pg_policy
  where polrelid = 'public.transactions'::regclass and polname = 'transactions import owner'
  union all
  select 90, 'new_functions_invoker',
    case when count(*) = 6 and bool_and(not prosecdef) then 'ok' else 'blocker' end,
    string_agg(proname || ':' || prosecdef::text, ',' order by proname)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('sha256_hex','statement_fingerprint','commit_statement_import','preview_statement_duplicates','rollback_statement_import','protect_import_status')
  union all
  select 100, 'import_function_signatures', 'info',
    string_agg(proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' | ' order by proname)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('statement_fingerprint','commit_statement_import','preview_statement_duplicates','rollback_statement_import')
  union all
  select 110, 'public_execute_revoked',
    case when count(*) = 0 then 'ok' else 'blocker' end,
    count(*)::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('statement_fingerprint','commit_statement_import','preview_statement_duplicates','rollback_statement_import')
    and has_function_privilege('public', p.oid, 'execute')
  union all
  select 120, 'account_balances_columns_unchanged',
    case when string_agg(column_name, ',' order by ordinal_position) = 'id,user_id,name,type,currency,initial_balance,balance' then 'ok' else 'blocker' end,
    string_agg(column_name, ',' order by ordinal_position)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'account_balances'
  union all
  select 130, 'transaction_row_count', 'info', count(*)::text from public.transactions
  union all
  select 140, 'statement_import_row_count', 'info', count(*)::text from public.statement_imports
) checks
order by ord;
