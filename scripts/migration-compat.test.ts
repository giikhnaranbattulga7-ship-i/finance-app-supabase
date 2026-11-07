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
