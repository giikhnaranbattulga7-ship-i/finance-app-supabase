/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const USER_A = '11111111-1111-4111-8111-111111111111';
const marker = '-- ----- Хуулга оруулах (supabase/migrations/20261107_statement_import.sql-тэй ижил) -----\n';

function parts() {
  const schema = readFileSync('supabase/schema.sql', 'utf8');
  const migration = readFileSync('supabase/migrations/20261107_statement_import.sql', 'utf8');
  const at = schema.indexOf(marker);
  assert.ok(at > 0);
  assert.equal(schema.slice(at + marker.length).trimStart(), migration.trimStart());
  const base = schema.slice(0, at).replace(/create extension if not exists ["']?pgcrypto["']?;/gi, '');
  return { base, migration };
}

async function baseDb(): Promise<PGlite> {
  const { base } = parts();
  const db = new PGlite();
  await db.exec(`
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    end $$;
    grant usage on schema public to authenticated, anon;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.exec(base);
  await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${USER_A}', 'a@example.test', '{"full_name":"Анх"}')`);
  return db;
}

test('migration on repository base keeps old rows and date column', async () => {
  const { migration } = parts();
  const db = await baseDb();
  const account = await db.query<{ id: string }>(
    `insert into public.accounts (user_id, name, type) values ('${USER_A}', 'Синтетик', 'bank') returning id`,
  );
  const accountId = account.rows[0].id;
  const inserted = await db.query<{ id: string }>(
    `insert into public.transactions (user_id, account_id, type, amount, note, occurred_at)
     values ('${USER_A}', '${accountId}', 'expense', 12.50, 'хуучин мөр', '2026-01-02') returning id`,
  );
  const id = inserted.rows[0].id;
  const before = await db.query<{ xmin: string; amount: string; note: string; occurred_at: string }>(
    `select xmin::text as xmin, amount::text, note, occurred_at::text from public.transactions where id = '${id}'`,
  );
  const preflight = readFileSync('supabase/preflight_statement_import.sql', 'utf8');
  const beforeChecks = await db.query<{ check_id: string; status: string }>(preflight);
  const blockers = beforeChecks.rows.filter((row) => row.status === 'blocker').map((row) => row.check_id);
  assert.deepEqual(blockers, []);

  await db.exec(migration);

  const after = await db.query<{ xmin: string; amount: string; note: string; occurred_at: string; kind: string; typ: string }>(
    `select t.xmin::text as xmin, t.amount::text, t.note, t.occurred_at::text, t.economic_kind as kind, c.data_type as typ
     from public.transactions t
     join information_schema.columns c on c.table_schema = 'public' and c.table_name = 'transactions' and c.column_name = 'occurred_at'
     where t.id = '${id}'`,
  );
  assert.equal(after.rows[0].xmin, before.rows[0].xmin);
  assert.equal(after.rows[0].amount, '12.50');
  assert.equal(after.rows[0].note, 'хуучин мөр');
  assert.equal(after.rows[0].occurred_at, before.rows[0].occurred_at);
  assert.equal(after.rows[0].kind, 'normal');
  assert.equal(after.rows[0].typ, 'date');

  const post = await db.query<{ check_id: string; status: string; detail: string }>(
    readFileSync('supabase/postflight_statement_import.sql', 'utf8'),
  );
  const postBlockers = post.rows.filter((row) => row.status === 'blocker');
  assert.deepEqual(postBlockers, [], JSON.stringify(postBlockers));
  const counts = Object.fromEntries(post.rows.map((row) => [row.check_id, row.detail]));
  assert.equal(counts.transaction_row_count, '1');
  assert.equal(counts.statement_import_row_count, '0');
  await db.close();
});

test('production note limit 200 and eight existing rows survive import', async () => {
  const { migration } = parts();
  const db = await baseDb();
  const account = await db.query<{ id: string }>(
    `insert into public.accounts (user_id, name, type, initial_balance) values ('${USER_A}', 'Хаан', 'bank', 1000.00) returning id`,
  );
  const accountId = account.rows[0].id;
  for (let i = 1; i <= 8; i += 1) {
    await db.exec(
      `insert into public.transactions (user_id, account_id, type, amount, note, occurred_at)
       values ('${USER_A}', '${accountId}', 'expense', ${i}.50, 'хуучин ${i}', '2026-01-0${i}')`,
    );
  }
  const before = await db.query<{ id: string; xmin: string }>(
    `select id::text, xmin::text as xmin from public.transactions order by note`,
  );
  assert.equal(before.rows.length, 8);
  await db.exec(migration);
  const after = await db.query<{ id: string; xmin: string; typ: string; precision: number; scale: number; note_check: string }>(`
    select t.id::text, t.xmin::text as xmin, c.data_type as typ, c.numeric_precision as precision, c.numeric_scale as scale,
      (select pg_get_constraintdef(con.oid) from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        where rel.relname = 'transactions' and con.conname = 'transactions_note_check') as note_check
    from public.transactions t
    join information_schema.columns c on c.table_schema = 'public' and c.table_name = 'transactions' and c.column_name = 'amount'
    order by t.note
  `);
  assert.deepEqual(after.rows.map((row) => [row.id, row.xmin]), before.rows.map((row) => [row.id, row.xmin]));
  assert.equal(after.rows[0].typ, 'numeric');
  assert.equal(Number(after.rows[0].precision), 14);
  assert.equal(Number(after.rows[0].scale), 2);
  assert.match(after.rows[0].note_check, /char_length\(note\) <= 200/);
  const policies = await db.query<{ polname: string; def: string }>(`
    select polname, coalesce(pg_get_expr(polqual, polrelid), '') || ' ' || coalesce(pg_get_expr(polwithcheck, polrelid), '') as def
    from pg_policy where polrelid = 'public.transactions'::regclass order by polname
  `);
  const byName = Object.fromEntries(policies.rows.map((row) => [row.polname, row.def]));
  assert.match(byName['transactions owner all'], /user_id = auth\.uid\(\)/);
  assert.match(byName['transactions owner all'], /accounts/);
  assert.match(byName['transactions admin read'], /is_admin\(\)/);
  const trigger = await db.query<{ n: string }>(
    `select count(*)::text as n from pg_trigger where tgname = 'profiles_protect' and not tgisinternal`,
  );
  assert.equal(trigger.rows[0].n, '1');

  const shortRow = JSON.stringify([{
    occurred_at: '2026-02-01', posted_time: '10:00', direction: 'out', amount_cents: 100,
    balance_after_cents: 0, note: 'богино', kind: 'normal', category_id: null, occ: 0, exclude: false,
  }]);
  await db.exec(`select set_config('request.jwt.claim.sub', '${USER_A}', false)`);
  await db.exec('set role authenticated');
  const saved = await db.query<{ result: { inserted: number } }>(
    `select public.commit_statement_import($1,'synthetic.pdf',$2,'MNT','2026-02-01','2026-02-01','1000.00','999.00','****0019',false,$3::jsonb) as result`,
    [accountId, 'a'.repeat(64), shortRow],
  );
  assert.equal(saved.rows[0].result.inserted, 1);
  const longNote = 'б'.repeat(201);
  const longRow = JSON.stringify([{
    occurred_at: '2026-02-02', posted_time: '11:00', direction: 'out', amount_cents: 100,
    balance_after_cents: 0, note: longNote, kind: 'normal', category_id: null, occ: 0, exclude: false,
  }]);
  await assert.rejects(
    db.query(
      `select public.commit_statement_import($1,'long.pdf',$2,'MNT','2026-02-02','2026-02-02','1000.00','999.00','****0019',false,$3::jsonb)`,
      [accountId, 'b'.repeat(64), longRow],
    ),
    /200 тэмдэгтээс урт/,
  );
  const count = await db.query<{ n: string }>(`select count(*)::text as n from public.transactions`);
  assert.equal(count.rows[0].n, '9');
  const kept = await db.query<{ note: string }>(`select note from public.transactions where note like 'хуучин%' order by note`);
  assert.equal(kept.rows.length, 8);
  await db.exec('reset role');
  await db.exec(`delete from public.accounts where id = '${accountId}'`);
  const gone = await db.query<{ n: string }>(`select count(*)::text as n from public.transactions where account_id = '${accountId}'`);
  assert.equal(gone.rows[0].n, '0');
  await db.close();
});

test('migration aborts when occurred_at is not date', async () => {
  const { migration } = parts();
  const db = await baseDb();
  await db.exec(`alter table public.transactions alter column occurred_at type timestamptz using occurred_at::timestamptz`);
  await assert.rejects(db.exec(migration), /occurred_at date/);
  await db.exec('rollback');
  const created = await db.query<{ rel: string | null }>(`select to_regclass('public.statement_imports')::text as rel`);
  assert.equal(created.rows[0].rel, null);
  await db.close();
});
