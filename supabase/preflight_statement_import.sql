-- READ ONLY. Supabase SQL Editor дээр нэг удаа ажиллуулж, үр дүнг CSV-гээр хадгална.
-- Хэрэглэгчийн мөр, нэр, дүн, тэмдэглэл гаргахгүй. Зөвхөн тоо, төрөл, policy, функц.
-- rahymsygjwytwludoucq дээр бичилт хийхгүй. Энэ файл миграци биш.

select check_id, status, detail
from (
  select 10 as ord, 'postgres_version' as check_id, 'info'::text as status, current_setting('server_version') as detail
  union all
  select 20, 'base_table_count',
    case when count(*) = 8 then 'ok' else 'blocker' end,
    count(*)::text
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relkind = 'r'
    and rel.relname in ('profiles','accounts','categories','transactions','budgets','tags','transaction_tags','premium_orders')
  union all
  select 30, 'statement_imports_absent',
    case when to_regclass('public.statement_imports') is null then 'ok' else 'blocker' end,
    coalesce(to_regclass('public.statement_imports')::text, 'absent')
  union all
  select 40, 'transactions_occurred_at_date',
    case when data_type = 'date' then 'ok' else 'blocker' end,
    coalesce(data_type, 'missing')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'occurred_at'
  union all
  select 50, 'transactions_base_column_count',
    case when count(*) = 9 then 'ok' else 'blocker' end,
    string_agg(column_name, ',' order by ordinal_position)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions'
  union all
  select 60, 'amount_numeric',
    case when data_type = 'numeric' and (numeric_scale is null or numeric_scale >= 2) then 'ok' else 'blocker' end,
    data_type || ' precision=' || coalesce(numeric_precision::text, 'none') || ' scale=' || coalesce(numeric_scale::text, 'none')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'transactions' and column_name = 'amount'
  union all
  select 70, 'initial_balance_numeric',
    case when data_type = 'numeric' and (numeric_scale is null or numeric_scale >= 2) then 'ok' else 'blocker' end,
    data_type || ' precision=' || coalesce(numeric_precision::text, 'none') || ' scale=' || coalesce(numeric_scale::text, 'none')
  from information_schema.columns
  where table_schema = 'public' and table_name = 'accounts' and column_name = 'initial_balance'
  union all
  select 80, 'rls_enabled_base_tables',
    case when count(*) filter (where relrowsecurity) = 8 and count(*) = 8 then 'ok' else 'blocker' end,
    string_agg(rel.relname || ':' || rel.relrowsecurity::text, ',' order by rel.relname)
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relkind = 'r'
    and rel.relname in ('profiles','accounts','categories','transactions','budgets','tags','transaction_tags','premium_orders')
  union all
  select 90, 'account_balances_is_view',
    case when relkind = 'v' then 'ok' else 'blocker' end,
    'relkind=' || relkind::text
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'account_balances'
  union all
  select 100, 'account_balances_columns', 'info',
    string_agg(column_name, ',' order by ordinal_position)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'account_balances'
  union all
  select 110, 'account_balances_definition_shape',
    case
      when pg_get_viewdef('public.account_balances'::regclass, true) ilike '%transactions.*%' then 'blocker'
      when pg_get_viewdef('public.account_balances'::regclass, true) ilike '%t.*%' then 'blocker'
      else 'ok'
    end,
    left(pg_get_viewdef('public.account_balances'::regclass, true), 400)
  union all
  select 120, 'is_admin_exists',
    case when p.proname is null then 'blocker' else 'info' end,
    coalesce(pg_get_function_identity_arguments(p.oid), 'missing')
      || ' returns=' || coalesce(pg_get_function_result(p.oid), '')
      || ' security_definer=' || coalesce(p.prosecdef::text, '')
  from (select 1) s
  left join pg_proc p on p.oid = to_regprocedure('public.is_admin()')
  union all
  select 130, 'auth_uid_exists',
    case when to_regprocedure('auth.uid()') is null then 'blocker' else 'ok' end,
    coalesce(to_regprocedure('auth.uid()')::text, 'missing')
  union all
  select 140, 'import_functions_absent',
    case when count(*) = 0 then 'ok' else 'blocker' end,
    coalesce(string_agg(p.proname, ','), 'absent')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('sha256_hex','statement_fingerprint','commit_statement_import','preview_statement_duplicates','rollback_statement_import','protect_import_status')
  union all
  select 150, 'notes_longer_than_500',
    case when count(*) = 0 then 'ok' else 'blocker' end,
    count(*)::text
  from public.transactions
  where char_length(note) > 500
  union all
  select 160, 'transaction_row_count', 'info', count(*)::text from public.transactions
  union all
  select 200 + row_number() over (order by con.conname),
    'constraint:' || con.conname,
    'info',
    pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'transactions'
  union all
  select 300 + row_number() over (order by pol.polname),
    'policy:' || rel.relname || ':' || pol.polname,
    case
      when rel.relname = 'transactions'
        and pol.polpermissive
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%user_id = auth.uid()%'
        and coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') not like '%is_admin()%'
      then 'blocker'
      else 'info'
    end,
    case pol.polcmd::text when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end
      || ' permissive=' || pol.polpermissive::text
      || ' using=' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')
      || ' check=' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
  from pg_policy pol
  join pg_class rel on rel.oid = pol.polrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
  union all
  select 400 + row_number() over (order by tg.tgname),
    'trigger:' || rel.relname || ':' || tg.tgname,
    'info',
    pg_get_triggerdef(tg.oid)
  from pg_trigger tg
  join pg_class rel on rel.oid = tg.tgrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and not tg.tgisinternal
    and rel.relname in ('transactions','accounts','profiles','account_balances')
) checks
order by ord;
