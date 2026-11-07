-- =====================================================================
-- Хуулга оруулах (idempotent). Production дээр автоматаар ажиллахгүй.
-- Шинэ төсөл: schema.sql энэ файлын агуулгыг төгсгөлдөө агуулна.
-- Хуучин төсөл: зөвхөн энэ файлыг SQL Editor дээр нэг удаа ажиллуулна.
-- service_role түлхүүр шаардахгүй. Функцүүд security invoker.
-- Хуучин мөрийг update хийхгүй. transactions owner policy-г устгахгүй.
-- Нэг бүтэн гүйлгээ. Аль нэг шалгалт унавал бүхэлдээ буцна.
-- =====================================================================

begin;

do $$
declare
  v_long int;
  v_open int;
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'prerequisite: public.is_admin() байхгүй';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception 'prerequisite: auth.uid() байхгүй';
  end if;
  if (
    select count(*) from pg_class rel
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relkind = 'r'
      and rel.relname in ('profiles','accounts','categories','transactions','budgets','tags','transaction_tags','premium_orders')
  ) <> 8 then
    raise exception 'prerequisite: 8 суурь хүснэгт бүрэн биш';
  end if;
  if (
    select c.data_type from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'transactions' and c.column_name = 'occurred_at'
  ) is distinct from 'date' then
    raise exception 'prerequisite: transactions.occurred_at date байх ёстой';
  end if;
  if (
    select count(*) from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'transactions'
      and c.column_name in ('id','user_id','account_id','category_id','type','amount','note','occurred_at','created_at')
      and (
        (c.column_name = 'occurred_at' and c.data_type = 'date')
        or (c.column_name = 'created_at' and c.data_type = 'timestamp with time zone')
        or (c.column_name in ('amount') and c.data_type = 'numeric')
        or (c.column_name in ('id','user_id','account_id','category_id') and c.data_type = 'uuid')
        or (c.column_name in ('type','note') and c.data_type = 'text')
      )
  ) <> 9 then
    raise exception 'prerequisite: transactions-ийн суурь багана таарахгүй';
  end if;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'accounts'
      and c.column_name = 'initial_balance' and c.data_type = 'numeric'
  ) then
    raise exception 'prerequisite: accounts.initial_balance numeric байх ёстой';
  end if;
  if exists (
    select 1 from pg_class rel
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'account_balances' and rel.relkind <> 'v'
  ) then
    raise exception 'prerequisite: account_balances view биш байна';
  end if;
  if exists (
    select 1 from pg_class rel
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('profiles','accounts','categories','transactions','budgets','tags','transaction_tags','premium_orders')
      and rel.relrowsecurity is not true
  ) then
    raise exception 'prerequisite: суурь хүснэгтийн RLS унтраалттай байна';
  end if;
  select count(*) into v_long from public.transactions where char_length(note) > 200;
  if v_long > 0 then
    raise exception 'prerequisite: % гүйлгээний тэмдэглэл 200 тэмдэгтээс урт. Мөрийг update хийхгүй', v_long;
  end if;
  select count(*) into v_open
  from pg_policy p
  where p.polrelid = 'public.transactions'::regclass
    and p.polpermissive
    and coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%user_id = auth.uid()%'
    and coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%is_admin()%';
  if v_open > 0 then
    raise exception 'prerequisite: transactions дээр user_id-г үл хаасан policy байна';
  end if;
  select count(*) into v_open
  from pg_policy p
  where p.polrelid = 'public.transactions'::regclass
    and p.polpermissive
    and p.polcmd in ('*', 'a', 'w')
    and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), '') not like '%user_id = auth.uid()%'
    and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), pg_get_expr(p.polqual, p.polrelid), '') not like '%is_admin()%';
  if v_open > 0 then
    raise exception 'prerequisite: transactions бичих policy user_id-г үл хаана';
  end if;
end $$;

create table if not exists public.statement_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null default 'khan_bank_pdf',
  file_name text not null check (char_length(file_name) between 1 and 180),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  period_start date,
  period_end date,
  opening_balance numeric(14,2),
  closing_balance numeric(14,2),
  currency text not null default 'MNT' check (currency ~ '^[A-Z]{3}$'),
  masked_account text check (masked_account is null or masked_account ~ '^\*{4}[0-9]{4}$'),
  status text not null default 'committed' check (status in ('committed', 'rolled_back')),
  row_count int not null check (row_count >= 0),
  inserted_count int not null default 0 check (inserted_count >= 0),
  duplicate_count int not null default 0 check (duplicate_count >= 0),
  applied_opening boolean not null default false,
  previous_initial_balance numeric(14,2),
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

create unique index if not exists statement_imports_active_file
  on public.statement_imports (user_id, account_id, file_sha256)
  where status = 'committed';

create index if not exists statement_imports_user_created
  on public.statement_imports (user_id, created_at desc);

alter table public.transactions add column if not exists economic_kind text default 'normal';
alter table public.transactions add column if not exists import_id uuid;
alter table public.transactions add column if not exists posted_time text;
alter table public.transactions add column if not exists balance_after numeric(14,2);
alter table public.transactions add column if not exists fingerprint_base text;
alter table public.transactions add column if not exists fingerprint_occ integer;

alter table public.transactions alter column economic_kind set default 'normal';
do $$
begin
  if exists (select 1 from public.transactions where economic_kind is null) then
    raise exception 'prerequisite: economic_kind хоосон мөр байна, хуучин мөрийг update хийхгүй';
  end if;
end $$;
alter table public.transactions alter column economic_kind set not null;

alter table public.transactions drop constraint if exists transactions_economic_kind_check;
alter table public.transactions add constraint transactions_economic_kind_check
  check (economic_kind in ('normal', 'transfer', 'savings', 'refund', 'unclassified'));

alter table public.transactions drop constraint if exists transactions_posted_time_check;
alter table public.transactions add constraint transactions_posted_time_check
  check (posted_time is null or posted_time ~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$');

alter table public.transactions drop constraint if exists transactions_fingerprint_pair_check;
alter table public.transactions add constraint transactions_fingerprint_pair_check
  check (
    (fingerprint_base is null and fingerprint_occ is null)
    or (fingerprint_base is not null and fingerprint_occ is not null and fingerprint_occ >= 0)
  );

do $$
declare
  v_limit int;
  v_odd int;
begin
  select substring(pg_get_constraintdef(con.oid) from 'char_length\(note\) <= ([0-9]+)')::int
    into v_limit
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'transactions' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ~ 'char_length\(note\) <= [0-9]+'
  limit 1;
  select count(*) into v_odd
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'transactions' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%note%'
    and pg_get_constraintdef(con.oid) !~ 'char_length\(note\) <= [0-9]+';
  if v_odd > 0 or v_limit is null or v_limit <> 200 then
    raise exception 'prerequisite: transactions_note_check char_length(note) <= 200 хэвээр байх ёстой';
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_import_id_fkey') then
    alter table public.transactions
      add constraint transactions_import_id_fkey
      foreign key (import_id) references public.statement_imports(id) on delete restrict;
  end if;
end $$;

create index if not exists transactions_import_id_idx on public.transactions (import_id);

create unique index if not exists transactions_fingerprint_unique
  on public.transactions (user_id, account_id, fingerprint_base, fingerprint_occ)
  where fingerprint_base is not null;

-- Төлөвийг зөвхөн rollback функц солино. Хэрэглэгч шууд update хийж чадахгүй.
create or replace function public.protect_import_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.import_write', true) is distinct from '1' then
    raise exception 'Хуулгын төлөвийг шууд засахгүй. Буцаах товчийг ашиглана уу.';
  end if;
  return new;
end $$;

drop trigger if exists statement_imports_status on public.statement_imports;
create trigger statement_imports_status
  before update on public.statement_imports
  for each row execute function public.protect_import_status();

-- Апп болон энэ функц ижил мөрөөс SHA-256 гаргана (pgcrypto шаардахгүй).
create or replace function public.sha256_hex(p_message text)
returns text
language plpgsql
immutable
as $$
declare
  msg bytea := convert_to(p_message, 'UTF8');
  bit_len bigint := octet_length(msg) * 8;
  total_bits bigint;
  total int;
  buf bytea;
  k bigint[] := array[
    1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,
    3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,
    3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,
    2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,
    666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,
    2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,
    430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,
    1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298
  ];
  h bigint[] := array[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225];
  w bigint[];
  a bigint; b bigint; c bigint; d bigint; e bigint; f bigint; g bigint; hh bigint;
  i int; j int; s0 bigint; s1 bigint; ch bigint; maj bigint; t1 bigint; t2 bigint;
  function_result text := '';
begin
  if bit_len % 512 <= 447 then total_bits := bit_len + (512 - (bit_len % 512));
  else total_bits := bit_len + (1024 - (bit_len % 512)); end if;
  total := (total_bits / 8)::int;
  buf := msg || decode('80', 'hex');
  if total - octet_length(buf) - 8 > 0 then
    buf := buf || decode(repeat('00', total - octet_length(buf) - 8), 'hex');
  end if;
  buf := buf || int8send(bit_len);
  i := 0;
  while i < total loop
    w := array_fill(0::bigint, array[64]);
    for j in 0..15 loop
      w[j+1] := (get_byte(buf, i + j*4)::bigint << 24)
        | (get_byte(buf, i + j*4 + 1)::bigint << 16)
        | (get_byte(buf, i + j*4 + 2)::bigint << 8)
        | get_byte(buf, i + j*4 + 3)::bigint;
    end loop;
    for j in 16..63 loop
      s0 := (((w[j-15+1] >> 7) | ((w[j-15+1] << 25) & 4294967295)) & 4294967295)
        # (((w[j-15+1] >> 18) | ((w[j-15+1] << 14) & 4294967295)) & 4294967295)
        # ((w[j-15+1] >> 3) & 4294967295);
      s1 := (((w[j-2+1] >> 17) | ((w[j-2+1] << 15) & 4294967295)) & 4294967295)
        # (((w[j-2+1] >> 19) | ((w[j-2+1] << 13) & 4294967295)) & 4294967295)
        # ((w[j-2+1] >> 10) & 4294967295);
      w[j+1] := (w[j-16+1] + s0 + w[j-7+1] + s1) & 4294967295;
    end loop;
    a := h[1]; b := h[2]; c := h[3]; d := h[4]; e := h[5]; f := h[6]; g := h[7]; hh := h[8];
    for j in 0..63 loop
      s1 := ((((e >> 6) | ((e << 26) & 4294967295)) & 4294967295)
        # (((e >> 11) | ((e << 21) & 4294967295)) & 4294967295)
        # (((e >> 25) | ((e << 7) & 4294967295)) & 4294967295)) & 4294967295;
      ch := ((e & f) # ((~e) & 4294967295 & g)) & 4294967295;
      t1 := (hh + s1 + ch + k[j+1] + w[j+1]) & 4294967295;
      s0 := ((((a >> 2) | ((a << 30) & 4294967295)) & 4294967295)
        # (((a >> 13) | ((a << 19) & 4294967295)) & 4294967295)
        # (((a >> 22) | ((a << 10) & 4294967295)) & 4294967295)) & 4294967295;
      maj := ((a & b) # (a & c) # (b & c)) & 4294967295;
      t2 := (s0 + maj) & 4294967295;
      hh := g; g := f; f := e; e := (d + t1) & 4294967295; d := c; c := b; b := a; a := (t1 + t2) & 4294967295;
    end loop;
    h[1] := (h[1] + a) & 4294967295; h[2] := (h[2] + b) & 4294967295;
    h[3] := (h[3] + c) & 4294967295; h[4] := (h[4] + d) & 4294967295;
    h[5] := (h[5] + e) & 4294967295; h[6] := (h[6] + f) & 4294967295;
    h[7] := (h[7] + g) & 4294967295; h[8] := (h[8] + hh) & 4294967295;
    i := i + 64;
  end loop;
  for j in 1..8 loop
    function_result := function_result || lpad(to_hex(h[j]), 8, '0');
  end loop;
  return function_result;
end $$;

create or replace function public.statement_fingerprint(
  p_date date,
  p_time text,
  p_direction text,
  p_amount_cents bigint,
  p_balance_cents bigint
) returns text
language sql
immutable
as $$
  select public.sha256_hex(
    p_date::text || '|' || coalesce(p_time, '') || '|' || p_direction || '|' ||
    abs(p_amount_cents)::text || '|' || p_balance_cents::text
  );
$$;

create or replace function public.commit_statement_import(
  p_account_id uuid,
  p_file_name text,
  p_file_sha256 text,
  p_currency text,
  p_period_start date,
  p_period_end date,
  p_opening text,
  p_closing text,
  p_masked_account text,
  p_apply_opening boolean,
  p_rows jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_opening numeric(14,2);
  v_closing numeric(14,2);
  v_existing uuid;
  v_import uuid;
  v_initial numeric(14,2);
  v_tx_count int;
  v_applied boolean := false;
  v_prev numeric(14,2);
  v_row jsonb;
  v_inserted int := 0;
  v_dup int := 0;
  v_kept int := 0;
  v_date date;
  v_time text;
  v_dir text;
  v_kind text;
  v_amount_cents bigint;
  v_balance_cents bigint;
  v_note text;
  v_category uuid;
  v_occ int;
  v_exclude boolean;
  v_base text;
  v_new_id uuid;
begin
  if v_uid is null then raise exception 'Нэвтрээгүй байна'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Мөрүүдийн жагсаалт буруу'; end if;
  if jsonb_array_length(p_rows) > 2500 then raise exception 'Нэг хуулганд 2500-аас олон мөр байна'; end if;
  if p_file_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Файлын хэш буруу'; end if;
  v_name := left(regexp_replace(coalesce(p_file_name, 'statement.pdf'), '[\\/]+', '', 'g'), 180);
  if char_length(v_name) = 0 then v_name := 'statement.pdf'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'Валют буруу'; end if;
  if p_masked_account is not null and p_masked_account !~ '^\*{4}[0-9]{4}$' then
    raise exception 'Дансны маск буруу';
  end if;
  if p_opening is not null and p_opening !~ '^-?\d+(\.\d{1,2})?$' then raise exception 'Эхний үлдэгдэл буруу'; end if;
  if p_closing is not null and p_closing !~ '^-?\d+(\.\d{1,2})?$' then raise exception 'Эцсийн үлдэгдэл буруу'; end if;
  v_opening := nullif(p_opening, '')::numeric;
  v_closing := nullif(p_closing, '')::numeric;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_exclude := coalesce((v_row->>'exclude')::boolean, false);
    if v_exclude then continue; end if;
    v_dir := v_row->>'direction';
    v_kind := v_row->>'kind';
    v_amount_cents := (v_row->>'amount_cents')::bigint;
    v_balance_cents := (v_row->>'balance_after_cents')::bigint;
    v_occ := (v_row->>'occ')::int;
    v_time := coalesce(v_row->>'posted_time', '');
    v_category := nullif(v_row->>'category_id', '')::uuid;
    if v_dir not in ('in', 'out') then raise exception 'Чиглэл буруу'; end if;
    if v_kind not in ('normal', 'transfer', 'savings', 'refund', 'unclassified') then
      raise exception 'Ангилал буруу';
    end if;
    if v_amount_cents is null or v_amount_cents <= 0 or v_amount_cents > 99999999999999 then
      raise exception 'Дүн буруу';
    end if;
    if v_balance_cents is null or abs(v_balance_cents) > 99999999999999 then
      raise exception 'Үлдэгдэл буруу';
    end if;
    if v_occ is null or v_occ < 0 or v_occ > 10000 then raise exception 'Давхардалтын дугаар буруу'; end if;
    if v_time <> '' and v_time !~ '^[0-9]{2}:[0-9]{2}(:[0-9]{2})?$' then raise exception 'Цаг буруу'; end if;
    begin
      v_date := (v_row->>'occurred_at')::date;
    exception when others then
      raise exception 'Огноо буруу';
    end;
    if v_category is not null and not exists (
      select 1 from public.categories c
      where c.id = v_category and (c.user_id is null or c.user_id = v_uid)
    ) then
      raise exception 'Ангилал олдсонгүй';
    end if;
  end loop;

  select a.initial_balance into v_initial
  from public.accounts a
  where a.id = p_account_id and a.user_id = v_uid
  for update;
  if not found then raise exception 'Данс олдсонгүй'; end if;

  select i.id into v_existing
  from public.statement_imports i
  where i.user_id = v_uid and i.account_id = p_account_id
    and i.file_sha256 = p_file_sha256 and i.status = 'committed';
  if v_existing is not null then
    return jsonb_build_object(
      'import_id', v_existing, 'already_imported', true,
      'inserted', 0, 'duplicates', 0, 'excluded', 0, 'applied_opening', false
    );
  end if;

  select count(*) into v_tx_count from public.transactions t where t.account_id = p_account_id;
  if coalesce(p_apply_opening, false) then
    if v_tx_count > 0 then
      raise exception 'Эхний үлдэгдлийг өөрчлөхгүй: дансанд гүйлгээ аль хэдийн байна';
    end if;
    if v_initial <> 0 and v_initial is distinct from v_opening then
      raise exception 'Эхний үлдэгдлийг өөрчлөхгүй: дансанд өөр үлдэгдэл бүртгэлтэй';
    end if;
    if v_initial = 0 and v_opening is not null and v_opening <> 0 then
      v_prev := v_initial;
      update public.accounts set initial_balance = v_opening where id = p_account_id and user_id = v_uid;
      v_applied := true;
    end if;
  end if;

  insert into public.statement_imports (
    user_id, account_id, file_name, file_sha256, period_start, period_end,
    opening_balance, closing_balance, currency, masked_account, status,
    row_count, applied_opening, previous_initial_balance
  ) values (
    v_uid, p_account_id, v_name, p_file_sha256, p_period_start, p_period_end,
    v_opening, v_closing, p_currency, p_masked_account, 'committed',
    jsonb_array_length(p_rows), v_applied, v_prev
  ) returning id into v_import;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_exclude := coalesce((v_row->>'exclude')::boolean, false);
    if v_exclude then continue; end if;
    v_kept := v_kept + 1;
    v_dir := v_row->>'direction';
    v_kind := v_row->>'kind';
    v_amount_cents := (v_row->>'amount_cents')::bigint;
    v_balance_cents := (v_row->>'balance_after_cents')::bigint;
    v_occ := (v_row->>'occ')::int;
    v_time := nullif(coalesce(v_row->>'posted_time', ''), '');
    v_note := btrim(coalesce(v_row->>'note', ''));
    if char_length(v_note) > 200 then
      raise exception 'Тэмдэглэл 200 тэмдэгтээс урт байна. Богиносгоод дахин хадгална уу.';
    end if;
    v_category := nullif(v_row->>'category_id', '')::uuid;
    v_date := (v_row->>'occurred_at')::date;
    v_base := public.statement_fingerprint(v_date, coalesce(v_time, ''), v_dir, v_amount_cents, v_balance_cents);
    v_new_id := null;

    insert into public.transactions (
      user_id, account_id, category_id, type, amount, note, occurred_at,
      economic_kind, import_id, posted_time, balance_after, fingerprint_base, fingerprint_occ
    ) values (
      v_uid, p_account_id, v_category,
      case when v_dir = 'in' then 'income' else 'expense' end,
      (v_amount_cents::numeric / 100),
      coalesce(v_note, ''), v_date, v_kind, v_import, v_time,
      (v_balance_cents::numeric / 100),
      v_base, v_occ
    )
    on conflict (user_id, account_id, fingerprint_base, fingerprint_occ)
      where fingerprint_base is not null
    do nothing
    returning id into v_new_id;

    if v_new_id is null then v_dup := v_dup + 1; else v_inserted := v_inserted + 1; end if;
  end loop;

  update public.statement_imports
    set inserted_count = v_inserted, duplicate_count = v_dup
    where id = v_import;

  return jsonb_build_object(
    'import_id', v_import,
    'already_imported', false,
    'inserted', v_inserted,
    'duplicates', v_dup,
    'excluded', jsonb_array_length(p_rows) - v_kept,
    'applied_opening', v_applied
  );
exception
  when unique_violation then
    select i.id into v_existing
    from public.statement_imports i
    where i.user_id = auth.uid() and i.account_id = p_account_id
      and i.file_sha256 = p_file_sha256 and i.status = 'committed';
    if v_existing is not null then
      return jsonb_build_object(
        'import_id', v_existing, 'already_imported', true,
        'inserted', 0, 'duplicates', 0, 'excluded', 0, 'applied_opening', false
      );
    end if;
    raise;
end $$;

create or replace function public.preview_statement_duplicates(
  p_account_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_counts jsonb := '[]'::jsonb;
  v_count int;
  v_base text;
begin
  if v_uid is null then raise exception 'Нэвтрээгүй байна'; end if;
  if not exists (select 1 from public.accounts a where a.id = p_account_id and a.user_id = v_uid) then
    raise exception 'Данс олдсонгүй';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2500 then
    raise exception 'Мөрүүдийн жагсаалт буруу';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_base := public.statement_fingerprint(
      (v_row->>'occurred_at')::date,
      coalesce(v_row->>'posted_time', ''),
      v_row->>'direction',
      (v_row->>'amount_cents')::bigint,
      (v_row->>'balance_after_cents')::bigint
    );
    select count(*) into v_count
    from public.transactions t
    where t.user_id = v_uid and t.account_id = p_account_id and t.fingerprint_base = v_base;
    v_counts := v_counts || to_jsonb(v_count);
  end loop;
  return v_counts;
end $$;

create or replace function public.rollback_statement_import(p_import_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_imp public.statement_imports%rowtype;
  v_deleted int := 0;
  v_opening_restored boolean := false;
begin
  if v_uid is null then raise exception 'Нэвтрээгүй байна'; end if;
  select * into v_imp
  from public.statement_imports
  where id = p_import_id and user_id = v_uid
  for update;
  if not found then raise exception 'Хуулга олдсонгүй'; end if;
  if v_imp.status <> 'committed' then raise exception 'Энэ хуулгыг аль хэдийн буцаасан'; end if;

  delete from public.transactions
  where import_id = v_imp.id and user_id = v_uid;
  get diagnostics v_deleted = row_count;

  if v_imp.applied_opening and v_imp.previous_initial_balance is not null then
    update public.accounts a
      set initial_balance = v_imp.previous_initial_balance
      where a.id = v_imp.account_id
        and a.user_id = v_uid
        and a.initial_balance is not distinct from v_imp.opening_balance;
    v_opening_restored := found;
  end if;

  perform set_config('app.import_write', '1', true);
  update public.statement_imports
    set status = 'rolled_back', rolled_back_at = now()
    where id = v_imp.id;

  return jsonb_build_object('deleted', v_deleted, 'opening_restored', v_opening_restored);
end $$;

alter table public.statement_imports enable row level security;

drop policy if exists "imports select own or admin" on public.statement_imports;
create policy "imports select own or admin" on public.statement_imports
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "imports insert own" on public.statement_imports;
create policy "imports insert own" on public.statement_imports
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "imports update own" on public.statement_imports;
create policy "imports update own" on public.statement_imports
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Хуучин transactions policy-г хэвээр үлдээнэ. Шинэ restrictive policy зөвхөн нэмж чангална.
drop policy if exists "transactions import owner" on public.transactions;
create policy "transactions import owner" on public.transactions
  as restrictive
  for all to authenticated
  using (
    import_id is null
    or public.is_admin()
    or exists (
      select 1 from public.statement_imports i
      where i.id = import_id and i.user_id = auth.uid() and i.account_id = account_id
    )
  )
  with check (
    import_id is null
    or public.is_admin()
    or exists (
      select 1 from public.statement_imports i
      where i.id = import_id and i.user_id = auth.uid() and i.account_id = account_id
    )
  );

grant select, insert, update on public.statement_imports to authenticated;

revoke all on function public.statement_fingerprint(date, text, text, bigint, bigint) from public;
revoke all on function public.commit_statement_import(uuid, text, text, text, date, date, text, text, text, boolean, jsonb) from public;
revoke all on function public.preview_statement_duplicates(uuid, jsonb) from public;
revoke all on function public.rollback_statement_import(uuid) from public;
grant execute on function public.statement_fingerprint(date, text, text, bigint, bigint) to authenticated;
grant execute on function public.commit_statement_import(uuid, text, text, text, date, date, text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.preview_statement_duplicates(uuid, jsonb) to authenticated;
grant execute on function public.rollback_statement_import(uuid) to authenticated;

commit;
