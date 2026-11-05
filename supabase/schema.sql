-- =====================================================================
-- Хувийн санхүүгийн апп — Supabase (PostgreSQL) схем
-- 8 хүснэгт: profiles, accounts, categories, transactions, budgets,
--            tags, transaction_tags (N:M), premium_orders
-- Бүх хүснэгтэд RLS идэвхтэй. Админ эрхийг is_admin() функцээр шалгана.
-- Дахин ажиллуулахад аюулгүй (idempotent) байдлаар бичсэн.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- 1. profiles (auth.users-тэй 1:1) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'user' check (role in ('guest','user','admin')),
  is_premium  boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- 2. accounts (profiles 1:N accounts) ----------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 50),
  type            text not null default 'cash' check (type in ('cash','bank','card','savings')),
  initial_balance numeric(14,2) not null default 0,
  currency        text not null default 'MNT',
  created_at      timestamptz not null default now()
);

-- ---------- 3. categories (user_id null = системийн үндсэн ангилал) ----------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  type       text not null check (type in ('income','expense')),
  icon       text not null default 'pricetag',
  color      text not null default '#6366F1',
  created_at timestamptz not null default now()
);
create unique index if not exists categories_unique_name
  on public.categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), type, name);

-- ---------- 4. transactions (accounts 1:N, categories 1:N) ----------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type        text not null check (type in ('income','expense')),
  amount      numeric(14,2) not null check (amount > 0),
  note        text not null default '' check (char_length(note) <= 200),
  occurred_at date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, occurred_at desc);

-- ---------- 5. budgets (categories 1:N budgets) ----------
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month       date not null,               -- сарын эхний өдөр, ж: 2026-11-01
  limit_amount numeric(14,2) not null check (limit_amount > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, category_id, month)
);

-- ---------- 6. tags ----------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------- 7. transaction_tags (transactions N:M tags) ----------
create table if not exists public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  primary key (transaction_id, tag_id)
);

-- ---------- 8. premium_orders (Хамгаалалт-2: QPay/Stripe төлбөр) ----------
create table if not exists public.premium_orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  plan       text not null check (plan in ('monthly','yearly')),
  amount     numeric(14,2) not null check (amount > 0),
  status     text not null default 'pending' check (status in ('pending','paid','cancelled')),
  invoice_id text,
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);

-- ---------- Дансны үлдэгдлийг тооцох view (RLS-ийг хүндэтгэнэ) ----------
create or replace view public.account_balances
with (security_invoker = true) as
select a.id, a.user_id, a.name, a.type, a.currency, a.initial_balance,
       a.initial_balance
       + coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0) as balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

-- =====================================================================
-- Туслах функцууд
-- =====================================================================

-- Админ эсэхийг шалгана. SECURITY DEFINER тул profiles-ийн RLS-ийг
-- тойрч уншина → policy дотор дуудахад төгсгөлгүй давталт (recursion) үүсэхгүй.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Шинэ хэрэглэгч бүртгүүлэхэд profile автоматаар үүсгэнэ
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Энгийн хэрэглэгч өөрийн role / is_premium-ийг өөрчлөхөөс хамгаална
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    new.role := old.role;
    new.is_premium := old.is_premium;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.accounts         enable row level security;
alter table public.categories       enable row level security;
alter table public.transactions     enable row level security;
alter table public.budgets          enable row level security;
alter table public.tags             enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.premium_orders   enable row level security;

-- profiles
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles for select
  to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update
  to authenticated using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- accounts
drop policy if exists "accounts owner all" on public.accounts;
create policy "accounts owner all" on public.accounts for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "accounts admin read" on public.accounts;
create policy "accounts admin read" on public.accounts for select
  to authenticated using (public.is_admin());

-- categories: үндсэн (user_id null) ангиллыг зочин ч харна
drop policy if exists "categories read default or own" on public.categories;
create policy "categories read default or own" on public.categories for select
  to anon, authenticated using (user_id is null or user_id = auth.uid() or public.is_admin());
drop policy if exists "categories insert own" on public.categories;
create policy "categories insert own" on public.categories for insert
  to authenticated with check (user_id = auth.uid());
drop policy if exists "categories update own" on public.categories;
create policy "categories update own" on public.categories for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "categories delete own" on public.categories;
create policy "categories delete own" on public.categories for delete
  to authenticated using (user_id = auth.uid());
drop policy if exists "categories admin manage defaults" on public.categories;
create policy "categories admin manage defaults" on public.categories for all
  to authenticated using (public.is_admin() and user_id is null)
  with check (public.is_admin() and user_id is null);

-- transactions: данс нь мөн өөрийнх байх ёстой
drop policy if exists "transactions owner all" on public.transactions;
create policy "transactions owner all" on public.transactions for all
  to authenticated using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.accounts a where a.id = account_id and a.user_id = auth.uid())
  );
drop policy if exists "transactions admin read" on public.transactions;
create policy "transactions admin read" on public.transactions for select
  to authenticated using (public.is_admin());

-- budgets
drop policy if exists "budgets owner all" on public.budgets;
create policy "budgets owner all" on public.budgets for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tags
drop policy if exists "tags owner all" on public.tags;
create policy "tags owner all" on public.tags for all
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transaction_tags: гүйлгээ ба шошго хоёулаа өөрийнх байх ёстой
drop policy if exists "transaction_tags owner all" on public.transaction_tags;
create policy "transaction_tags owner all" on public.transaction_tags for all
  to authenticated
  using (exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid()))
  with check (
    exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
    and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid())
  );

-- premium_orders: хэрэглэгч үүсгэж/харна, төлөвийг зөвхөн админ (эсвэл webhook) өөрчилнө
drop policy if exists "orders select own or admin" on public.premium_orders;
create policy "orders select own or admin" on public.premium_orders for select
  to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders insert own pending" on public.premium_orders;
create policy "orders insert own pending" on public.premium_orders for insert
  to authenticated with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "orders admin update" on public.premium_orders;
create policy "orders admin update" on public.premium_orders for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "orders admin delete" on public.premium_orders;
create policy "orders admin delete" on public.premium_orders for delete
  to authenticated using (public.is_admin());

-- Хүснэгтийн эрх (RLS-тэй хамт ажиллана)
grant select on public.categories to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.account_balances to authenticated;
